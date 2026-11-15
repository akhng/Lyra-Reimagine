"use client";
import { Button, EmptyState } from "@lyra/ui";
import { TriangleAlert } from "lucide-react";
import { Mascot } from "@/components/mascots/Mascot";

/** A page under the business failed to load. No details are shown (they may contain internals). */
export default function BusinessError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl py-10">
      <EmptyState art={<Mascot name="luna" mood="curious" className="w-28" />} icon={<TriangleAlert />} title="Something went wrong" description="We couldn't load this page. Your data is safe — please try again." action={<Button onClick={reset}>Try again</Button>} />
    </div>
  );
}
