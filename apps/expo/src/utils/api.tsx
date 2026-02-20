import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import superjson from "superjson";

import type { AppRouter } from "@acme/api";

import { getAuthHeaders } from "./authHeaders";
import { getBaseUrl } from "./base-url";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24h — must be >= persist maxAge
    },
  },
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: createTRPCClient({
    links: [
      loggerLink({
        enabled: (opts) =>
          __DEV__ ||
          (opts.direction === "down" && opts.result instanceof Error),
        colorMode: "ansi",
      }),
      httpBatchLink({
        transformer: superjson,
        url: `${getBaseUrl()}/api/trpc`,
        headers() {
          const headers = new Map<string, string>();
          headers.set("x-trpc-source", "expo-react");
          const authHeaders = getAuthHeaders();
          if (authHeaders?.Cookie) {
            headers.set("Cookie", authHeaders.Cookie);
          }
          return Object.fromEntries(headers);
        },
        fetch(input, init) {
          return fetch(input, { ...init, credentials: "omit" });
        },
      }),
    ],
  }),
  queryClient,
});

export type { RouterOutputs } from "@acme/api";
