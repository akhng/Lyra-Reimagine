import { cn } from "@lyra/ui";
import { Blush, Body, Eyes, line, Mouth, Nose, WavingPaw, type Mood } from "./parts";

/**
 * Lyra Pet's four original mascots (ADR 0003): Coco the corgi, Mochi the
 * fluffy white cat, Biscuit the golden retriever and Luna the elegant grey
 * cat. Pure SVG (transparent, scalable, no network). Decorative by default;
 * pass `label` when the character carries meaning.
 */
export type MascotName = "coco" | "mochi" | "biscuit" | "luna";
export type Pose = "sit" | "wave" | "peek";
export type { Mood };

export const MASCOTS: Record<MascotName, { name: string; kind: "cat" | "dog"; about: string }> = {
  coco: { name: "Coco", kind: "dog", about: "Cheerful corgi" },
  mochi: { name: "Mochi", kind: "cat", about: "Fluffy white cat" },
  biscuit: { name: "Biscuit", kind: "dog", about: "Playful golden retriever" },
  luna: { name: "Luna", kind: "cat", about: "Elegant grey cat" },
};

const PALETTE = {
  coco: { fur: "var(--m-coco)", deep: "var(--m-coco-deep)", face: "var(--m-cream)" },
  mochi: { fur: "var(--m-mochi)", deep: "var(--m-mochi-shade)", face: "var(--m-mochi)" },
  biscuit: { fur: "var(--m-biscuit)", deep: "var(--m-biscuit-deep)", face: "var(--m-biscuit)" },
  luna: { fur: "var(--m-luna)", deep: "var(--m-luna-deep)", face: "var(--m-luna-light)" },
} as const;

function Ears({ who }: { who: MascotName }) {
  const p = PALETTE[who];
  if (who === "coco") {
    return (
      <g>
        <path d="M30 66 Q16 30 26 12 Q36 8 72 40 Z" fill={p.fur} {...line} />
        <path d="M130 66 Q144 30 134 12 Q124 8 88 40 Z" fill={p.fur} {...line} />
        <path d="M36 56 Q28 32 32 22 Q42 22 62 42 Z" fill="var(--m-inner-ear)" />
        <path d="M124 56 Q132 32 128 22 Q118 22 98 42 Z" fill="var(--m-inner-ear)" />
      </g>
    );
  }
  if (who === "biscuit") {
    // Floppy ears hang beside the face (drawn after the head).
    return null;
  }
  const tuft = who === "mochi";
  return (
    <g>
      <path d="M38 52 L40 18 L70 36 Z" fill={p.fur} {...line} />
      <path d="M122 52 L120 18 L90 36 Z" fill={p.fur} {...line} />
      <path d="M44 44 L45 27 L60 36 Z" fill="var(--m-inner-ear)" />
      <path d="M116 44 L115 27 L100 36 Z" fill="var(--m-inner-ear)" />
      {tuft ? <path d="M72 30 Q76 20 80 28 Q84 18 88 30" fill="none" {...line} strokeWidth={2.5} /> : null}
    </g>
  );
}

function Head({ who }: { who: MascotName }) {
  const p = PALETTE[who];
  const fluffy = who === "mochi";
  return (
    <g>
      {fluffy ? (
        // Fluffy cheeks: a scalloped outline.
        <path d="M30 76 Q24 62 34 52 Q36 34 56 32 Q68 24 80 28 Q92 24 104 32 Q124 34 126 52 Q136 62 130 76 Q138 92 124 104 Q118 118 100 116 Q90 122 80 118 Q70 122 60 116 Q42 118 36 104 Q22 92 30 76 Z" fill={p.fur} {...line} />
      ) : (
        <ellipse cx={80} cy={74} rx={50} ry={44} fill={p.fur} {...line} />
      )}
      {who === "coco" ? <path d="M80 40 Q66 62 64 80 Q60 104 80 110 Q100 104 96 80 Q94 62 80 40 Z" fill={p.face} /> : null}
      {who === "coco" ? <ellipse cx={80} cy={98} rx={24} ry={14} fill={p.face} /> : null}
      {who === "luna" ? <ellipse cx={80} cy={96} rx={22} ry={14} fill={p.face} /> : null}
      {who === "luna" ? <path d="M70 34 L74 46 M80 32 L80 46 M90 34 L86 46" {...line} stroke={p.deep} strokeWidth={3} /> : null}
      {who === "biscuit" ? <ellipse cx={80} cy={97} rx={20} ry={13} fill="var(--m-cream)" opacity={0.75} /> : null}
      {fluffy ? <path d="M44 100 Q50 96 52 104 M116 100 Q110 96 108 104" fill="none" stroke="var(--m-mochi-shade)" strokeWidth={3} strokeLinecap="round" /> : null}
    </g>
  );
}

function FloppyEars({ who }: { who: MascotName }) {
  if (who !== "biscuit") return null;
  const p = PALETTE.biscuit;
  return (
    <g>
      <path d="M38 48 Q14 56 20 96 Q26 110 40 100 Q46 78 50 56 Z" fill={p.deep} {...line} />
      <path d="M122 48 Q146 56 140 96 Q134 110 120 100 Q114 78 110 56 Z" fill={p.deep} {...line} />
    </g>
  );
}

function Whiskers({ who }: { who: MascotName }) {
  if (MASCOTS[who].kind !== "cat") return null;
  return (
    <g fill="none" stroke="var(--m-line)" strokeWidth={1.8} strokeLinecap="round" opacity={0.7}>
      <path d="M40 88 L22 84 M40 94 L22 96" />
      <path d="M120 88 L138 84 M120 94 L138 96" />
    </g>
  );
}

function Accessory({ who }: { who: MascotName }) {
  switch (who) {
    case "coco":
      return <path d="M54 114 Q80 128 106 114 L96 132 Q80 140 64 132 Z" fill="var(--m-bandana)" {...line} strokeWidth={2.5} />;
    case "mochi":
      return (
        <g {...line} strokeWidth={2.5}>
          <path d="M100 30 L88 22 L90 40 Z" fill="var(--m-bow)" />
          <path d="M100 30 L114 22 L110 40 Z" fill="var(--m-bow)" />
          <circle cx={100} cy={31} r={4} fill="var(--m-bow)" />
        </g>
      );
    case "biscuit":
      return (
        <g {...line} strokeWidth={2.5}>
          <path d="M56 116 Q80 126 104 116" fill="none" stroke="var(--m-collar)" strokeWidth={7} />
          <circle cx={80} cy={128} r={6} fill="var(--m-gold)" />
        </g>
      );
    case "luna":
      return (
        <g {...line} strokeWidth={2}>
          <path d="M60 116 Q80 124 100 116" fill="none" stroke="var(--m-luna-deep)" strokeWidth={2.5} />
          <path d="M84 122 A7 7 0 1 1 76 132 A5.5 5.5 0 1 0 84 122 Z" fill="var(--m-gold)" />
        </g>
      );
  }
}

function Tail({ who }: { who: MascotName }) {
  const p = PALETTE[who];
  if (who === "coco") return <ellipse cx={120} cy={138} rx={10} ry={8} fill={p.fur} {...line} />;
  if (who === "biscuit") return <path d="M112 140 Q142 130 140 102 Q132 118 110 128 Z" fill={p.deep} {...line} />;
  return <path d="M110 146 Q146 146 140 112 Q136 102 130 108 Q134 134 108 136 Z" fill={who === "mochi" ? p.fur : p.deep} {...line} />;
}

export function Mascot({ name, mood = "happy", pose = "sit", className, label }: { name: MascotName; mood?: Mood; pose?: Pose; className?: string; label?: string }) {
  const p = PALETTE[name];
  const kind = MASCOTS[name].kind;
  const peek = pose === "peek";
  return (
    <svg
      viewBox={peek ? "0 8 160 116" : "0 0 160 160"}
      className={cn("shrink-0 overflow-visible", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {peek ? null : <Body fur={p.fur} belly={kind === "dog" ? "var(--m-cream)" : name === "luna" ? "var(--m-luna-light)" : "var(--m-mochi-shade)"} wave={pose === "wave"} tail={<Tail who={name} />} />}
      {peek || name === "mochi" ? null : <Accessory who={name} />}
      <Ears who={name} />
      <Head who={name} />
      <FloppyEars who={name} />
      <Eyes mood={mood} />
      <Blush />
      <Nose y={kind === "cat" ? 89 : 88} />
      <Mouth kind={kind} mood={mood} />
      <Whiskers who={name} />
      {name === "mochi" ? <Accessory who="mochi" /> : null}
      {pose === "wave" ? <WavingPaw fur={p.fur} /> : null}
    </svg>
  );
}
