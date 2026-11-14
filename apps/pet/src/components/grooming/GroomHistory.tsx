import Image from "next/image";
import { Badge } from "@lyra/ui";
import type { GroomRecord, Photo } from "@/features/grooming/queries";
import { formatDay } from "@/lib/dates";

function Thumb({ photo, label }: { photo: Photo; label: string }) {
  return photo.url ? (
    <a href={photo.url} target="_blank" rel="noreferrer" className="block">
      <Image src={photo.url} alt={label} width={240} height={240} unoptimized className="aspect-square w-full rounded-[var(--radius-control)] object-cover" />
    </a>
  ) : (
    <span className="grid aspect-square w-full place-items-center rounded-[var(--radius-control)] bg-surface-2 text-xs text-muted">Photo unavailable</span>
  );
}

/** Latest groom next to the previous one: the "last time" reference groomers ask for. */
export function GroomComparison({ petName, records }: { petName: string; records: GroomRecord[] }) {
  const withAfter = records.filter((r) => r.photos.some((p) => p.kind === "after"));
  const [latest, previous] = withAfter;
  if (!latest) return null;
  const after = (r: GroomRecord) => r.photos.find((p) => p.kind === "after");
  const before = latest.photos.find((p) => p.kind === "before");
  const pair: Array<{ title: string; photo: Photo | undefined }> = previous
    ? [{ title: `Previous groom · ${formatDay(previous.groomed_on)}`, photo: after(previous) }, { title: `Latest groom · ${formatDay(latest.groomed_on)}`, photo: after(latest) }]
    : [{ title: `Before · ${formatDay(latest.groomed_on)}`, photo: before }, { title: `After · ${formatDay(latest.groomed_on)}`, photo: after(latest) }];
  return (
    <section aria-labelledby="compare-title" className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 id="compare-title" className="font-display text-lg font-semibold text-navy">{previous ? "Last time vs this time" : "Before and after"}</h2>
      <div className="mt-3 grid max-w-xl grid-cols-2 gap-3">
        {pair.map(({ title, photo }) => (
          <figure key={title} className="flex flex-col gap-2">
            {photo ? <Thumb photo={photo} label={`${petName}: ${title}`} /> : <span className="grid aspect-square place-items-center rounded-[var(--radius-control)] bg-surface-2 text-xs text-muted">No photo</span>}
            <figcaption className="text-xs text-muted">{title}</figcaption>
          </figure>
        ))}
      </div>
      {latest.haircut ? <p className="mt-3 text-sm"><span className="text-muted">Latest cut:</span> {latest.haircut}</p> : null}
    </section>
  );
}

export function GroomHistory({ petName, records, groomerName }: { petName: string; records: GroomRecord[]; groomerName: (id: string | null) => string | null }) {
  return (
    <ol className="flex flex-col gap-3">
      {records.map((r) => {
        const details: Array<[string, string | null]> = [
          ["Haircut", r.haircut], ["Shampoo", r.shampoo], ["Customer's instructions", r.customer_instructions], ["Observations", r.observations], ["Customer feedback", r.customer_feedback],
        ];
        return (
          <li key={r.id} className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold tabular">{formatDay(r.groomed_on)}</h3>
              {r.services_summary ? <Badge tone="primary">{r.services_summary}</Badge> : null}
              <span className="text-sm text-muted">{[groomerName(r.groomer_id), r.duration_minutes ? `${r.duration_minutes} min` : null].filter(Boolean).join(" · ")}</span>
            </div>
            <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {details.filter(([, v]) => v).map(([k, v]) => (
                <div key={k}>
                  <dt className="inline text-muted">{k}: </dt>
                  <dd className="inline whitespace-pre-line">{v}</dd>
                </div>
              ))}
            </dl>
            {r.photos.length ? (
              <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label={`Photos from ${formatDay(r.groomed_on)}`}>
                {r.photos.map((p, i) => (
                  <li key={p.id}>
                    <Thumb photo={p} label={`${petName} ${p.kind === "before" ? "before" : "after"} grooming on ${formatDay(r.groomed_on)} (${i + 1})`} />
                    <span className="mt-1 block text-xs text-muted capitalize">{p.kind}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
