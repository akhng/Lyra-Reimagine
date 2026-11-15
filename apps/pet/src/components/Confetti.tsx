"use client";
import { useSyncExternalStore } from "react";

/**
 * A short burst of confetti for real celebrations (a submitted request, an
 * achievement). Pure CSS; nothing renders when the person prefers reduced motion.
 */
const COLOURS = ["var(--primary)", "var(--coral)", "var(--mint)", "var(--sky)", "var(--butter)"];
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

export function Confetti({ pieces = 36 }: { pieces?: number }) {
  const reduced = useSyncExternalStore(subscribe, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => true);
  if (reduced) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {Array.from({ length: pieces }, (_, i) => (
        <span
          key={i}
          className="absolute top-0 block h-3 w-2 rounded-sm"
          style={{
            left: `${(i * 37) % 100}%`,
            background: COLOURS[i % COLOURS.length],
            animation: `pet-confetti ${1.8 + (i % 5) * 0.25}s ease-in ${(i % 7) * 0.08}s 1 both`,
            ["--drift" as string]: `${((i * 53) % 120) - 60}px`,
          }}
        />
      ))}
    </div>
  );
}
