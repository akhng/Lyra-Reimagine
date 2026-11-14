/** Shown while a business page loads. */
export default function Loading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="h-9 w-56 animate-pulse rounded-[var(--radius-control)] bg-surface-2" />
      <div className="h-28 animate-pulse rounded-[var(--radius-card)] bg-surface-2" />
      <div className="h-28 animate-pulse rounded-[var(--radius-card)] bg-surface-2" />
    </div>
  );
}
