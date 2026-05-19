const STRIPE_FEE_PERCENT = 0.029;
const STRIPE_FEE_FIXED_CENTS = 30;

export function processingFeeCents(amountCents: number): number {
  return Math.round(amountCents * STRIPE_FEE_PERCENT) + STRIPE_FEE_FIXED_CENTS;
}

export function totalChargeCents(baseAmountCents: number): number {
  return baseAmountCents + processingFeeCents(baseAmountCents);
}

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
