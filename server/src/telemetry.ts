import * as Sentry from "@sentry/bun";
import { PostHog } from "posthog-node";
import { eq } from "drizzle-orm";
import type { AppConfig } from "./config";
import type { Database } from "./db/client";
import * as schema from "./db/schema";

let posthog: PostHog | undefined;
let serviceRole = "server";
let database: Database | undefined;

export function configureTelemetry(config: AppConfig, role: "api" | "worker", db: Database): void {
  serviceRole = role;
  database = db;
  if (config.SENTRY_DSN_SERVER) {
    Sentry.initWithoutDefaultIntegrations({
      dsn: config.SENTRY_DSN_SERVER,
      environment: config.NODE_ENV,
      tracesSampleRate: 0,
      sendDefaultPii: false,
      enableLogs: false,
    });
    Sentry.setTag("service.role", role);
  }
  if (config.POSTHOG_PROJECT_API_KEY) {
    posthog = new PostHog(config.POSTHOG_PROJECT_API_KEY, {
      host: config.POSTHOG_HOST,
      flushAt: 20,
      flushInterval: 10_000,
    });
  }
}

export async function track(
  event: string,
  ownerId: string,
  properties: Record<string, string | number | boolean | null> = {},
): Promise<void> {
  if (!(await hasConsent(ownerId, "analytics"))) return;
  posthog?.capture({
    distinctId: ownerId,
    event,
    properties: { ...properties, service_role: serviceRole },
  });
}

export async function captureException(
  error: unknown,
  ownerId: string | undefined,
  context: Record<string, string | number | boolean | null> = {},
): Promise<void> {
  if (!ownerId || !(await hasConsent(ownerId, "diagnostics"))) return;
  // Provider and validation errors can contain request details. Preserve the stack shape and
  // explicit allow-listed context only; never send prompts, photos, tokens, or free-form input.
  const sanitized = new Error("WearBloom server operation failed");
  if (error instanceof Error && error.stack) {
    sanitized.stack = [`Error: ${sanitized.message}`, ...error.stack.split("\n").slice(1)].join("\n");
  }
  Sentry.withScope((scope) => {
    scope.setUser({ id: ownerId });
    for (const [key, value] of Object.entries(context)) scope.setExtra(key, value);
    Sentry.captureException(sanitized);
  });
}

export async function hasConsent(ownerId: string, kind: "analytics" | "diagnostics"): Promise<boolean> {
  if (!database) return false;
  try {
    const [preference] = await database
      .select({
        analyticsEnabled: schema.privacyPreferences.analyticsEnabled,
        diagnosticsEnabled: schema.privacyPreferences.diagnosticsEnabled,
      })
      .from(schema.privacyPreferences)
      .where(eq(schema.privacyPreferences.ownerId, ownerId))
      .limit(1);
    return telemetryConsentAllows(preference, kind);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Telemetry consent lookup failed",
        serviceRole,
        error: error instanceof Error ? error.message : "unknown",
      }),
    );
    return false;
  }
}

export function telemetryConsentAllows(
  preference: { analyticsEnabled: boolean; diagnosticsEnabled: boolean } | undefined,
  kind: "analytics" | "diagnostics",
): boolean {
  if (!preference) return false;
  return kind === "analytics" ? preference.analyticsEnabled : preference.diagnosticsEnabled;
}
