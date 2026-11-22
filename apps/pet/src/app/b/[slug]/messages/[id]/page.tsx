import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card } from "@lyra/ui";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { ResolveReport } from "@/components/messages/ResolveReport";
import { SafetyControls } from "@/components/messages/SafetyControls";
import { Thread } from "@/components/messages/Thread";
import { PageHeader } from "@/components/PageHeader";
import { customerContext, openReports, thread } from "@/features/messages/queries";
import { STATUS_TEXT } from "@/features/portal/schemas";

export const metadata: Metadata = { title: "Conversation" };

/** One conversation from the salon's side, with this owner's recent requests (no contact details). */
export default async function BusinessConversationPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { business, role } = await requireBusiness(slug);
  const t = await thread(id);
  if (!t || t.businessId !== business.id) notFound();
  const frontDesk = role !== "groomer";
  const overseer = role === "owner" || role === "manager";
  const [requests, reports] = await Promise.all([customerContext(business.id, t.customerUserId), overseer ? openReports(t.id) : Promise.resolve([])]);
  const path = `/b/${slug}/messages/${t.id}`;
  const fmt = (iso: string) => new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: business.timezone }).format(new Date(iso));
  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <PageHeader title={t.customerName} back={{ href: `/b/${slug}/messages`, label: "Messages" }} />
        {t.contactUnlocked ? null : <p className="text-sm text-muted">Phone numbers, emails and links are hidden until this customer has paid for a booking through Lyra Pet.</p>}
        <Thread
          conversationId={t.id}
          messages={t.messages}
          viewer="staff"
          timezone={business.timezone}
          canSend={t.blockedBy === null}
          disabledReason={t.blockedBy === "business" ? "Your salon blocked this conversation. The front desk can unblock it." : `${t.customerName} has blocked this conversation.`}
        />
      </div>
      <aside className="flex flex-col gap-4">
        <Card>
          <h2 className="font-display text-lg font-semibold text-ink">Requests from {t.customerName}</h2>
          {requests.length ? (
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {requests.map((r) => (
                <li key={r.id} className="rounded-2xl bg-surface-2 px-3 py-2">
                  <span className="font-semibold text-ink">{r.petName}</span> · {r.services.join(", ") || "Groom"}
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <Badge tone={STATUS_TEXT[r.status]?.tone ?? "neutral"}>{STATUS_TEXT[r.status]?.label ?? r.status}</Badge>
                    {r.preferredStart ? fmt(r.preferredStart) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">No bookings yet. They&apos;re asking before they book.</p>
          )}
          {frontDesk && requests.length ? (
            <Link href={`/b/${slug}/requests`} className="mt-3 inline-block text-sm font-semibold text-primary-text underline-offset-4 hover:underline">
              Open requests
            </Link>
          ) : null}
        </Card>
        {reports.length ? (
          <Card>
            <h2 className="font-display text-lg font-semibold text-ink">Reports</h2>
            <ul className="mt-3 flex flex-col gap-3 text-sm">
              {reports.map((r) => (
                <li key={r.id} className="flex flex-col gap-2 rounded-2xl bg-warning-tint px-3 py-2">
                  <span className="text-ink">
                    By {r.reporter_kind === "customer" ? "the customer" : "a team member"} · {fmt(r.created_at)}
                    {r.reason ? `: ${r.reason}` : ""}
                  </span>
                  <ResolveReport reportId={r.id} path={path} />
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
        <Card>
          <h2 className="font-display text-lg font-semibold text-ink">Safety</h2>
          <div className="mt-3">
            <SafetyControls conversationId={t.id} path={path} blockedBy={t.blockedBy} side="business" canBlock={frontDesk} />
          </div>
        </Card>
      </aside>
    </div>
  );
}
