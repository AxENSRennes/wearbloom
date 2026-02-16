import { z } from "zod/v4";

// === Subscription schemas ===

export const verifyPurchaseSchema = z.object({
  signedTransactionInfo: z.string(),
});

export const restorePurchasesSchema = z.object({
  signedTransactions: z.array(z.string()).max(50),
});
