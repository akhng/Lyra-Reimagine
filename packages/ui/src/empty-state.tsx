import type { ReactNode } from "react";
import { cn } from "./cn";

/** Explains why something is empty and offers the next step. */
/** `art` (e.g. a mascot) replaces the small icon with an illustration. */
export function EmptyState({ icon, art, title, description, action, className }: { icon?: ReactNode; art?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed border-border bg-surface/80 px-6 py-10 text-center", className)}>
      {art ? <div className="animate-pop">{art}</div> : null}
      {!art && icon ? <div className="grid size-12 place-items-center rounded-full bg-primary-tint text-primary-text [&_svg]:size-6">{icon}</div> : null}
      <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
      {description ? <p className="max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
