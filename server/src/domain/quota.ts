export function quotaPeriod(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function canGenerate(input: { used: number; allowance: number }): boolean {
  return input.used < input.allowance;
}

export function allowanceFor(input: { isPro: boolean; freeAllowance: number; paidAllowance: number }): number {
  return input.isPro ? input.paidAllowance : input.freeAllowance;
}
