import { cn } from "@lyra/ui";

/**
 * Instant placeholder while a business page's data loads. The page's real
 * title shows straight away (it's static), so navigation feels immediate;
 * the body is a pulse shaped like what's coming.
 */
export function PageSkeleton({ title, width = "max-w-5xl", variant = "list", rows = 5 }: { title: string; width?: string; variant?: "list" | "calendar" | "board"; rows?: number }) {
  return (
    <div className={cn("mx-auto flex flex-col gap-5", width)} aria-busy="true" aria-live="polite">
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">{title}</h1>
        <Bar className="mt-1 h-4 w-72 max-w-full" />
      </div>
      <span className="sr-only">Loading…</span>
      {variant === "calendar" ? (
        <>
          <Bar className="h-11 w-full sm:w-96" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
            {Array.from({ length: 7 }, (_, i) => (
              <Bar key={i} className={cn("h-64 rounded-[var(--radius-card)]", i > 0 && "hidden sm:block")} />
            ))}
          </div>
        </>
      ) : variant === "board" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Bar key={i} className="h-40 rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {Array.from({ length: rows }, (_, i) => (
            <li key={i}>
              <Bar className="h-20 rounded-[var(--radius-card)]" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Bar({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[var(--radius-control)] bg-surface-2 motion-reduce:animate-none", className)} />;
}
