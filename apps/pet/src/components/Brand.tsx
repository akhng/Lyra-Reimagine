import Link from "next/link";
import { Mascot } from "./mascots/Mascot";

/** Lyra Pet wordmark with Coco peeking out of the badge (ADR 0003). */
export function Brand({ href = "/", inverted = false }: { href?: string; inverted?: boolean }) {
  return (
    <Link href={href} className={`group inline-flex items-center gap-2 font-display text-xl font-bold ${inverted ? "text-white" : "text-ink"}`}>
      <span className="grid size-10 place-items-center overflow-hidden rounded-2xl bg-butter shadow-[inset_0_-3px_0_rgb(0_0_0/0.08)] transition-transform duration-200 group-hover:-rotate-6">
        <Mascot name="coco" pose="peek" mood="happy" className="mt-1.5 size-9" />
      </span>
      Lyra Pet
    </Link>
  );
}
