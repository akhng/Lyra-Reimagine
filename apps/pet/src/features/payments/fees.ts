/**
 * Lyra Pet's service fee (ADR 0004): 5% of what the customer pays through the
 * app, GST included. Pure so the maths is unit-tested and matches the
 * database (record_checkout uses the same basis points).
 */
export const FEE_BPS = 500;

/** Service fee in cents, rounded to the nearest cent. */
export function serviceFee(amountCents: number): number {
  return Math.round((amountCents * FEE_BPS) / 10_000);
}

/** The GST inside a GST-inclusive amount (one eleventh), rounded to the cent. */
export function gstIncluded(amountCents: number): number {
  return Math.round(amountCents / 11);
}

/** Monthly statement totals from payment rows. */
export function statementTotals(rows: Array<{ amount_cents: number; fee_cents: number; status: string }>) {
  const paid = rows.filter((r) => r.status === "paid");
  const refunded = rows.filter((r) => r.status === "refunded" || r.status === "refund_due");
  const fees = paid.reduce((s, r) => s + r.fee_cents, 0);
  return { bookings: paid.length, gross: paid.reduce((s, r) => s + r.amount_cents, 0), fees, feesGst: gstIncluded(fees), refunds: refunded.length, refundedAmount: refunded.reduce((s, r) => s + r.amount_cents, 0) };
}
