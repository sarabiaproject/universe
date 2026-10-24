"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { PanelBottomOpen } from "lucide-react";
import { useState } from "react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { getNodeContext, positionLabel, type NodeContext } from "@/lib/graph";
import type { SystemMap } from "@/lib/schema";
import { BUNDLED_MAPS } from "@/maps";
import { useMapStore } from "@/store/map-store";

import { MapCanvas } from "./map-canvas";
import { MapHeader } from "./map-header";
import { MapPicker } from "./map-picker";
import { NavButtons, NodeDetail } from "./node-detail";
import { ThemeToggle } from "./theme-toggle";

function CanvasArea({ map }: { map: SystemMap }) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      {map.nodes.length === 0 ? (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Este mapa no tiene nodos todavía.
        </div>
      ) : (
        <MapCanvas map={map} />
      )}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-col-reverse items-start gap-2 sm:flex-row sm:justify-between">
        <MapHeader map={map} />
        <div className="pointer-events-auto flex items-center gap-1.5 self-end sm:self-auto">
          <MapPicker />
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

function EmptyDetail() {
  return (
    <div className="p-5 text-sm text-muted-foreground">
      Selecciona un nodo para ver su explicación.
    </div>
  );
}

function MobileBar({ map, ctx }: { map: SystemMap; ctx: NodeContext }) {
  const [open, setOpen] = useState(false);
  return (
    <div data-testid="mobile-bar" className="flex flex-col gap-2 border-t bg-background p-3">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-mono text-[11px] text-muted-foreground">{positionLabel(ctx)}</p>
          <p data-testid="detail-title" className="truncate text-sm font-semibold">
            {ctx.node.title}
          </p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{ctx.node.summary}</p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" onClick={() => setOpen(true)}>
          <PanelBottomOpen /> Detalle
        </Button>
      </div>
      <NavButtons ctx={ctx} compact />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85svh] gap-0 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>{ctx.node.title}</SheetTitle>
            <SheetDescription>{ctx.node.summary}</SheetDescription>
          </SheetHeader>
          <ScrollArea className="max-h-[85svh] overflow-y-auto">
            <NodeDetail map={map} ctx={ctx} />
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function MapViewer() {
  const mapId = useMapStore((s) => s.mapId);
  const selectedId = useMapStore((s) => s.selectedId);
  const isMobile = useIsMobile();
  const map = (BUNDLED_MAPS.find((m) => m.id === mapId) ?? BUNDLED_MAPS[0]).map;
  const ctx = selectedId ? getNodeContext(map, selectedId) : null;

  return (
    <ReactFlowProvider>
      <main className="flex h-dvh w-full flex-col overflow-hidden">
        {isMobile ? (
          <>
            <div className="min-h-0 flex-1">
              <CanvasArea map={map} />
            </div>
            {ctx && <MobileBar map={map} ctx={ctx} />}
          </>
        ) : (
          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel defaultSize="68" minSize="40">
              <CanvasArea map={map} />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize="32" minSize="22" maxSize="50">
              <ScrollArea data-testid="detail-panel" className="h-full">
                {ctx ? <NodeDetail map={map} ctx={ctx} /> : <EmptyDetail />}
              </ScrollArea>
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </main>
    </ReactFlowProvider>
  );
}
