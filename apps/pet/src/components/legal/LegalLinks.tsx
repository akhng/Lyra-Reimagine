import Link from "next/link";
import { cn } from "@lyra/ui";

/** Footer links to the published terms and privacy policy. */
export function LegalLinks({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  const link = cn("underline-offset-2 hover:underline", inverted ? "text-ink-text hover:text-white" : "text-muted hover:text-ink");
  return (
    <nav aria-label="Legal" className={cn("flex flex-wrap gap-x-4 gap-y-1 text-xs", className)}>
      <Link href="/terms" className={link}>Customer terms</Link>
      <Link href="/terms/business" className={link}>Business terms</Link>
      <Link href="/privacy" className={link}>Privacy</Link>
    </nav>
  );
}

/** "By … you agree to …" under a button that creates an account, a business or a booking. */
export function AgreeNotice({ action, business = false }: { action: string; business?: boolean }) {
  return (
    <p className="text-xs leading-relaxed text-muted">
      By {action}, you agree to the{" "}
      <Link href={business ? "/terms/business" : "/terms"} className="font-semibold text-primary-text underline underline-offset-2">
        {business ? "Business Terms" : "Customer Terms"}
      </Link>{" "}
      and the{" "}
      <Link href="/privacy" className="font-semibold text-primary-text underline underline-offset-2">
        Privacy Policy
      </Link>
      .
    </p>
  );
}
