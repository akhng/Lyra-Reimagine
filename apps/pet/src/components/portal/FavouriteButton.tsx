"use client";
import { Heart } from "lucide-react";
import { useState, useTransition } from "react";
import { cn } from "@lyra/ui";
import { toggleFavouriteAction } from "@/features/portal/actions";

/** Save a salon to your favourites. */
export function FavouriteButton({ slug, name, initial }: { slug: string; name: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from favourites` : `Save ${name} to favourites`}
      disabled={pending}
      onClick={() => start(async () => { const r = await toggleFavouriteAction(slug); if (r.ok) setOn(r.favourite); })}
      className={cn("relative z-10 grid size-11 place-items-center rounded-full transition-[background-color,transform] duration-200 active:scale-90", on ? "bg-coral-tint text-coral-text" : "bg-surface/80 text-ink hover:bg-surface")}
    >
      <Heart className={cn("size-5", on && "fill-current")} aria-hidden />
    </button>
  );
}
