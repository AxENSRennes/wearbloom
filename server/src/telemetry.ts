import * as Sentry from "@sentry/bun";
import { PostHog } from "posthog-node";
import type { AppConfig } from "./config";

let posthog: PostHog | undefined;
let serviceRole = "server";

export function configureTelemetry(config: AppConfig, role: "api" | "worker"): void {
  serviceRole = role;
  if (config.SENTRY_DSN_SERVER) {
    Sentry.init({
      dsn: config.SENTRY_DSN_SERVER,
      environment: config.NODE_ENV,
      tracesSampleRate: 0.2,
      sendDefaultPii: false,
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

export function track(
  event: string,
  distinctId: string,
  properties: Record<string, string | number | boolean | null> = {},
): void {
  posthog?.capture({
    distinctId,
    event,
    properties: { ...properties, service_role: serviceRole },
  });
}

export function captureException(error: unknown, context: Record<string, string | number | boolean | null> = {}): void {
  // Provider and validation errors can contain request details. Preserve the stack shape and
  // explicit allow-listed context only; never send prompts, photos, tokens, or free-form input.
  const sanitized = new Error("WearBloom server operation failed");
  if (error instanceof Error && error.stack) {
    sanitized.stack = [`Error: ${sanitized.message}`, ...error.stack.split("\n").slice(1)].join("\n");
  }
  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(context)) scope.setExtra(key, value);
    Sentry.captureException(sanitized);
  });
  posthog?.captureException(sanitized, undefined, { ...context, service_role: serviceRole });
}
