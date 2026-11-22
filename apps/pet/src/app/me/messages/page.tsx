import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants, EmptyState } from "@lyra/ui";
import { Mascot } from "@/components/mascots/Mascot";
import { ConversationList } from "@/components/messages/ConversationList";
import { PageHeader } from "@/components/PageHeader";
import { myConversations } from "@/features/messages/queries";

export const metadata: Metadata = { title: "Messages" };

/** The pet owner's conversations with salons (ADR 0005). */
export default async function MyMessagesPage() {
  const list = await myConversations();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader title="Messages" description="Chat with salons about your pets, before or after you book." back={{ href: "/me", label: "Home" }} />
      {list.length ? (
        <ConversationList timezone={list[0]?.timezone ?? "Australia/Melbourne"} items={list.map((c) => ({ id: c.id, href: `/me/messages/${c.id}`, title: c.businessName, preview: c.preview, at: c.lastMessageAt, unread: c.unread, blocked: c.blockedBy !== null }))} />
      ) : (
        <EmptyState art={<Mascot name="mochi" mood="curious" className="w-28" />} title="No messages yet" description="Have a question before you book? Open a salon's page and tap Message." action={<Link href="/me/salons" className={buttonVariants()}>Find a salon</Link>} />
      )}
    </div>
  );
}
