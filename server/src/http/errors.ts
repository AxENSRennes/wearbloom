import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { captureException } from "../telemetry";

export type ErrorBody = { error: { code: string; message: string; requestId: string } };

const messages: Record<string, string> = {
  INVALID_REQUEST: "The request is malformed or contains invalid values.",
  AUTH_REQUIRED: "Sign in is required for this request.",
  NOT_FOUND: "The requested item was not found.",
  LOOK_EMPTY: "Add at least one garment to the look.",
  LOOK_DUPLICATE_CATEGORY: "Choose only one garment per category.",
  LOOK_DRESS_CONFLICT: "A dress replaces the top and bottom.",
  LOOK_INCOMPLETE: "Choose a dress or both a top and bottom.",
  QUOTA_EXHAUSTED: "Your generation allowance is used for this period.",
  RENDER_IN_PROGRESS: "This preview is still rendering.",
  IDEMPOTENCY_REQUIRED: "An Idempotency-Key header is required.",
  UPLOAD_TOO_LARGE: "The image is too large.",
  UPLOAD_INVALID_IMAGE: "The file is not a valid image.",
  UPLOAD_UNSUPPORTED_TYPE: "Use a JPEG, PNG, or HEIC image.",
  UPLOAD_COUNT_EXCEEDED: "Delete an older image before uploading another.",
  APP_ATTEST_REQUIRED: "This request needs a valid app integrity assertion.",
  APP_ATTEST_KEY_UNKNOWN: "The app integrity key must be enrolled again.",
  APP_ATTEST_CHALLENGE_INVALID: "The app integrity challenge is invalid or expired.",
  APP_ATTEST_REPLAYED: "The app integrity assertion has already been used.",
  APP_ATTEST_NOT_CONFIGURED: "App integrity verification is not configured.",
  RATE_LIMITED: "Too many requests. Please wait a moment and try again.",
  APPLE_TOKEN_EXCHANGE_FAILED: "Sign in with Apple could not be completed. Please try again.",
  APPLE_REFRESH_TOKEN_MISSING: "Apple did not provide the account credential needed for deletion. Please try again.",
  APPLE_TOKEN_SUBJECT_MISMATCH: "Apple returned credentials for a different account. Please try again.",
  APPLE_TOKEN_REVOCATION_FAILED: "Apple account access could not be revoked. Please try deleting again.",
  APPLE_REAUTH_REQUIRED: "Continue with Apple again, then retry account deletion.",
};

type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 500;

export function apiError<S extends ErrorStatus>(c: Context, code: string, status: S) {
  const requestId = (c.get("requestId") as string | undefined) ?? crypto.randomUUID();
  const body: ErrorBody = {
    error: {
      code,
      message: messages[code] ?? "The request could not be completed.",
      requestId,
    },
  };
  c.header("X-Request-ID", requestId);
  return c.json(body, status);
}

export function validationHook(result: { success: boolean }, c: Context) {
  if (!result.success) return apiError(c, "INVALID_REQUEST", 400);
}

export function errorHandler(error: Error, c: Context) {
  if (error instanceof HTTPException) return error.getResponse();
  const code = messages[error.message] ? error.message : "INTERNAL_ERROR";
  captureException(error, { request_id: String(c.get("requestId") ?? "unknown"), error_code: code });
  console.error(JSON.stringify({ level: "error", requestId: c.get("requestId"), code, error: error.message }));
  switch (code) {
    case "INTERNAL_ERROR":
      return apiError(c, code, 500);
    case "NOT_FOUND":
      return apiError(c, code, 404);
    case "QUOTA_EXHAUSTED":
    case "RATE_LIMITED":
      return apiError(c, code, 429);
    case "RENDER_IN_PROGRESS":
    case "APPLE_REAUTH_REQUIRED":
      return apiError(c, code, 409);
    default:
      return apiError(c, code, 422);
  }
}
