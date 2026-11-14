import { PawPrint } from "lucide-react";
import Link from "next/link";

/** Lyra Pet wordmark: product identity within the Lyra Reimagine family. */
export function Brand({ href = "/", inverted = false }: { href?: string; inverted?: boolean }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2 font-display text-lg font-bold ${inverted ? "text-white" : "text-navy"}`}>
      <span className="grid size-8 place-items-center rounded-[10px] bg-primary text-primary-contrast">
        <PawPrint className="size-4.5" aria-hidden />
      </span>
      Lyra Pet
    </Link>
  );
}
