import { describe, expect, it } from "vitest";
import { gstIncluded, serviceFee, statementTotals } from "./fees";

describe("service fee", () => {
  it("is 5% of the payment, GST included", () => {
    expect(serviceFee(9500)).toBe(475);
    expect(serviceFee(6550)).toBe(328);
    expect(gstIncluded(475)).toBe(43);
    expect(gstIncluded(1100)).toBe(100);
  });
  it("totals a month: refunded bookings carry no fee", () => {
    const t = statementTotals([
      { amount_cents: 9500, fee_cents: 475, status: "paid" },
      { amount_cents: 6500, fee_cents: 325, status: "paid" },
      { amount_cents: 9500, fee_cents: 475, status: "refunded" },
      { amount_cents: 4000, fee_cents: 200, status: "pending" },
    ]);
    expect(t).toEqual({ bookings: 2, gross: 16000, fees: 800, feesGst: 73, refunds: 1, refundedAmount: 9500 });
  });
});
