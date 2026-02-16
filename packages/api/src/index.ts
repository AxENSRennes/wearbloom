import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "./root";

/**
 * Inference helpers for input types
 * @example
 * type SessionInput = RouterInputs['auth']['getSession']
 */
type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inference helpers for output types
 * @example
 * type SessionOutput = RouterOutputs['auth']['getSession']
 */
type RouterOutputs = inferRouterOutputs<AppRouter>;

export { type AppRouter, appRouter } from "./root";
export { createAnonymousCleanupService } from "./services/anonymousCleanup";
export { createTRPCContext } from "./trpc";
export type { AppleIapDeps } from "./trpc";
export type { RouterInputs, RouterOutputs };
