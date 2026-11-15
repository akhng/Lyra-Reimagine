/**
 * Shared drawing parts for the Lyra Pet mascots (ADR 0003): chibi
 * proportions, anime-style eyes with highlights, blush and outlines. All
 * colours come from --m-* tokens in globals.css. Coordinates use a
 * 160 × 160 viewBox; the head is centred at (80, 72).
 */
export type Mood = "happy" | "excited" | "sleepy" | "curious" | "proud";

const LINE = { stroke: "var(--m-line)", strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
export const line = LINE;

export function Eyes({ mood, y = 78 }: { mood: Mood; y?: number }) {
  const xs = [61, 99];
  if (mood === "happy" || mood === "proud") {
    // Closed, smiling eyes (^ ^).
    return (
      <g fill="none" {...LINE} strokeWidth={3.5}>
        {xs.map((x) => (
          <path key={x} d={`M${x - 8} ${y + 2} Q${x} ${y - 8} ${x + 8} ${y + 2}`} />
        ))}
        {mood === "proud" ? (
          <path d="M128 46 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z" fill="var(--m-gold)" strokeWidth={1.5} />
        ) : null}
      </g>
    );
  }
  if (mood === "sleepy") {
    return (
      <g fill="none" {...LINE} strokeWidth={3.5}>
        {xs.map((x) => (
          <path key={x} d={`M${x - 8} ${y} Q${x} ${y + 6} ${x + 8} ${y}`} />
        ))}
      </g>
    );
  }
  const big = mood === "excited";
  return (
    <g>
      {xs.map((x, i) => (
        <g key={x}>
          <ellipse cx={x} cy={y} rx={big ? 10 : 8.5} ry={big ? 12.5 : 11} fill="var(--m-eye)" />
          <ellipse cx={x - 3} cy={y - 4.5} rx={big ? 4 : 3.4} ry={big ? 4.6 : 4} fill="var(--m-shine)" />
          <circle cx={x + 3.5} cy={y + 4.5} r={big ? 2.2 : 1.8} fill="var(--m-shine)" />
          {mood === "curious" && i === 1 ? <path d={`M${x - 9} ${y - 18} Q${x} ${y - 25} ${x + 9} ${y - 17}`} fill="none" {...LINE} strokeWidth={2.5} /> : null}
        </g>
      ))}
      {big ? (
        // Sparkles next to excited eyes.
        <g fill="var(--m-gold)" stroke="var(--m-line)" strokeWidth={1.5}>
          <path d="M126 50 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z" />
          <path d="M30 58 l1.8 4.2 4.2 1.8 -4.2 1.8 -1.8 4.2 -1.8 -4.2 -4.2 -1.8 4.2 -1.8z" />
        </g>
      ) : null}
    </g>
  );
}

export function Blush({ y = 92 }: { y?: number }) {
  return (
    <g fill="var(--m-blush)" opacity={0.65}>
      <ellipse cx={48} cy={y} rx={8} ry={5} />
      <ellipse cx={112} cy={y} rx={8} ry={5} />
    </g>
  );
}

/** Cat mouth (ω) or dog mouth (open, with a tongue when happy or excited). */
export function Mouth({ kind, mood, y = 95 }: { kind: "cat" | "dog"; mood: Mood; y?: number }) {
  const open = mood === "happy" || mood === "excited";
  if (kind === "cat") {
    return (
      <g fill="none" {...LINE} strokeWidth={2.6}>
        <path d={`M72 ${y} Q76 ${y + 5} 80 ${y} Q84 ${y + 5} 88 ${y}`} />
        {open ? <path d={`M76 ${y + 3} Q80 ${y + 10} 84 ${y + 3}`} fill="var(--m-tongue)" /> : null}
      </g>
    );
  }
  return (
    <g {...LINE} strokeWidth={2.6}>
      <path d={`M80 ${y - 3} L80 ${y + 1}`} fill="none" />
      {open ? (
        <path d={`M70 ${y + 1} Q80 ${y + 16} 90 ${y + 1} Z`} fill="var(--m-tongue)" />
      ) : (
        <path d={`M72 ${y + 1} Q76 ${y + 5} 80 ${y + 1} Q84 ${y + 5} 88 ${y + 1}`} fill="none" />
      )}
    </g>
  );
}

export function Nose({ y = 88 }: { y?: number }) {
  return <path d={`M75 ${y} Q80 ${y - 3} 85 ${y} Q80 ${y + 6} 75 ${y} Z`} fill="var(--m-eye)" stroke="var(--m-line)" strokeWidth={1.5} strokeLinejoin="round" />;
}

/** Sitting body with two front paws; `wave` lifts the right paw (animated unless reduced motion). */
export function Body({ fur, belly, wave, tail }: { fur: string; belly: string; wave: boolean; tail: React.ReactNode }) {
  return (
    <g>
      {tail}
      <path d="M46 150 Q42 112 80 108 Q118 112 114 150 Z" fill={fur} {...LINE} />
      <path d="M62 150 Q62 122 80 120 Q98 122 98 150 Z" fill={belly} />
      <ellipse cx={64} cy={150} rx={11} ry={7} fill={fur} {...LINE} />
      {wave ? null : <ellipse cx={96} cy={150} rx={11} ry={7} fill={fur} {...LINE} />}
    </g>
  );
}

/** The raised paw for the wave pose, drawn in front of the head so it reads clearly. */
export function WavingPaw({ fur }: { fur: string }) {
  return (
    <g className="animate-wave">
      <path d="M104 126 Q132 118 142 92" fill="none" stroke="var(--m-line)" strokeWidth={15} strokeLinecap="round" />
      <path d="M104 126 Q132 118 142 92" fill="none" stroke={fur} strokeWidth={9.5} strokeLinecap="round" />
      <circle cx={143} cy={88} r={10} fill={fur} {...LINE} />
      <path d="M138 84 L138 89 M143 82 L143 88 M148 84 L148 89" stroke="var(--m-line)" strokeWidth={1.8} strokeLinecap="round" />
    </g>
  );
}
