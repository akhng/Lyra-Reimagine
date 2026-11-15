import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, description, back, actions }: { title: ReactNode; description?: ReactNode; back?: { href: string; label: string }; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-3">
      {back ? (
        <Link href={back.href} className="inline-flex min-h-11 w-fit items-center gap-1 text-sm text-muted hover:text-text">
          <ChevronLeft className="size-4" aria-hidden /> {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold text-ink">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
