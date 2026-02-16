import { authRouter } from "./router/auth";
import { garmentRouter } from "./router/garment";
import { userRouter } from "./router/user";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  garment: garmentRouter,
  user: userRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
