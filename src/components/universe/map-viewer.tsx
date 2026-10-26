"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { PanelBottomOpen, Pencil } from "lucide-react";
import { useEffect, useState } from "react";

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
import { currentMap, isBundled, STORAGE_KEY, useMapStore } from "@/store/map-store";

import {
  ConnectDialog,
  DeleteNodeDialog,
  EditToolbar,
  EmptyState,
  MapMenu,
  ModeToggle,
  StorageWarning,
  useAddNode,
  useUndoShortcuts,
} from "./editor-chrome";
import { EDGE_LABEL } from "./labels";
import { MapCanvas } from "./map-canvas";
import { MapHeader } from "./map-header";
import { MapPicker } from "./map-picker";
import { NavButtons, NodeDetail } from "./node-detail";
import { EdgeEditor, MapProblems, MapSettings, NodeEditor } from "./node-editor";
import { ThemeToggle } from "./theme-toggle";

const DETAIL_ID = "detalle";
// The viewport is what scrolls, so "Saltar al detalle" focuses it (arrows and PageDown then scroll).
const DETAIL_VIEWPORT = { id: DETAIL_ID, tabIndex: -1, "aria-label": "Detalle", "data-testid": "detail-panel" };

/** Skips the canvas nodes in the tab order and lands on the node detail. */
function SkipToDetail() {
  return (
    <a
      href={`#${DETAIL_ID}`}
      onClick={(event) => {
        const target = document.getElementById(DETAIL_ID);
        if (!target) return;
        event.preventDefault();
        target.focus();
      }}
      className="pointer-events-auto sr-only rounded-md border bg-background text-sm focus:not-sr-only focus:px-3 focus:py-2"
    >
      Saltar al detalle
    </a>
  );
}

function CanvasArea({ map, editing }: { map: SystemMap; editing: boolean }) {
  const mapId = useMapStore((s) => s.mapId);
  const [pending, setPending] = useState<{ from: string; to: string } | null>(null);
  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Header controls come first in the DOM so Tab reaches them before the nodes. */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-col-reverse items-start gap-2 sm:flex-row sm:justify-between">
        <div className="flex flex-col items-start gap-2">
          <SkipToDetail />
          <MapHeader map={map} editing={editing} example={isBundled(mapId)} />
        </div>
        <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1.5 self-end sm:self-auto">
          <MapPicker />
          <MapMenu />
          <ModeToggle />
          <ThemeToggle />
        </div>
      </div>
      {/* Remount per map so the initial fit and drag state start fresh. */}
      <MapCanvas key={mapId} map={map} onConnectRequest={(from, to) => setPending({ from, to })}>
        {editing && <EditToolbar />}
      </MapCanvas>
      {map.nodes.length === 0 && <EmptyState />}
      <ConnectDialog map={map} pending={pending} onClose={() => setPending(null)} />
      <DeleteNodeDialog map={map} />
    </div>
  );
}

function EmptyDetail() {
  return <div className="p-5 text-sm text-muted-foreground">Selecciona un nodo para ver su explicación.</div>;
}

/** Edit mode panel: the selected edge, the selected node or the map itself. */
function EditorPanel({ map, ctx }: { map: SystemMap; ctx: NodeContext | null }) {
  const selectedEdge = useMapStore((s) => s.selectedEdge);
  const addNode = useAddNode();
  return (
    <>
      <MapProblems map={map} />
      {selectedEdge !== null && map.edges[selectedEdge] ? (
        <EdgeEditor key={`edge-${selectedEdge}`} map={map} index={selectedEdge} />
      ) : ctx ? (
        <NodeEditor key={ctx.node.id} map={map} ctx={ctx} />
      ) : (
        <MapSettings map={map} onAddNode={addNode} />
      )}
    </>
  );
}

function MobileBar({ map, ctx, editing }: { map: SystemMap; ctx: NodeContext | null; editing: boolean }) {
  const [open, setOpen] = useState(false);
  const selectedEdge = useMapStore((s) => s.selectedEdge);
  const edge = selectedEdge !== null ? map.edges[selectedEdge] : undefined;
  const titles = new Map(map.nodes.map((n) => [n.id, n.title]));

  const eyebrow = edge ? `conexión · ${EDGE_LABEL[edge.type]}` : ctx ? positionLabel(ctx) : "mapa";
  const title = edge ? `${titles.get(edge.from)} → ${titles.get(edge.to)}` : ctx ? ctx.node.title : map.title;
  const summary = edge ? (edge.label ?? "") : ctx ? ctx.node.summary : `${map.nodes.length} nodos`;

  return (
    <div
      id={DETAIL_ID}
      tabIndex={-1}
      data-testid="mobile-bar"
      className="flex flex-col gap-2 border-t bg-background p-3 outline-none"
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-mono text-[11px] text-muted-foreground">{eyebrow}</p>
          <p data-testid="detail-title" className="truncate text-sm font-semibold">
            {title}
          </p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{summary}</p>
        </div>
        <Button variant="outline" className="h-10 shrink-0" onClick={() => setOpen(true)}>
          {editing ? (
            <>
              <Pencil /> Editar
            </>
          ) : (
            <>
              <PanelBottomOpen /> Detalle
            </>
          )}
        </Button>
      </div>
      {ctx && !editing && <NavButtons ctx={ctx} compact />}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85svh] gap-0 p-0"
          // Editing: don't focus the first field, it would pop up the keyboard over the form.
          onOpenAutoFocus={(event) => editing && event.preventDefault()}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{editing ? `Editar: ${title}` : title}</SheetTitle>
            <SheetDescription>{summary}</SheetDescription>
          </SheetHeader>
          <ScrollArea className="max-h-[85svh] overflow-y-auto">
            {editing ? (
              <div className="pt-10">
                <EditorPanel map={map} ctx={ctx} />
              </div>
            ) : (
              ctx && <NodeDetail map={map} ctx={ctx} inSheet />
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Editor() {
  const map = useMapStore(currentMap);
  const selectedId = useMapStore((s) => s.selectedId);
  const editing = useMapStore((s) => s.mode === "edit");
  const notice = useMapStore((s) => s.notice);
  const isMobile = useIsMobile();
  const ctx = selectedId ? getNodeContext(map, selectedId) : null;
  useUndoShortcuts();

  return (
    <main className="flex h-dvh w-full flex-col overflow-hidden">
      {/* Announces only the selected node, not the whole detail. */}
      <p className="sr-only" aria-live="polite" data-testid="selection-announcer">
        {ctx ? `${ctx.node.title}, ${positionLabel(ctx)}` : ""}
      </p>
      <p className="sr-only" role="status" data-testid="notice">
        {notice}
      </p>
      <StorageWarning />
      {isMobile ? (
        <>
          <div className="min-h-0 flex-1">
            <CanvasArea map={map} editing={editing} />
          </div>
          {(ctx || editing) && <MobileBar map={map} ctx={ctx} editing={editing} />}
        </>
      ) : (
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize="68" minSize="40">
            <CanvasArea map={map} editing={editing} />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize="32" minSize="22" maxSize="50">
            <ScrollArea
              className="h-full"
              viewportProps={DETAIL_VIEWPORT}
            >
              {editing ? <EditorPanel map={map} ctx={ctx} /> : ctx ? <NodeDetail map={map} ctx={ctx} /> : <EmptyDetail />}
            </ScrollArea>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </main>
  );
}

export function MapViewer() {
  const hydrated = useMapStore((s) => s.hydrated);
  // Read "Mis mapas" from localStorage after mount, so server and client render the same.
  useEffect(() => {
    void useMapStore.persist.rehydrate();
    // Another tab saved: take its maps so this tab doesn't overwrite them with an old copy.
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) useMapStore.getState().syncFromStorage(event.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Until then, a neutral screen: no flash of the desktop layout on mobile, nor of the wrong map.
  if (!hydrated) {
    return (
      <main className="h-dvh w-full bg-background" aria-busy="true">
        <p className="sr-only">Cargando…</p>
      </main>
    );
  }

  return (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  );
}
