"use client";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, ArrowRight, Eye, EyeOff, GripVertical, Maximize2, Minimize2, Pin, PinOff, RotateCcw, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useId, useState, useTransition, type ReactNode } from "react";
import { Button, cn } from "@lyra/ui";
import { saveDashboardLayoutAction } from "@/features/dashboard/actions";
import { moveTile, normaliseLayout, toggle, visibleTiles, type Layout, type TileId } from "@/features/dashboard/layout";

export type TileView = { title: string; href: string; action: string; tint: string; node: ReactNode };

/**
 * The business dashboard board (ADR 0003): tiles can be dragged (mouse,
 * touch with a short press, or keyboard on the handle), widened, pinned and
 * hidden; the layout is saved per person. Every tile also works as a plain
 * link, so dragging is never the only way in.
 */
export function Board({ slug, initial, tiles }: { slug: string; initial: Layout; tiles: Partial<Record<TileId, TileView>> }) {
  const available = (Object.keys(tiles) as TileId[]).filter((t) => tiles[t]);
  const [layout, setLayout] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [, startTransition] = useTransition();
  // A stable id keeps dnd-kit's accessibility ids identical on the server and the client.
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const shown = visibleTiles(layout).filter((t) => available.includes(t));
  const hidden = layout.hidden.filter((t) => available.includes(t));

  function update(next: Layout) {
    setLayout(next);
    setStatus("saving");
    startTransition(async () => {
      const r = await saveDashboardLayoutAction(slug, next);
      setStatus(r.ok ? "saved" : "error");
    });
  }
  function onDragEnd(e: DragEndEvent) {
    if (e.over && e.active.id !== e.over.id) update(moveTile(layout, e.active.id as TileId, e.over.id as TileId));
  }
  const neighbour = (id: TileId, step: -1 | 1) => shown[shown.indexOf(id) + step];

  return (
    <section aria-labelledby="board-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="board-title" className="font-display text-2xl font-semibold text-ink">
          Your board
        </h2>
        <div className="flex items-center gap-3">
          <p aria-live="polite" className="text-xs text-muted">
            {status === "saving" ? "Saving your layout…" : status === "saved" ? "Layout saved" : status === "error" ? "Couldn't save your layout. Try again." : ""}
          </p>
          {editing ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => update(normaliseLayout({}))}>
              <RotateCcw aria-hidden /> Reset
            </Button>
          ) : null}
          <Button type="button" variant={editing ? "primary" : "secondary"} size="sm" aria-pressed={editing} onClick={() => setEditing(!editing)}>
            <SlidersHorizontal aria-hidden /> {editing ? "Done" : "Customise"}
          </Button>
        </div>
      </div>
      {editing && hidden.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed border-border p-3">
          <span className="text-sm text-muted">Hidden tiles:</span>
          {hidden.map((t) => (
            <Button key={t} type="button" variant="secondary" size="sm" onClick={() => update({ ...layout, hidden: toggle(layout.hidden, t) })}>
              <Eye aria-hidden /> Show {tiles[t]?.title}
            </Button>
          ))}
        </div>
      ) : null}
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={shown} strategy={rectSortingStrategy}>
          <ul className="grid grid-flow-dense gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((id) => {
              const t = tiles[id];
              if (!t) return null;
              const before = neighbour(id, -1);
              const after = neighbour(id, 1);
              return (
                <SortableTile key={id} id={id} tile={t} wide={layout.sizes[id] === "l"} pinned={layout.pinned.includes(id)}>
                  {editing ? (
                    <div className="relative z-10 flex flex-wrap gap-1.5 border-t border-ink/10 pt-3">
                      <IconButton label={layout.pinned.includes(id) ? `Unpin ${t.title}` : `Pin ${t.title}`} onClick={() => update({ ...layout, pinned: toggle(layout.pinned, id) })}>
                        {layout.pinned.includes(id) ? <PinOff /> : <Pin />}
                      </IconButton>
                      <IconButton label={layout.sizes[id] === "l" ? `Make ${t.title} narrower` : `Make ${t.title} wider`} onClick={() => update({ ...layout, sizes: { ...layout.sizes, [id]: layout.sizes[id] === "l" ? "s" : "l" } })}>
                        {layout.sizes[id] === "l" ? <Minimize2 /> : <Maximize2 />}
                      </IconButton>
                      <IconButton label={`Move ${t.title} earlier`} disabled={!before} onClick={() => before && update(moveTile(layout, id, before))}>
                        <ArrowLeft />
                      </IconButton>
                      <IconButton label={`Move ${t.title} later`} disabled={!after} onClick={() => after && update(moveTile(layout, id, after))}>
                        <ArrowRight />
                      </IconButton>
                      <IconButton label={`Hide ${t.title}`} onClick={() => update({ ...layout, hidden: toggle(layout.hidden, id) })}>
                        <EyeOff />
                      </IconButton>
                    </div>
                  ) : null}
                </SortableTile>
              );
            })}
          </ul>
        </SortableContext>
      </DndContext>
    </section>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="grid size-11 place-items-center rounded-full bg-surface/80 text-ink transition-colors hover:bg-surface disabled:opacity-40 [&_svg]:size-4">
      {children}
    </button>
  );
}

function SortableTile({ id, tile, wide, pinned, children }: { id: TileId; tile: TileView; wide: boolean; pinned: boolean; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("lift relative flex flex-col gap-3 overflow-hidden rounded-[var(--radius-card)] p-5 shadow-[var(--shadow-card)]", tile.tint, wide && "sm:col-span-2", isDragging && "z-20 scale-[1.02] shadow-[var(--shadow-lift)]")}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-xl font-semibold text-ink">
          <Link href={tile.href} className="hover:underline">
            {tile.title}
          </Link>
          {pinned ? <Pin className="ml-1.5 inline size-4 text-ink/60" aria-label="Pinned" /> : null}
        </h3>
        <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Drag ${tile.title} to move it`} className="grid size-11 shrink-0 cursor-grab touch-none place-items-center rounded-full text-ink/60 hover:bg-surface/70 hover:text-ink active:cursor-grabbing">
          <GripVertical className="size-5" aria-hidden />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-3">{tile.node}</div>
      <Link href={tile.href} className="relative z-10 inline-flex min-h-11 items-center gap-1 self-start rounded-full bg-surface/80 px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface">
        {tile.action} <ArrowRight className="size-4" aria-hidden />
      </Link>
      {children}
    </li>
  );
}
