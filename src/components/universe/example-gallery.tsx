"use client";

import { useMemo, useRef } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getMainPath } from "@/lib/graph";
import { layoutMap, NODE_HEIGHT, NODE_WIDTH } from "@/lib/layout";
import type { SystemMap } from "@/lib/schema";
import { BUNDLED_MAPS } from "@/maps";
import { useMapStore } from "@/store/map-store";

const THUMB = { width: 120, height: 44, pad: 4 };

/** The map's shape in miniature: main path as a solid line of dots, branches dimmer. */
function MapThumbnail({ map }: { map: SystemMap }) {
  const shape = useMemo(() => {
    const pos = layoutMap(map);
    const centers = Object.fromEntries(
      Object.entries(pos).map(([id, p]) => [id, { x: p.x + NODE_WIDTH / 2, y: p.y + NODE_HEIGHT / 2 }]),
    );
    const xs = Object.values(centers).map((c) => c.x);
    const ys = Object.values(centers).map((c) => c.y);
    const [minX, minY] = [Math.min(...xs), Math.min(...ys)];
    const scale = Math.min(
      (THUMB.width - THUMB.pad * 2) / Math.max(Math.max(...xs) - minX, 1),
      (THUMB.height - THUMB.pad * 2) / Math.max(Math.max(...ys) - minY, 1),
    );
    const at = (id: string) => ({
      x: THUMB.pad + (centers[id].x - minX) * scale,
      y: THUMB.pad + (centers[id].y - minY) * scale,
    });
    const main = new Set(getMainPath(map));
    return {
      edges: map.edges.map((e) => ({ a: at(e.from), b: at(e.to), main: e.type === "main" })),
      nodes: map.nodes.map((n) => ({ ...at(n.id), main: main.has(n.id) })),
    };
  }, [map]);

  return (
    <svg
      viewBox={`0 0 ${THUMB.width} ${THUMB.height}`}
      className="h-11 w-full text-muted-foreground"
      aria-hidden
    >
      {shape.edges.map((e, i) => (
        <line
          key={i}
          x1={e.a.x}
          y1={e.a.y}
          x2={e.b.x}
          y2={e.b.y}
          stroke="currentColor"
          strokeWidth={1}
          strokeDasharray={e.main ? undefined : "2 2"}
          opacity={e.main ? 0.9 : 0.5}
        />
      ))}
      {shape.nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r={n.main ? 2.5 : 2} fill="currentColor" opacity={n.main ? 1 : 0.55} />
      ))}
    </svg>
  );
}

/**
 * Gallery of the bundled example maps: a card per map (title, one line, size).
 * Picking one opens it (examples always open in view mode). On close, focus goes to the first
 * `returnFocus` selector that still matches an element.
 */
export function ExampleGallery({
  open,
  onOpenChange,
  returnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocus: string[];
}) {
  const mapId = useMapStore((s) => s.mapId);
  const setMap = useMapStore((s) => s.setMap);
  const content = useRef<HTMLDivElement>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={content}
        data-testid="example-gallery"
        className="max-h-[90svh] overflow-y-auto sm:max-w-xl"
        // Focus the dialog, not the first card: when Enter opens it (the "Ver todos los ejemplos…"
        // option), the key's default click would otherwise land on that card and switch maps (B1).
        // Tab then reaches the cards in order.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          content.current?.focus();
        }}
        // Opened from a menu or a select that are gone by now: give focus back to a control that stays.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          for (const selector of returnFocus) {
            const target = document.querySelector<HTMLElement>(selector);
            if (target) return target.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Ejemplos</DialogTitle>
          <DialogDescription>
            Mapas de solo lectura para explorar. Ábrelos y pulsa Editar para trabajar sobre una copia.
          </DialogDescription>
        </DialogHeader>
        <ul className="grid min-w-0 gap-2 sm:grid-cols-2" aria-label="Mapas de ejemplo">
          {BUNDLED_MAPS.map(({ id, description, map }) => {
            const current = id === mapId;
            return (
              <li key={id} className="min-w-0">
                <button
                  type="button"
                  data-testid={`example-${id}`}
                  aria-current={current ? "true" : undefined}
                  aria-label={`Abrir ${map.title}: ${description} ${map.nodes.length} nodos.`}
                  onClick={() => {
                    setMap(id);
                    onOpenChange(false);
                  }}
                  className="flex h-full w-full min-w-0 flex-col gap-2 rounded-lg border bg-card p-3 text-left transition-colors outline-none hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-foreground aria-[current=true]:border-foreground/40"
                >
                  <MapThumbnail map={map} />
                  <span className="flex min-w-0 items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{map.title}</span>
                    {current && (
                      <Badge variant="secondary" className="shrink-0">
                        Abierto
                      </Badge>
                    )}
                  </span>
                  <span className="text-xs leading-snug text-muted-foreground">{description}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{map.nodes.length} nodos</span>
                </button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
