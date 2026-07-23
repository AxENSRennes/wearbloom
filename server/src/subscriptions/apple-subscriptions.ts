import {
  AppStoreServerAPIClient,
  AutoRenewStatus,
  Environment,
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
  NotificationTypeV2,
  SignedDataVerifier,
  Status,
} from "@apple/app-store-server-library";
import { and, eq, inArray, isNotNull, isNull, lt, lte, or } from "drizzle-orm";
import type { AppConfig } from "../config";
import type { Database } from "../db/client";
import * as schema from "../db/schema";
import { errorMessage } from "../errors";
import { appleRootCertificates } from "./apple-root-certificates";

const productIDs = new Set(["monthly", "yearly"]);

export class AppleSubscriptionError extends Error {}

type EntitlementState = {
  status: string;
  isPro: boolean;
  expiresAt: Date | null;
  willRenew: boolean;
};

export class AppleSubscriptionService {
  private readonly verifiers = new Map<Environment, SignedDataVerifier>();
  private readonly apiClients = new Map<Environment, AppStoreServerAPIClient>();

  constructor(
    config: AppConfig,
    private readonly db: Database,
  ) {
    this.verifiers.set(
      Environment.SANDBOX,
      new SignedDataVerifier(appleRootCertificates, true, Environment.SANDBOX, config.APPLE_APP_BUNDLE_IDENTIFIER),
    );
    this.verifiers.set(
      Environment.XCODE,
      new SignedDataVerifier(appleRootCertificates, false, Environment.XCODE, config.APPLE_APP_BUNDLE_IDENTIFIER),
    );
    if (config.APPLE_APP_ID) {
      this.verifiers.set(
        Environment.PRODUCTION,
        new SignedDataVerifier(
          appleRootCertificates,
          true,
          Environment.PRODUCTION,
          config.APPLE_APP_BUNDLE_IDENTIFIER,
          config.APPLE_APP_ID,
        ),
      );
    }
    if (config.APPLE_IAP_PRIVATE_KEY && config.APPLE_IAP_KEY_ID && config.APPLE_IAP_ISSUER_ID) {
      for (const environment of [Environment.PRODUCTION, Environment.SANDBOX]) {
        this.apiClients.set(
          environment,
          new AppStoreServerAPIClient(
            config.APPLE_IAP_PRIVATE_KEY,
            config.APPLE_IAP_KEY_ID,
            config.APPLE_IAP_ISSUER_ID,
            config.APPLE_APP_BUNDLE_IDENTIFIER,
            environment,
          ),
        );
      }
    }
  }

  get canVerifyProductionNotifications(): boolean {
    return this.verifiers.has(Environment.PRODUCTION);
  }

  get canReconcileWithApple(): boolean {
    return this.apiClients.size > 0;
  }

  async ensureAccount(ownerId: string) {
    await this.db.insert(schema.entitlements).values({ ownerId }).onConflictDoNothing();
    const [entitlement] = await this.db
      .select()
      .from(schema.entitlements)
      .where(eq(schema.entitlements.ownerId, ownerId))
      .limit(1);
    if (!entitlement) throw new Error("ENTITLEMENT_ACCOUNT_NOT_CREATED");
    return entitlement;
  }

  async syncTransactions(ownerId: string, signedTransactions: string[]) {
    await this.ensureAccount(ownerId);
    let newest: JWSTransactionDecodedPayload | undefined;
    for (const signedTransaction of signedTransactions) {
      const transaction = await this.verifyTransaction(signedTransaction);
      this.validateProduct(transaction);
      await this.applyClientTransaction(ownerId, transaction);
      if ((transaction.signedDate ?? 0) >= (newest?.signedDate ?? 0)) newest = transaction;
    }
    const environment = reconciliationEnvironment(newest?.environment);
    if (newest?.originalTransactionId && environment && this.canReconcileWithApple) {
      await this.reconcile(newest.originalTransactionId, environment);
    }
    return this.ensureAccount(ownerId);
  }

  async reconcileOwner(ownerId: string, minimumAgeMs = 5 * 60_000): Promise<void> {
    const entitlement = await this.ensureAccount(ownerId);
    const environment = reconciliationEnvironment(entitlement.environment);
    if (
      !entitlement.originalTransactionId ||
      !environment ||
      entitlement.updatedAt.getTime() > Date.now() - minimumAgeMs
    ) {
      return;
    }
    await this.reconcile(entitlement.originalTransactionId, environment);
  }

  async reconcileStale(limit = 100): Promise<number> {
    if (!this.canReconcileWithApple) return 0;
    const stale = await this.db
      .select({
        originalTransactionId: schema.entitlements.originalTransactionId,
        environment: schema.entitlements.environment,
      })
      .from(schema.entitlements)
      .where(
        and(
          isNotNull(schema.entitlements.originalTransactionId),
          isNotNull(schema.entitlements.environment),
          inArray(schema.entitlements.status, ["active", "grace_period", "billing_retry"]),
          lt(schema.entitlements.updatedAt, new Date(Date.now() - 60 * 60_000)),
        ),
      )
      .limit(limit);
    let reconciled = 0;
    for (const entitlement of stale) {
      const environment = reconciliationEnvironment(entitlement.environment);
      if (!entitlement.originalTransactionId || !environment) continue;
      try {
        await this.reconcile(entitlement.originalTransactionId, environment);
        reconciled += 1;
      } catch (error) {
        console.error(
          JSON.stringify({
            level: "error",
            message: "App Store subscription reconciliation failed",
            code: errorMessage(error),
          }),
        );
      }
    }
    return reconciled;
  }

  async handleNotification(signedPayload: string): Promise<"processed" | "duplicate" | "unmatched"> {
    const notification = await this.verifyNotification(signedPayload);
    const notificationUuid = notification.notificationUUID;
    const notificationType = notification.notificationType;
    if (!notificationUuid || !notificationType) throw new AppleSubscriptionError("APPLE_TRANSACTION_INVALID");
    const [alreadyProcessed] = await this.db
      .select({ notificationUuid: schema.appleSubscriptionNotifications.notificationUuid })
      .from(schema.appleSubscriptionNotifications)
      .where(eq(schema.appleSubscriptionNotifications.notificationUuid, notificationUuid))
      .limit(1);
    if (alreadyProcessed) return "duplicate";

    const transaction = notification.data?.signedTransactionInfo
      ? await this.verifyTransaction(notification.data.signedTransactionInfo)
      : undefined;
    const renewal = notification.data?.signedRenewalInfo
      ? await this.verifyRenewalInfo(notification.data.signedRenewalInfo)
      : undefined;
    if (transaction?.productId) this.validateProduct(transaction);

    let result: "processed" | "unmatched" = "processed";
    if (transaction) {
      const entitlement = await this.findEntitlement(transaction, renewal);
      if (entitlement) {
        await this.applyVerifiedState({
          ownerId: entitlement.ownerId,
          transaction,
          renewal,
          status: notification.data?.status,
          notificationType,
          signedAt: notification.signedDate ?? transaction.signedDate,
        });
      } else {
        result = "unmatched";
      }
    }

    const inserted = await this.db
      .insert(schema.appleSubscriptionNotifications)
      .values({
        notificationUuid,
        notificationType,
        subtype: notification.subtype,
        environment: notification.data?.environment,
        originalTransactionId: transaction?.originalTransactionId ?? renewal?.originalTransactionId,
        signedAt: dateFromMilliseconds(notification.signedDate),
      })
      .onConflictDoNothing()
      .returning({ notificationUuid: schema.appleSubscriptionNotifications.notificationUuid });
    return inserted.length ? result : "duplicate";
  }

  async reconcile(anyTransactionId: string, environment: Environment): Promise<void> {
    const client = this.apiClients.get(environment);
    if (!client) return;
    const response = await client.getAllSubscriptionStatuses(anyTransactionId);
    const candidates = (response.data ?? []).flatMap((group) => group.lastTransactions ?? []);
    const decoded = await Promise.all(
      candidates
        .filter((item) => item.signedTransactionInfo)
        .map(async (item) => {
          const transaction = await this.verifyTransaction(item.signedTransactionInfo ?? "");
          const renewal = item.signedRenewalInfo ? await this.verifyRenewalInfo(item.signedRenewalInfo) : undefined;
          return { item, transaction, renewal };
        }),
    );
    decoded.sort((a, b) => {
      const accessDifference = Number(hasAccess(b.item.status)) - Number(hasAccess(a.item.status));
      return accessDifference || (b.transaction.expiresDate ?? 0) - (a.transaction.expiresDate ?? 0);
    });
    const current = decoded[0];
    if (!current) return;
    this.validateProduct(current.transaction);
    const entitlement = await this.findEntitlement(current.transaction, current.renewal);
    if (!entitlement) return;
    await this.applyVerifiedState({
      ownerId: entitlement.ownerId,
      transaction: current.transaction,
      renewal: current.renewal,
      status: current.item.status,
      notificationType: "RECONCILIATION",
      signedAt: Math.max(current.transaction.signedDate ?? 0, current.renewal?.signedDate ?? 0),
    });
  }

  private async verifyNotification(signedPayload: string) {
    let lastError: unknown;
    for (const environment of [Environment.PRODUCTION, Environment.SANDBOX]) {
      const verifier = this.verifiers.get(environment);
      if (!verifier) continue;
      try {
        return await verifier.verifyAndDecodeNotification(signedPayload);
      } catch (error) {
        lastError = error;
      }
    }
    if (!this.canVerifyProductionNotifications) {
      throw new AppleSubscriptionError("APPLE_SUBSCRIPTIONS_NOT_CONFIGURED");
    }
    throw lastError ?? new AppleSubscriptionError("APPLE_TRANSACTION_INVALID");
  }

  private async verifyTransaction(signedTransaction: string): Promise<JWSTransactionDecodedPayload> {
    let lastError: unknown;
    for (const verifier of this.verifiers.values()) {
      try {
        return await verifier.verifyAndDecodeTransaction(signedTransaction);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new AppleSubscriptionError("APPLE_TRANSACTION_INVALID");
  }

  private async verifyRenewalInfo(signedRenewalInfo: string): Promise<JWSRenewalInfoDecodedPayload> {
    let lastError: unknown;
    for (const verifier of this.verifiers.values()) {
      try {
        return await verifier.verifyAndDecodeRenewalInfo(signedRenewalInfo);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new AppleSubscriptionError("APPLE_TRANSACTION_INVALID");
  }

  private validateProduct(transaction: JWSTransactionDecodedPayload): void {
    if (!transaction.productId || !productIDs.has(transaction.productId)) {
      throw new AppleSubscriptionError("APPLE_PRODUCT_INVALID");
    }
    if (!transaction.originalTransactionId || !transaction.transactionId || !transaction.expiresDate) {
      throw new AppleSubscriptionError("APPLE_TRANSACTION_INVALID");
    }
  }

  private async applyClientTransaction(ownerId: string, transaction: JWSTransactionDecodedPayload): Promise<void> {
    const existing = await this.findEntitlement(transaction);
    if (existing && existing.ownerId !== ownerId) {
      const current = await this.ensureAccount(ownerId);
      if (current.originalTransactionId && current.originalTransactionId !== transaction.originalTransactionId) {
        throw new AppleSubscriptionError("APPLE_SUBSCRIPTION_ALREADY_LINKED");
      }
      await this.db.transaction(async (database) => {
        await database.delete(schema.entitlements).where(eq(schema.entitlements.ownerId, ownerId));
        await database
          .update(schema.entitlements)
          .set({ ownerId, updatedAt: new Date() })
          .where(eq(schema.entitlements.ownerId, existing.ownerId));
      });
    }
    await this.applyVerifiedState({
      ownerId,
      transaction,
      status: transaction.revocationDate ? Status.REVOKED : Status.ACTIVE,
      notificationType: "DEVICE_SYNC",
      signedAt: transaction.signedDate,
    });
  }

  private async findEntitlement(transaction: JWSTransactionDecodedPayload, renewal?: JWSRenewalInfoDecodedPayload) {
    const token = transaction.appAccountToken ?? renewal?.appAccountToken;
    const originalTransactionId = transaction.originalTransactionId ?? renewal?.originalTransactionId;
    if (!token && !originalTransactionId) return undefined;
    const conditions = [];
    if (token) conditions.push(eq(schema.entitlements.appleAppAccountToken, token));
    if (originalTransactionId) conditions.push(eq(schema.entitlements.originalTransactionId, originalTransactionId));
    const [entitlement] = await this.db
      .select()
      .from(schema.entitlements)
      .where(conditions.length === 1 ? conditions[0] : or(...conditions))
      .limit(1);
    return entitlement;
  }

  private async applyVerifiedState(input: {
    ownerId: string;
    transaction: JWSTransactionDecodedPayload;
    renewal?: JWSRenewalInfoDecodedPayload | undefined;
    status?: number | undefined;
    notificationType: string;
    signedAt?: number | undefined;
  }): Promise<void> {
    const signedAt = dateFromMilliseconds(input.signedAt) ?? new Date();
    const state = stateFor(input.status, input.notificationType, input.transaction, input.renewal);
    await this.db
      .update(schema.entitlements)
      .set({
        originalTransactionId: input.transaction.originalTransactionId,
        latestTransactionId: input.transaction.transactionId,
        productId: input.transaction.productId,
        status: state.status,
        isPro: state.isPro,
        expiresAt: state.expiresAt,
        willRenew: state.willRenew,
        environment: input.transaction.environment,
        lastAppleSignedAt: signedAt,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.entitlements.ownerId, input.ownerId),
          or(isNull(schema.entitlements.lastAppleSignedAt), lte(schema.entitlements.lastAppleSignedAt, signedAt)),
        ),
      );
  }
}

export function stateFor(
  status: number | undefined,
  notificationType: string,
  transaction: JWSTransactionDecodedPayload,
  renewal?: JWSRenewalInfoDecodedPayload,
  now = new Date(),
): EntitlementState {
  const resolvedStatus = status ?? inferredStatus(notificationType, transaction, now);
  const expiresAt =
    resolvedStatus === Status.BILLING_GRACE_PERIOD
      ? dateFromMilliseconds(renewal?.gracePeriodExpiresDate ?? transaction.expiresDate)
      : dateFromMilliseconds(transaction.expiresDate);
  const isPro =
    hasAccess(resolvedStatus) &&
    !transaction.revocationDate &&
    Boolean(expiresAt && expiresAt.getTime() > now.getTime());
  return {
    status: statusName(resolvedStatus),
    isPro,
    expiresAt,
    willRenew: renewal?.autoRenewStatus === AutoRenewStatus.ON,
  };
}

function inferredStatus(notificationType: string, transaction: JWSTransactionDecodedPayload, now: Date): Status {
  if (
    transaction.revocationDate ||
    notificationType === NotificationTypeV2.REFUND ||
    notificationType === NotificationTypeV2.REVOKE
  ) {
    return Status.REVOKED;
  }
  if (notificationType === NotificationTypeV2.EXPIRED || notificationType === NotificationTypeV2.GRACE_PERIOD_EXPIRED) {
    return Status.EXPIRED;
  }
  return (transaction.expiresDate ?? 0) > now.getTime() ? Status.ACTIVE : Status.EXPIRED;
}

function hasAccess(status: number | undefined): boolean {
  return status === Status.ACTIVE || status === Status.BILLING_GRACE_PERIOD;
}

function statusName(status: number): string {
  switch (status) {
    case Status.ACTIVE:
      return "active";
    case Status.BILLING_GRACE_PERIOD:
      return "grace_period";
    case Status.BILLING_RETRY:
      return "billing_retry";
    case Status.REVOKED:
      return "revoked";
    default:
      return "expired";
  }
}

function dateFromMilliseconds(value: number | undefined): Date | null {
  return value === undefined ? null : new Date(value);
}

function reconciliationEnvironment(value: Environment | string | null | undefined): Environment | undefined {
  if (value === Environment.PRODUCTION) return Environment.PRODUCTION;
  if (value === Environment.SANDBOX) return Environment.SANDBOX;
  return undefined;
}
