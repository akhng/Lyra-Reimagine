import { Star } from "lucide-react";
import { cn } from "@lyra/ui";

/** Read-only star rating with a text equivalent. */
export function Stars({ rating, className }: { rating: number; className?: string }) {
  const r = Math.round(rating * 2) / 2;
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`${r} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} aria-hidden className={cn("size-4", i <= r ? "fill-butter text-warning" : i - 0.5 === r ? "fill-butter/50 text-warning" : "text-border")} />
      ))}
    </span>
  );
}
