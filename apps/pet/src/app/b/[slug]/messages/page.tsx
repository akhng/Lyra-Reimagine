import type { Metadata } from "next";
import { EmptyState } from "@lyra/ui";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { Mascot } from "@/components/mascots/Mascot";
import { ConversationList } from "@/components/messages/ConversationList";
import { PageHeader } from "@/components/PageHeader";
import { businessConversations } from "@/features/messages/queries";

export const metadata: Metadata = { title: "Messages" };

/** Pet owners' messages to the salon (ADR 0005). Groomers see conversations with owners they have a current booking for. */
export default async function BusinessMessagesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { business, role } = await requireBusiness(slug);
  const list = await businessConversations(business.id);
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader title="Messages" description={role === "groomer" ? "Conversations with pet owners you're grooming for." : "Questions from pet owners, before or after they book. Owners and managers can see every conversation."} />
      {list.length ? (
        <ConversationList timezone={business.timezone} items={list.map((c) => ({ id: c.id, href: `/b/${slug}/messages/${c.id}`, title: c.customerName, preview: c.preview, at: c.lastMessageAt, unread: c.unread, blocked: c.blockedBy !== null, reports: role === "owner" || role === "manager" ? c.openReports : 0 }))} />
      ) : (
        <EmptyState art={<Mascot name="luna" mood="happy" className="w-28" />} title="No messages yet" description="When pet owners message you from your Lyra Pet listing, their messages land here." />
      )}
    </div>
  );
}
