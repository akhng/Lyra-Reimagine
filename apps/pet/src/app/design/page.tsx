import type { Metadata } from "next";
import { Mascot, MASCOTS, type MascotName, type Mood, type Pose } from "@/components/mascots/Mascot";

export const metadata: Metadata = { title: "Design system" };

const MOODS: Mood[] = ["happy", "excited", "curious", "proud", "sleepy"];
const POSES: Pose[] = ["sit", "wave", "peek"];

/** /design — the Lyra Pet design system: mascots, moods, poses and colour tokens (ADR 0003). */
export default function DesignPage() {
  return (
    <main id="main" className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="font-display text-4xl font-bold text-ink">Lyra Pet design system</h1>
      <p className="mt-2 text-muted">Original mascots and the colours, type and motion they live with.</p>
      {(Object.keys(MASCOTS) as MascotName[]).map((m) => (
        <section key={m} aria-labelledby={`m-${m}`} className="mt-10">
          <h2 id={`m-${m}`} className="font-display text-2xl font-semibold text-ink">
            {MASCOTS[m].name} <span className="text-base font-normal text-muted">· {MASCOTS[m].about}</span>
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
            {MOODS.map((mood) => (
              <li key={mood} className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] bg-surface p-3 shadow-[var(--shadow-card)]">
                <Mascot name={m} mood={mood} className="size-28" />
                <span className="text-xs font-semibold text-muted capitalize">{mood}</span>
              </li>
            ))}
            {POSES.filter((p) => p !== "sit").map((pose) => (
              <li key={pose} className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] bg-surface p-3 shadow-[var(--shadow-card)]">
                <Mascot name={m} pose={pose} mood="excited" className="size-28" />
                <span className="text-xs font-semibold text-muted capitalize">{pose}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section aria-labelledby="colours" className="mt-12">
        <h2 id="colours" className="font-display text-2xl font-semibold text-ink">Colours</h2>
        <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {["bg-primary", "bg-coral", "bg-mint", "bg-sky", "bg-butter", "bg-ink", "bg-primary-tint", "bg-coral-tint", "bg-mint-tint", "bg-sky-tint", "bg-butter-tint", "bg-surface-2"].map((c) => (
            <li key={c} className="flex flex-col gap-1 text-xs text-muted">
              <span className={`h-14 rounded-2xl border border-border ${c}`} />
              {c.replace("bg-", "")}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
