import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, CardDescription, CardTitle, cn } from "@lyra/ui";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { PageHeader } from "@/components/PageHeader";
import { ConnectStripe } from "@/components/payments/ConnectStripe";
import { FEE_BPS, statementTotals } from "@/features/payments/fees";
import { monthPayments, paymentAccount, platformDetails } from "@/features/payments/queries";
import { syncAccount } from "@/features/payments/service";
import { formatAud } from "@/features/services/pricing";
import { nowMs } from "@/features/scheduling/time";

export const metadata: Metadata = { title: "Payments" };

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

/** Connect Stripe, see what Lyra Pet charges, and the monthly statement with a tax invoice for the service fee. */
export default async function PaymentsSettingsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ month?: string; returned?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { business, role } = await requireBusiness(slug);
  const canSee = role === "owner" || role === "manager";
  let { configured, account } = await paymentAccount(business.id);
  if (canSee && sp.returned === "1" && account) {
    // Back from Stripe onboarding: refresh the account status now rather than waiting for the webhook.
    await syncAccount(business.id, account.stripe_account_id).catch(() => undefined);
    ({ configured, account } = await paymentAccount(business.id));
  }
  const thisMonth = new Date(nowMs()).toISOString().slice(0, 7);
  const month = sp.month && MONTH.test(sp.month) ? sp.month : thisMonth;
  const rows = canSee ? await monthPayments(business.id, month) : [];
  const t = statementTotals(rows);
  const platform = platformDetails();
  const monthLabel = new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
  const day = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", timeZone: business.timezone }).format(new Date(iso)) : "—");
  const status = !account ? { label: "Not connected", tone: "neutral" as const } : account.charges_enabled ? { label: "Taking payments", tone: "success" as const } : { label: "Setup incomplete", tone: "warning" as const };

  if (!canSee) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <PageHeader title="Payments" back={{ href: `/b/${slug}/settings`, label: "Settings" }} />
        <Card><p className="text-ink">Only owners and managers can see payments.</p></Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader title="Payments" description="Take payment in full when customers book through Lyra Pet." back={{ href: `/b/${slug}/settings`, label: "Settings" }} />

      <Card aria-labelledby="stripe-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle id="stripe-title">Stripe account</CardTitle>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <CardDescription>Payments go straight to your own Stripe account and are paid out to your bank by Stripe. Lyra Pet never holds your money or sees card details.</CardDescription>
        <div className="mt-4">
          {!configured ? (
            <p className="text-sm text-muted">Online payments aren&apos;t switched on for Lyra Pet yet. Customers keep paying at the salon.</p>
          ) : role !== "owner" ? (
            <p className="text-sm text-muted">{account?.charges_enabled ? "Customers pay when they book." : "Ask the business owner to connect Stripe."}</p>
          ) : account?.charges_enabled ? (
            <p className="text-sm text-ink">Customers pay when they book. Payouts {account.payouts_enabled ? "are on" : "start once Stripe has verified your bank details"}.</p>
          ) : (
            <ConnectStripe slug={slug} label={account ? "Finish setting up Stripe" : "Connect Stripe"} />
          )}
        </div>
      </Card>

      <Card aria-labelledby="fees-title">
        <CardTitle id="fees-title">What Lyra Pet charges</CardTitle>
        <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-sm text-ink">
          <li>Using Lyra Pet is free. There&apos;s no subscription.</li>
          <li>A service fee of {FEE_BPS / 100}% (GST included) on bookings paid through the app, e.g. {formatAud(475)} on a {formatAud(9500)} groom.</li>
          <li>Stripe&apos;s card processing fees are charged to your Stripe account by Stripe.</li>
          <li>If you decline a request, it expires or the customer cancels, the customer is refunded in full and the service fee is returned to you.</li>
          <li>Appointments you book yourself, or paid at the salon, have no fee.</li>
        </ul>
      </Card>

      <Card aria-labelledby="statement-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle id="statement-title">Statement · {monthLabel}</CardTitle>
          <nav aria-label="Statement month" className="flex gap-2 text-sm font-semibold">
            <Link className="rounded-full px-3 py-2 text-primary-text underline-offset-4 hover:underline" href={`?month=${shiftMonth(month, -1)}`}>Previous month</Link>
            {month < thisMonth ? <Link className="rounded-full px-3 py-2 text-primary-text underline-offset-4 hover:underline" href={`?month=${shiftMonth(month, 1)}`}>Next month</Link> : null}
          </nav>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Paid bookings", String(t.bookings)],
            ["Customers paid", formatAud(t.gross)],
            ["Lyra Pet fees", formatAud(t.fees)],
            ["Refunded", `${formatAud(t.refundedAmount)} (${t.refunds})`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-surface-2 px-4 py-3">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="font-display text-xl font-bold text-ink tabular">{v}</dd>
            </div>
          ))}
        </dl>
        {rows.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Payments in {monthLabel}</caption>
              <thead className="text-xs text-muted">
                <tr><th className="py-2 pr-3 font-semibold">Date</th><th className="py-2 pr-3 font-semibold">Pet</th><th className="py-2 pr-3 font-semibold">Status</th><th className="py-2 pr-3 text-right font-semibold">Paid</th><th className="py-2 text-right font-semibold">Fee</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-3 tabular">{day(p.paid_at ?? p.created_at)}</td>
                    <td className="py-2 pr-3">{p.petName}</td>
                    <td className="py-2 pr-3">{p.status === "paid" ? "Paid" : "Refunded"}</td>
                    <td className="py-2 pr-3 text-right tabular">{formatAud(p.amount_cents)}</td>
                    <td className={cn("py-2 text-right tabular", p.status !== "paid" && "text-muted line-through")}>{formatAud(p.fee_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">No payments through Lyra Pet in {monthLabel}.</p>
        )}
      </Card>

      <Card aria-labelledby="invoice-title">
        <CardTitle id="invoice-title">Tax invoice · {monthLabel}</CardTitle>
        {!platform.name || !platform.abn ? (
          <p className="mt-3 rounded-2xl bg-butter-tint p-4 text-sm font-semibold text-ink">Tax invoices appear here once Lyra Pet&apos;s business details are set up.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-3 text-sm text-ink">
            <div className="grid gap-3 sm:grid-cols-2">
              <p><span className="block text-xs text-muted">From</span><span className="font-semibold">{platform.name}</span><br />ABN {platform.abn}</p>
              <p><span className="block text-xs text-muted">To</span><span className="font-semibold">{business.name}</span>{business.abn ? <><br />ABN {business.abn}</> : null}</p>
            </div>
            <p className="text-xs text-muted">Invoice {business.slug.toUpperCase()}-{month.replace("-", "")} · issued for {monthLabel}</p>
            <table className="w-full text-left">
              <caption className="sr-only">Service fees</caption>
              <tbody className="divide-y divide-border">
                <tr><th scope="row" className="py-2 font-normal">Lyra Pet service fees, {t.bookings} paid booking{t.bookings === 1 ? "" : "s"} ({FEE_BPS / 100}%)</th><td className="py-2 text-right tabular">{formatAud(t.fees)}</td></tr>
                <tr><th scope="row" className="py-2 font-normal text-muted">Includes GST of</th><td className="py-2 text-right tabular text-muted">{formatAud(t.feesGst)}</td></tr>
                <tr><th scope="row" className="py-2 font-bold">Total (GST inclusive)</th><td className="py-2 text-right font-bold tabular">{formatAud(t.fees)}</td></tr>
              </tbody>
            </table>
            <p className="text-xs text-muted">Fees were deducted from each payment by Stripe, so nothing is owing. Refunded bookings are excluded.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
