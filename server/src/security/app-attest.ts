import { createHash, randomUUID } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { verifyAssertion, verifyAttestation } from "node-app-attest";
import type { AppConfig } from "../config";
import type { Database } from "../db/client";
import * as schema from "../db/schema";

export class AppAttestError extends Error {}

export class AppAttestVerifier {
  constructor(
    private readonly config: AppConfig,
    private readonly db: Database,
  ) {}

  async issueChallenge(ownerId: string): Promise<string> {
    const challenge = randomUUID();
    await this.db.insert(schema.appAttestChallenges).values({
      challenge,
      ownerId,
      expiresAt: new Date(Date.now() + 5 * 60_000),
    });
    return challenge;
  }

  async enroll(input: { ownerId: string; challenge: string; keyId: string; attestation: string }): Promise<void> {
    const teamIdentifier = this.requireTeamIdentifier();
    const challenge = await this.consumeChallenge(input.ownerId, input.challenge);
    const result = verifyAttestation({
      attestation: Buffer.from(input.attestation, "base64"),
      challenge,
      keyId: input.keyId,
      bundleIdentifier: this.config.APPLE_APP_BUNDLE_IDENTIFIER,
      teamIdentifier,
      allowDevelopmentEnvironment: this.config.APP_ATTEST_ALLOW_DEVELOPMENT,
    });
    await this.db
      .insert(schema.appAttestKeys)
      .values({
        keyId: input.keyId,
        ownerId: input.ownerId,
        publicKey: result.publicKey,
        environment: result.environment,
      })
      .onConflictDoUpdate({
        target: schema.appAttestKeys.keyId,
        set: {
          ownerId: input.ownerId,
          publicKey: result.publicKey,
          environment: result.environment,
          signCount: 0,
          lastSeenAt: new Date(),
        },
      });
  }

  async verifyRequest(input: {
    ownerId: string;
    challenge?: string | undefined;
    keyId?: string | undefined;
    assertion?: string | undefined;
    unsupported?: string | undefined;
    method: string;
    path: string;
    body: Uint8Array;
  }): Promise<void> {
    if (!this.config.APP_ATTEST_REQUIRED && input.unsupported === "true") return;
    if (!input.challenge || !input.keyId || !input.assertion) throw new AppAttestError("APP_ATTEST_REQUIRED");
    const teamIdentifier = this.requireTeamIdentifier();
    const challenge = input.challenge;
    const [key] = await this.db
      .select()
      .from(schema.appAttestKeys)
      .where(and(eq(schema.appAttestKeys.keyId, input.keyId), eq(schema.appAttestKeys.ownerId, input.ownerId)))
      .limit(1);
    if (!key) throw new AppAttestError("APP_ATTEST_KEY_UNKNOWN");
    await this.assertChallenge(input.ownerId, input.challenge);
    const payload = canonicalRequest(input.challenge, input.method, input.path, input.body);
    const result = verifyAssertion({
      assertion: Buffer.from(input.assertion, "base64"),
      payload,
      publicKey: key.publicKey,
      bundleIdentifier: this.config.APPLE_APP_BUNDLE_IDENTIFIER,
      teamIdentifier,
      signCount: key.signCount,
    });
    const updated = await this.db.transaction(async (transaction) => {
      const rows = await transaction
        .update(schema.appAttestKeys)
        .set({
          signCount: result.signCount,
          lastSeenAt: new Date(),
        })
        .where(
          and(
            eq(schema.appAttestKeys.keyId, key.keyId),
            eq(schema.appAttestKeys.ownerId, input.ownerId),
            eq(schema.appAttestKeys.signCount, key.signCount),
          ),
        )
        .returning({ keyId: schema.appAttestKeys.keyId });
      if (rows.length)
        await transaction.delete(schema.appAttestChallenges).where(eq(schema.appAttestChallenges.challenge, challenge));
      return rows.length;
    });
    if (!updated) throw new AppAttestError("APP_ATTEST_REPLAYED");
  }

  private async assertChallenge(ownerId: string, challenge: string): Promise<void> {
    const [row] = await this.db
      .select()
      .from(schema.appAttestChallenges)
      .where(
        and(
          eq(schema.appAttestChallenges.challenge, challenge),
          eq(schema.appAttestChallenges.ownerId, ownerId),
          gt(schema.appAttestChallenges.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!row) throw new AppAttestError("APP_ATTEST_CHALLENGE_INVALID");
  }

  private async consumeChallenge(ownerId: string, challenge: string): Promise<string> {
    await this.assertChallenge(ownerId, challenge);
    const deleted = await this.db
      .delete(schema.appAttestChallenges)
      .where(and(eq(schema.appAttestChallenges.challenge, challenge), eq(schema.appAttestChallenges.ownerId, ownerId)))
      .returning({ challenge: schema.appAttestChallenges.challenge });
    if (!deleted.length) throw new AppAttestError("APP_ATTEST_CHALLENGE_INVALID");
    return challenge;
  }

  private requireTeamIdentifier(): string {
    if (!this.config.APPLE_TEAM_ID) throw new AppAttestError("APP_ATTEST_NOT_CONFIGURED");
    return this.config.APPLE_TEAM_ID;
  }
}

export function canonicalRequest(challenge: string, method: string, path: string, body: Uint8Array): string {
  const digest = createHash("sha256").update(body).digest("base64");
  return `${challenge}\n${method.toUpperCase()}\n${path}\n${digest}`;
}
