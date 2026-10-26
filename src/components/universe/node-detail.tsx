"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { KIND_LABEL, positionLabel, type NodeContext } from "@/lib/graph";
import type { MapNode, SystemMap } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { useMapStore } from "@/store/map-store";

import { EDGE_LABEL } from "./labels";
import { Markdown } from "./markdown";
import { NodePreview } from "./node-preview";

export function NavButtons({ ctx, compact = false }: { ctx: NodeContext; compact?: boolean }) {
  const select = useMapStore((s) => s.select);
  const go = (node: MapNode | null) => node && select(node.id, { center: true });
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        data-testid="nav-prev"
        variant="outline"
        size={compact ? "sm" : "default"}
        className={cn("h-auto min-w-0 flex-col items-start gap-0.5 py-1.5", compact && "min-h-10 justify-center py-1")}
        disabled={!ctx.prev}
        onClick={() => go(ctx.prev)}
      >
        <span className={cn("flex items-center gap-1 text-[11px]", !compact && "text-muted-foreground")}>
          <ArrowLeft className="size-3" /> anterior
        </span>
        {!compact && <span className="w-full truncate text-left text-xs">{ctx.prev?.title ?? "—"}</span>}
      </Button>
      <Button
        data-testid="nav-next"
        variant="outline"
        size={compact ? "sm" : "default"}
        className={cn("h-auto min-w-0 flex-col items-end gap-0.5 py-1.5", compact && "min-h-10 justify-center py-1")}
        disabled={!ctx.next}
        onClick={() => go(ctx.next)}
      >
        <span className={cn("flex items-center gap-1 text-[11px]", !compact && "text-muted-foreground")}>
          siguiente <ArrowRight className="size-3" />
        </span>
        {!compact && <span className="w-full truncate text-right text-xs">{ctx.next?.title ?? "—"}</span>}
      </Button>
    </div>
  );
}

export function NodeDetail({
  map,
  ctx,
  inSheet = false,
}: {
  map: SystemMap;
  ctx: NodeContext;
  /** Inside the mobile Sheet: leave room for its close button. */
  inSheet?: boolean;
}) {
  const select = useMapStore((s) => s.select);
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const { node } = ctx;

  return (
    <article className="flex flex-col gap-5 p-5">
      <header className="flex flex-col gap-2">
        <div className={cn("flex items-center justify-between gap-2", inSheet && "pr-10")}>
          <span data-testid="detail-position" className="truncate font-mono text-[11px] text-muted-foreground">
            {positionLabel(ctx)}
          </span>
          <Badge
            variant="outline"
            className="shrink-0 font-normal"
          >
            {KIND_LABEL[ctx.kind]}
          </Badge>
        </div>
        <h2 data-testid="detail-title" className="text-lg font-semibold tracking-tight">
          {node.title}
        </h2>
        <p className="text-sm leading-relaxed text-foreground/80">{node.summary}</p>
      </header>

      {node.preview && <NodePreview preview={node.preview} size="panel" />}

      {node.details && <Markdown source={node.details} />}

      <Separator />

      <NavButtons ctx={ctx} />

      {ctx.connections.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Conexiones</h3>
          <div className="flex flex-wrap gap-1.5">
            {ctx.connections.map((c, i) => {
              const target = byId.get(c.id);
              if (!target) return null;
              return (
                <Button
                  key={`${c.id}-${i}`}
                  data-testid="connection-chip"
                  variant="outline"
                  size="xs"
                  className="max-w-full font-normal max-md:h-10 max-md:px-3"
                  title={`${EDGE_LABEL[c.type]}${c.label ? ` · ${c.label}` : ""}`}
                  onClick={() => select(c.id, { center: true })}
                >
                  {c.direction === "in" ? <ArrowLeft /> : <ArrowRight />}
                  <span className="truncate">{target.title}</span>
                  <span className="text-muted-foreground">· {EDGE_LABEL[c.type]}</span>
                </Button>
              );
            })}
          </div>
        </section>
      )}
    </article>
  );
}
