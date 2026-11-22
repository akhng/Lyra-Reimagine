import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@lyra/ui";
import { SafetyControls } from "@/components/messages/SafetyControls";
import { Thread } from "@/components/messages/Thread";
import { PageHeader } from "@/components/PageHeader";
import { myConversations, thread } from "@/features/messages/queries";

export const metadata: Metadata = { title: "Conversation" };

/** One conversation with a salon, from the pet owner's side. */
export default async function MyConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, list] = await Promise.all([thread(id), myConversations()]);
  const c = list.find((x) => x.id === id);
  if (!t || !c) notFound();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader title={c.businessName} back={{ href: "/me/messages", label: "Messages" }} actions={<Link href={`/me/salons/${c.businessSlug}`} className="text-sm font-semibold text-primary-text underline-offset-4 hover:underline">View salon</Link>} />
      <p className="text-sm text-muted">
        Your messages are seen by {c.businessName}&apos;s team: the owner, front desk and your groomer. They never see your email or phone number.
        {t.contactUnlocked ? null : " Phone numbers, emails and links are hidden until you've paid for a booking through Lyra Pet."}
      </p>
      <Thread
        conversationId={t.id}
        messages={t.messages}
        viewer="customer"
        timezone={c.timezone}
        canSend={t.blockedBy === null}
        disabledReason={t.blockedBy === "customer" ? "You blocked this conversation. Unblock it to send messages." : `${c.businessName} has paused this conversation.`}
      />
      <Card>
        <h2 className="font-display text-lg font-semibold text-ink">Something wrong?</h2>
        <div className="mt-3">
          <SafetyControls conversationId={t.id} path={`/me/messages/${t.id}`} blockedBy={t.blockedBy} side="customer" canBlock />
        </div>
      </Card>
    </div>
  );
}
