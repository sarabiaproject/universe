"use client";

import { Panel, useReactFlow } from "@xyflow/react";
import {
  Copy,
  Eye,
  FileDown,
  FileUp,
  FilePlus2,
  ImageDown,
  MoreHorizontal,
  Pencil,
  Plus,
  Redo2,
  Trash2,
  TextCursorInput,
  TriangleAlert,
  Undo2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { createNode, freeSpot, suggestedEdgeType } from "@/lib/editor";
import { layoutMap, NODE_HEIGHT, NODE_WIDTH } from "@/lib/layout";
import { SystemMapDraftSchema, type EdgeType, type SystemMap } from "@/lib/schema";
import { currentMap, isReadOnly, useMapStore } from "@/store/map-store";

import { EDGE_HINT, EDGE_LABEL } from "./labels";
import { exportJson, exportPng, ImportDialog } from "./share-chrome";

const subscribeNoop = () => () => {};

/** "⌘" on Apple platforms, "Ctrl" elsewhere. */
function useModKey() {
  return useSyncExternalStore(
    subscribeNoop,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+"),
    () => "⌘",
  );
}

/** Adds an empty node in the middle of the visible canvas, on a free spot. */
export function useAddNode() {
  const { screenToFlowPosition } = useReactFlow();
  const edit = useMapStore((s) => s.edit);
  return useCallback(() => {
    const map = currentMap(useMapStore.getState());
    const rect = document.querySelector(".react-flow")?.getBoundingClientRect();
    const center = rect
      ? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      : { x: 0, y: 0 };
    const spot = freeSpot(Object.values(layoutMap(map)), {
      x: center.x - NODE_WIDTH / 2,
      y: center.y - NODE_HEIGHT / 2,
    });
    edit({ type: "addNode", node: createNode(map, spot) });
  }, [edit, screenToFlowPosition]);
}

function isTextField(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/** ⌘Z / ⇧⌘Z (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y elsewhere) in edit mode. Text fields keep their own undo. */
export function useUndoShortcuts() {
  const editing = useMapStore((s) => s.mode === "edit");
  useEffect(() => {
    if (!editing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || isTextField(event.target)) return;
      const key = event.key.toLowerCase();
      const { undo, redo } = useMapStore.getState();
      if (key === "z" && !event.shiftKey) undo();
      else if ((key === "z" && event.shiftKey) || (key === "y" && event.ctrlKey)) redo();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editing]);
}

function ToolButton({
  label,
  shortcut,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { label: string; shortcut?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="max-md:size-10" aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && <span className="ml-1.5 opacity-70">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

/** Floating toolbar in edit mode: add node, undo, redo. */
export function EditToolbar() {
  const canUndo = useMapStore((s) => s.history.past.length > 0);
  const canRedo = useMapStore((s) => s.history.future.length > 0);
  const undo = useMapStore((s) => s.undo);
  const redo = useMapStore((s) => s.redo);
  const addNode = useAddNode();
  const mod = useModKey();
  return (
    <Panel
      position="bottom-right"
      className="!mb-7 flex items-center gap-0.5 rounded-lg border bg-background p-0.5 max-md:flex-col"
      aria-label="Herramientas de edición"
      role="toolbar"
    >
      <Button variant="ghost" size="sm" className="max-md:size-10 max-md:px-0" onClick={addNode} data-testid="add-node">
        <Plus />
        <span className="max-md:sr-only">Añadir nodo</span>
      </Button>
      <ToolButton label="Deshacer" shortcut={`${mod}Z`} onClick={undo} disabled={!canUndo}>
        <Undo2 />
      </ToolButton>
      <ToolButton label="Rehacer" shortcut={mod === "⌘" ? "⇧⌘Z" : "Ctrl+Y"} onClick={redo} disabled={!canRedo}>
        <Redo2 />
      </ToolButton>
    </Panel>
  );
}

/** Empty map: invites to create the first node. Rendered over the canvas. */
export function EmptyState() {
  const editing = useMapStore((s) => s.mode === "edit");
  const setMode = useMapStore((s) => s.setMode);
  const addNode = useAddNode();
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center p-6">
      <div
        data-testid="empty-state"
        className="pointer-events-auto flex max-w-xs flex-col items-center gap-3 rounded-xl border border-dashed bg-background/90 p-6 text-center backdrop-blur-sm"
      >
        <div className="flex size-10 items-center justify-center rounded-full border">
          <Plus className="size-4 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">Este mapa está vacío</h2>
          <p className="text-xs text-muted-foreground">
            Crea el primer nodo: será el inicio del camino principal. Después añade pasos y ramas.
          </p>
        </div>
        {editing ? (
          <Button onClick={addNode} className="max-md:h-10" data-testid="create-first-node">
            <Plus /> Crear el primer nodo
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setMode("edit")} className="max-md:h-10">
            <Pencil /> Editar el mapa
          </Button>
        )}
      </div>
    </div>
  );
}

/** Picks the type of a connection dragged on the canvas. */
export function ConnectDialog({
  map,
  pending,
  onClose,
}: {
  map: SystemMap;
  pending: { from: string; to: string } | null;
  onClose: () => void;
}) {
  const edit = useMapStore((s) => s.edit);
  const title = (id: string | undefined) => map.nodes.find((n) => n.id === id)?.title ?? "";
  const suggested = pending ? suggestedEdgeType(map, pending.from, pending.to) : "branch";
  const choose = (type: EdgeType) => {
    if (pending) edit({ type: "addEdge", edge: { from: pending.from, to: pending.to, type } });
    onClose();
  };
  return (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="connect-dialog">
        <DialogHeader>
          <DialogTitle>Nueva conexión</DialogTitle>
          <DialogDescription>
            De «{title(pending?.from)}» a «{title(pending?.to)}». ¿Qué tipo de conexión es?
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {(["main", "branch", "edge_case"] as const).map((type) => (
            <Button
              key={type}
              variant={type === suggested ? "default" : "outline"}
              className="h-auto flex-col items-start gap-0.5 py-2 text-left"
              autoFocus={type === suggested}
              onClick={() => choose(type)}
            >
              <span className="capitalize">{EDGE_LABEL[type]}</span>
              <span className="text-xs font-normal whitespace-normal opacity-80">{EDGE_HINT[type]}</span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Visible warning about saving: blocked or full storage, or a backup of unreadable maps. */
export function StorageWarning() {
  const warning = useMapStore((s) => s.storageWarning);
  const dismiss = useMapStore((s) => s.dismissStorageWarning);
  if (!warning) return null;
  return (
    <div
      role="status"
      data-testid="storage-warning"
      className="flex items-start gap-2 border-b bg-muted px-3 py-1.5 text-xs text-foreground"
    >
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden />
      <p className="min-w-0 flex-1 py-1">{warning}</p>
      <Button variant="ghost" size="icon-sm" className="max-md:size-10" aria-label="Cerrar aviso" onClick={dismiss}>
        <X />
      </Button>
    </div>
  );
}

/** Confirms deleting a node that has connections. */
export function DeleteNodeDialog({ map }: { map: SystemMap }) {
  const id = useMapStore((s) => s.confirmDeleteId);
  const confirm = useMapStore((s) => s.confirmDelete);
  const cancel = useMapStore((s) => s.cancelDelete);
  const mod = useModKey();
  const node = map.nodes.find((n) => n.id === id);
  const count = map.edges.filter((e) => e.from === id || e.to === id).length;
  const confirmed = useRef(false);
  return (
    <AlertDialog open={Boolean(node)} onOpenChange={(open) => !open && cancel()}>
      {/* On confirm the canvas focuses a neighbour; don't send focus back to the deleted node. */}
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          if (confirmed.current) event.preventDefault();
          confirmed.current = false;
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>¿Borrar «{node?.title}»?</AlertDialogTitle>
          <AlertDialogDescription>
            También se {count === 1 ? "borrará su conexión" : `borrarán sus ${count} conexiones`}. Puedes deshacerlo con{" "}
            {mod}Z.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              confirmed.current = true;
              confirm();
            }}
          >
            Borrar nodo
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Ver / Editar. On an example, "Editar" works on a copy. */
export function ModeToggle() {
  const mode = useMapStore((s) => s.mode);
  const setMode = useMapStore((s) => s.setMode);
  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      value={mode}
      onValueChange={(v) => (v === "view" || v === "edit") && setMode(v)}
      aria-label="Modo"
      data-testid="mode-toggle"
      className="bg-background"
    >
      <ToggleGroupItem value="view" aria-label="Ver" className="max-md:h-10 max-md:min-w-10">
        <Eye />
        <span className="max-sm:hidden">Ver</span>
      </ToggleGroupItem>
      <ToggleGroupItem value="edit" aria-label="Editar" className="max-md:h-10 max-md:min-w-10">
        <Pencil />
        <span className="max-sm:hidden">Editar</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

/** New, duplicate, rename, delete, import and export maps. */
export function MapMenu() {
  const mapId = useMapStore((s) => s.mapId);
  const createMap = useMapStore((s) => s.createMap);
  const duplicateMap = useMapStore((s) => s.duplicateMap);
  const renameMap = useMapStore((s) => s.renameMap);
  const deleteMap = useMapStore((s) => s.deleteMap);
  const title = useMapStore((s) => currentMap(s).title);
  const empty = useMapStore((s) => currentMap(s).nodes.length === 0);
  const bundled = isReadOnly(mapId);
  const [dialog, setDialog] = useState<"rename" | "delete" | "import" | null>(null);
  const [name, setName] = useState("");
  const nameError = dialog === "rename" ? checkTitle(name) : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon-sm"
            className="bg-background max-md:size-10"
            aria-label="Acciones del mapa"
            data-testid="map-menu"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => createMap()}>
            <FilePlus2 /> Nuevo mapa
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => duplicateMap()}>
            <Copy /> {bundled ? "Duplicar para editar" : "Duplicar"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("import")}>
            <FileUp /> Importar JSON…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => exportJson(currentMap(useMapStore.getState()))}>
            <FileDown /> Exportar JSON
          </DropdownMenuItem>
          <DropdownMenuItem disabled={empty} onSelect={() => void exportPng(currentMap(useMapStore.getState()))}>
            <ImageDown /> Exportar PNG
          </DropdownMenuItem>
          {!bundled && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  setName(title);
                  setDialog("rename");
                }}
              >
                <TextCursorInput /> Renombrar…
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
                <Trash2 /> Borrar mapa…
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "rename"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (nameError) return;
              renameMap(mapId, name);
              setDialog(null);
            }}
          >
            <DialogHeader>
              <DialogTitle>Renombrar mapa</DialogTitle>
              <DialogDescription>El nombre aparece en el selector y en el encabezado.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rename-map">Nombre</Label>
              <Input
                id="rename-map"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? "rename-map-error" : undefined}
                autoComplete="off"
              />
              {nameError && (
                <p id="rename-map-error" role="alert" className="text-xs text-destructive">
                  {nameError}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={Boolean(nameError)}>
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ImportDialog open={dialog === "import"} onOpenChange={(open) => setDialog(open ? "import" : null)} />

      <AlertDialog open={dialog === "delete"} onOpenChange={(open) => !open && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar «{title}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrará de este navegador con todos sus nodos. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleteMap(mapId)}>
              Borrar mapa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function checkTitle(value: string): string | null {
  const result = SystemMapDraftSchema.shape.title.safeParse(value);
  return result.success ? null : (result.error.issues[0]?.message ?? "Nombre inválido");
}
