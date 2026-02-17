import { authRouter } from "./router/auth";
import { garmentRouter } from "./router/garment";
import { subscriptionRouter } from "./router/subscription";
import { tryonRouter } from "./router/tryon";
import { userRouter } from "./router/user";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  garment: garmentRouter,
  subscription: subscriptionRouter,
  tryon: tryonRouter,
  user: userRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
