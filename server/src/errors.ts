export function errorMessage(error: unknown, fallback = "INTERNAL_ERROR"): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
