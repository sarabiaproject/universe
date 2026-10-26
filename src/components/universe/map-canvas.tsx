"use client";

import {
  Background,
  BackgroundVariant,
  MarkerType,
  ReactFlow,
  useReactFlow,
  type AriaLabelConfig,
  type Connection,
  type Edge,
  type EdgeMouseHandler,
  type NodeChange,
  type NodeMouseHandler,
} from "@xyflow/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { ZoomSlider } from "@/components/zoom-slider";
import { connectionError } from "@/lib/editor";
import { getMainPath, getNodeContext, positionLabel } from "@/lib/graph";
import { layoutMap, NODE_HEIGHT, NODE_WIDTH, type Point } from "@/lib/layout";
import type { EdgeType, SystemMap } from "@/lib/schema";
import { useMapStore } from "@/store/map-store";

import { EDGE_LABEL } from "./labels";
import { MapNode, type MapFlowNode } from "./map-node";

const nodeTypes = { map: MapNode };

const NARROW_WIDTH = 640;

// Nodes stay focusable; Enter/Space select them (see onKeyDown below).
const VIEW_LABELS: Partial<AriaLabelConfig> = {
  "node.a11yDescription.default": "Pulsa Enter o Espacio para ver el nodo en el detalle.",
  "node.a11yDescription.keyboardDisabled": "Pulsa Enter o Espacio para ver el nodo en el detalle.",
  "node.a11yDescription.ariaLiveMessage": ({ direction, x, y }) =>
    `Nodo movido hacia ${DIRECTION[direction] ?? direction}. Posición x: ${x}, y: ${y}`,
  "edge.a11yDescription.default": "Conexión entre dos nodos.",
  "handle.ariaLabel": "Conector",
};

const EDIT_LABELS: Partial<AriaLabelConfig> = {
  ...VIEW_LABELS,
  "node.a11yDescription.default":
    "Pulsa Enter o Espacio para editar el nodo, las flechas para moverlo y Suprimir para borrarlo.",
  "edge.a11yDescription.default": "Pulsa Enter o Espacio para editar la conexión y Suprimir para borrarla.",
};

const DIRECTION: Record<string, string> = { up: "arriba", down: "abajo", left: "la izquierda", right: "la derecha" };

const EDGE_STYLE: Record<EdgeType, React.CSSProperties> = {
  main: {},
  branch: { strokeDasharray: "5 4" },
  edge_case: { strokeDasharray: "1 4", strokeLinecap: "round", opacity: 0.7 },
};

const EDGE_ID = /^e(\d+)$/;

export function MapCanvas({
  map,
  onConnectRequest,
  children,
}: {
  map: SystemMap;
  /** Edit mode: a connection was dragged from one node to another. */
  onConnectRequest?: (from: string, to: string) => void;
  children?: React.ReactNode;
}) {
  const selectedId = useMapStore((s) => s.selectedId);
  const selectedEdge = useMapStore((s) => s.selectedEdge);
  const editing = useMapStore((s) => s.mode === "edit");
  const focusNonce = useMapStore((s) => s.focusNonce);
  const fitNonce = useMapStore((s) => s.fitNonce);
  const select = useMapStore((s) => s.select);
  const selectEdge = useMapStore((s) => s.selectEdge);
  const clearSelection = useMapStore((s) => s.clearSelection);
  const edit = useMapStore((s) => s.edit);
  const requestDeleteNode = useMapStore((s) => s.requestDeleteNode);
  const fitMainPath = useMapStore((s) => s.fitMainPath);
  const { fitView, setCenter, getZoom } = useReactFlow();

  const layout = useMemo(() => layoutMap(map), [map]);
  // Positions of the nodes being dragged; committed to the map (one undo step) on drop.
  const [dragged, setDragged] = useState<Record<string, Point>>({});
  const positions = useMemo(() => ({ ...layout, ...dragged }), [layout, dragged]);
  const mainPath = useMemo(() => getMainPath(map), [map]);
  const containerRef = useRef<HTMLDivElement>(null);
  // Once the person pans/zooms (or we center a node), stop auto-fitting on resize.
  const userMoved = useRef(false);

  /** Fits the whole map; narrow canvases start with the first main nodes only. */
  const fitOptions = useCallback(
    (full: boolean) => {
      const narrow = (containerRef.current?.clientWidth ?? Infinity) < NARROW_WIDTH;
      const ids = full || !narrow || mainPath.length === 0 ? map.nodes.map((n) => n.id) : mainPath.slice(0, 3);
      return { nodes: ids.map((id) => ({ id })), padding: 0.12, maxZoom: 1 };
    },
    [map, mainPath],
  );

  // Kind and position label only depend on the map, not on the selection.
  const contexts = useMemo(
    () => new Map(map.nodes.map((n) => [n.id, getNodeContext(map, n.id)])),
    [map],
  );

  const nodes = useMemo<MapFlowNode[]>(
    () =>
      map.nodes.map((node) => {
        const ctx = contexts.get(node.id);
        return {
          id: node.id,
          type: "map",
          ariaLabel: ctx ? `${node.title}, ${positionLabel(ctx)}` : node.title,
          position: positions[node.id],
          selected: node.id === selectedId,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          // Cards have a fixed size; controlled nodes need it as `measured` to be draggable.
          measured: { width: NODE_WIDTH, height: NODE_HEIGHT },
          data: { node, kind: ctx?.kind ?? "branch", editing },
        };
      }),
    [contexts, map, positions, selectedId, editing],
  );

  const edges = useMemo<Edge[]>(() => {
    const titles = new Map(map.nodes.map((n) => [n.id, n.title]));
    return map.edges.map((e, i) => {
      const picked = i === selectedEdge;
      const active = picked || e.from === selectedId || e.to === selectedId;
      const color = active ? "var(--highlight)" : "var(--edge)";
      return {
        id: `e${i}`,
        source: e.from,
        target: e.to,
        type: "smoothstep",
        label: e.label,
        ariaLabel: `Conexión de ${titles.get(e.from)} a ${titles.get(e.to)}, ${EDGE_LABEL[e.type]}`,
        labelStyle: { fontSize: 10, fill: "var(--muted-foreground)" },
        labelBgStyle: { fill: "var(--background)" },
        labelBgPadding: [4, 2] as [number, number],
        pathOptions: { borderRadius: 12 },
        zIndex: active ? 1 : 0,
        style: {
          ...EDGE_STYLE[e.type],
          stroke: color,
          strokeWidth: picked ? 2.5 : active ? 1.5 : 1,
        },
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color },
        data: { type: e.type },
      };
    });
  }, [map, selectedId, selectedEdge]);

  const onNodeClick = useCallback<NodeMouseHandler<MapFlowNode>>((_, node) => select(node.id), [select]);

  const onEdgeClick = useCallback<EdgeMouseHandler>(
    (_, edge) => {
      const index = Number(EDGE_ID.exec(edge.id)?.[1]);
      if (editing && Number.isInteger(index)) selectEdge(index);
    },
    [editing, selectEdge],
  );

  // Dragging updates `dragged`; the drop (or a keyboard arrow move) commits to the map.
  const dragging = useRef(false);
  const onNodesChange = useCallback(
    (changes: NodeChange<MapFlowNode>[]) => {
      const moved: Record<string, Point> = {};
      for (const change of changes) {
        if (change.type !== "position" || !change.position) continue;
        moved[change.id] = change.position;
      }
      const ids = Object.keys(moved);
      if (ids.length === 0) return;
      if (changes.some((c) => c.type === "position" && c.dragging)) {
        dragging.current = true;
        setDragged((prev) => ({ ...prev, ...moved }));
        return;
      }
      // Each drag is its own undo step; repeated arrow presses on a node merge into one.
      const key = dragging.current ? undefined : `move:${ids.join(",")}`;
      dragging.current = false;
      edit({ type: "moveNodes", positions: moved }, { key });
      setDragged({});
    },
    [edit],
  );

  const onConnect = useCallback(
    (connection: Connection) => onConnectRequest?.(connection.source, connection.target),
    [onConnectRequest],
  );
  const isValidConnection = useCallback(
    (c: Connection | Edge) => connectionError(map, c.source, c.target) === null,
    [map],
  );

  // Keyboard: Enter/Space select the focused node (or edge); in edit mode Delete removes it.
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const el = event.target as Element;
      const id = el.getAttribute("data-id");
      if (!id) return;
      const isNode = el.classList.contains("react-flow__node");
      const isEdge = el.classList.contains("react-flow__edge");
      const edgeIndex = Number(EDGE_ID.exec(id)?.[1]);
      if (event.key === "Enter" || event.key === " ") {
        if (isNode) select(id);
        else if (isEdge && editing) selectEdge(edgeIndex);
        else return;
        event.preventDefault();
      } else if (editing && (event.key === "Delete" || event.key === "Backspace")) {
        if (isNode) requestDeleteNode(id);
        else if (isEdge) edit({ type: "deleteEdge", index: edgeIndex });
        else return;
        event.preventDefault();
      }
    },
    [editing, edit, requestDeleteNode, select, selectEdge],
  );

  // Center on the selected node when asked (chips, prev/next, new nodes).
  const lastFocus = useRef(focusNonce);
  useEffect(() => {
    if (focusNonce === lastFocus.current || !selectedId) return;
    const p = positions[selectedId];
    if (!p) return;
    lastFocus.current = focusNonce;
    userMoved.current = true;
    setCenter(p.x + NODE_WIDTH / 2, p.y + NODE_HEIGHT / 2, {
      zoom: Math.max(getZoom(), 0.75),
      duration: 400,
    });
  }, [focusNonce, selectedId, positions, setCenter, getZoom]);

  // After a delete, focus a neighbour (or the canvas) so keyboard users keep their place.
  const refocus = useMapStore((s) => s.refocus);
  const lastRefocus = useRef(refocus.nonce);
  useEffect(() => {
    if (refocus.nonce === lastRefocus.current) return;
    lastRefocus.current = refocus.nonce;
    const frame = requestAnimationFrame(() => {
      const container = containerRef.current;
      const target = refocus.nodeId
        ? container?.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(refocus.nodeId)}"]`)
        : null;
      (target ?? container)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [refocus]);

  // Fit the map when asked ("Ajustar", map change).
  const lastFit = useRef(fitNonce);
  useEffect(() => {
    if (fitNonce === lastFit.current) return;
    lastFit.current = fitNonce;
    userMoved.current = false;
    // Wait a frame so freshly mounted nodes are measured.
    const frame = requestAnimationFrame(() => fitView({ ...fitOptions(true), duration: 300 }));
    return () => cancelAnimationFrame(frame);
  }, [fitNonce, fitOptions, fitView]);

  // The canvas size settles after mount (resizable panels, mobile bars), so
  // keep the initial fit until the person moves the viewport themselves.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (!userMoved.current) fitView(fitOptions(false));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fitOptions, fitView]);

  // Only read on mount; later fits go through `fitOptions`.
  const [initialFit] = useState(() => ({
    nodes: map.nodes.map((n) => ({ id: n.id })),
    padding: 0.12,
    maxZoom: 1,
  }));

  const onMoveStart = useCallback((event: MouseEvent | TouchEvent | null) => {
    if (event) userMoved.current = true;
  }, []);

  // The resizable panels get their size right after the first client render; mount
  // React Flow once the container has one, so its initial fit uses the real size.
  const [sized, setSized] = useState(false);
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || sized) return;
    const check = () => el.clientWidth > 0 && el.clientHeight > 0 && setSized(true);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [sized]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-foreground"
      onKeyDown={onKeyDown}
      // Focus target after deleting the last node (see refocus above).
      tabIndex={-1}
      role="group"
      aria-label="Lienzo del mapa"
    >
      {sized && (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={editing ? clearSelection : undefined}
          onNodesChange={editing ? onNodesChange : undefined}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          onMoveStart={onMoveStart}
          nodesDraggable={editing}
          nodesConnectable={editing}
          edgesFocusable={editing}
          elementsSelectable={false}
          deleteKeyCode={null}
          zoomOnDoubleClick={!editing}
          fitView
          fitViewOptions={initialFit}
          minZoom={0.1}
          maxZoom={2}
          aria-label={editing ? "Mapa del sistema (edición)" : "Mapa del sistema"}
          ariaLabelConfig={editing ? EDIT_LABELS : VIEW_LABELS}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--grid)" />
          <ZoomSlider position="bottom-left" onFit={fitMainPath} />
          {children}
        </ReactFlow>
      )}
    </div>
  );
}
