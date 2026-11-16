"use client";
import { useActionState } from "react";
import { Button, FormField, Textarea } from "@lyra/ui";
import { FormStatus } from "@/components/FormBits";
import { replyReviewAction } from "@/features/loyalty/actions";

export function ReviewReply({ slug, reviewId, reply }: { slug: string; reviewId: string; reply: string | null }) {
  const [state, action, pending] = useActionState(replyReviewAction.bind(null, slug, reviewId), undefined);
  return (
    <form action={action} className="flex flex-col gap-2">
      <FormStatus state={state} saved="Reply saved." />
      <FormField id={`reply-${reviewId}`} label={reply ? "Your reply" : "Reply (optional)"}>
        {(p) => <Textarea {...p} name="reply" defaultValue={reply ?? ""} maxLength={1000} rows={2} />}
      </FormField>
      <Button type="submit" variant="secondary" size="sm" disabled={pending} className="self-start">
        {pending ? "Saving…" : reply ? "Update reply" : "Reply"}
      </Button>
    </form>
  );
}
