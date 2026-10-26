"use client";

import {
  Background,
  BackgroundVariant,
  MarkerType,
  ReactFlow,
  useReactFlow,
  type AriaLabelConfig,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { ZoomSlider } from "@/components/zoom-slider";
import { getMainPath, getNodeContext, positionLabel } from "@/lib/graph";
import { layoutMap, NODE_HEIGHT, NODE_WIDTH } from "@/lib/layout";
import type { EdgeType, SystemMap } from "@/lib/schema";
import { useMapStore } from "@/store/map-store";

import { MapNode, type MapFlowNode } from "./map-node";

const nodeTypes = { map: MapNode };

const NARROW_WIDTH = 640;

// Nodes stay focusable; Enter/Space select them (see onKeyDown below).
const ARIA_LABELS: Partial<AriaLabelConfig> = {
  "node.a11yDescription.default": "Pulsa Enter o Espacio para ver el nodo en el detalle.",
  "node.a11yDescription.keyboardDisabled": "Pulsa Enter o Espacio para ver el nodo en el detalle.",
  "handle.ariaLabel": "Conector",
};

const EDGE_STYLE: Record<EdgeType, React.CSSProperties> = {
  main: {},
  branch: { strokeDasharray: "5 4" },
  edge_case: { strokeDasharray: "1 4", strokeLinecap: "round", opacity: 0.7 },
};

export function MapCanvas({
  map,
  children,
}: {
  map: SystemMap;
  children?: React.ReactNode;
}) {
  const selectedId = useMapStore((s) => s.selectedId);
  const focusNonce = useMapStore((s) => s.focusNonce);
  const fitNonce = useMapStore((s) => s.fitNonce);
  const select = useMapStore((s) => s.select);
  const fitMainPath = useMapStore((s) => s.fitMainPath);
  const { fitView, setCenter, getZoom } = useReactFlow();

  const positions = useMemo(() => layoutMap(map), [map]);
  const mainPath = useMemo(() => getMainPath(map), [map]);
  const containerRef = useRef<HTMLDivElement>(null);
  // Once the person pans/zooms (or we center a node), stop auto-fitting on resize.
  const userMoved = useRef(false);

  /** Fits the main path; narrow canvases start with its first nodes only. */
  const fitOptions = useCallback(
    (full: boolean) => {
      const narrow =
        (containerRef.current?.clientWidth ?? Infinity) < NARROW_WIDTH;
      const ids = full || !narrow ? mainPath : mainPath.slice(0, 3);
      return { nodes: ids.map((id) => ({ id })), padding: 0.12, maxZoom: 1 };
    },
    [mainPath],
  );

  // Kind and position label only depend on the map, not on the selection.
  const contexts = useMemo(
    () => new Map(map.nodes.map((n) => [n.id, getNodeContext(map, n.id)])),
    [map],
  );

  const related = useMemo(() => {
    const ids = new Set<string>();
    for (const e of map.edges) {
      if (e.from === selectedId) ids.add(e.to);
      if (e.to === selectedId) ids.add(e.from);
    }
    return ids;
  }, [map, selectedId]);

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
          data: {
            node,
            kind: ctx?.kind ?? "branch",
            related: related.has(node.id),
          },
        };
      }),
    [contexts, map, positions, selectedId, related],
  );

  const edges = useMemo<Edge[]>(
    () =>
      map.edges.map((e, i) => {
        const active = e.from === selectedId || e.to === selectedId;
        const color = active ? "var(--highlight)" : "var(--edge)";
        return {
          id: `${e.from}->${e.to}-${i}`,
          source: e.from,
          target: e.to,
          type: "smoothstep",
          label: e.label,
          labelStyle: { fontSize: 10, fill: "var(--muted-foreground)" },
          labelBgStyle: { fill: "var(--background)" },
          labelBgPadding: [4, 2] as [number, number],
          pathOptions: { borderRadius: 12 },
          zIndex: active ? 1 : 0,
          style: {
            ...EDGE_STYLE[e.type],
            stroke: color,
            strokeWidth: active ? 1.5 : 1,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 12,
            height: 12,
            color,
          },
          data: { type: e.type },
        };
      }),
    [map, selectedId],
  );

  const onNodeClick = useCallback<NodeMouseHandler<MapFlowNode>>(
    (_, node) => select(node.id),
    [select],
  );

  // Keyboard: Enter/Space on a focused node selects it, like a click.
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const el = event.target as HTMLElement;
      if (!el.classList.contains("react-flow__node")) return;
      const id = el.dataset.id;
      if (!id) return;
      event.preventDefault();
      select(id);
    },
    [select],
  );

  // Center on the selected node when asked (chips, prev/next).
  const lastFocus = useRef(focusNonce);
  useEffect(() => {
    if (focusNonce === lastFocus.current || !selectedId) return;
    lastFocus.current = focusNonce;
    const p = positions[selectedId];
    if (p) {
      userMoved.current = true;
      setCenter(p.x + NODE_WIDTH / 2, p.y + NODE_HEIGHT / 2, {
        zoom: Math.max(getZoom(), 0.75),
        duration: 400,
      });
    }
  }, [focusNonce, selectedId, positions, setCenter, getZoom]);

  // Fit the main path when asked ("Ajustar", map change).
  const lastFit = useRef(fitNonce);
  useEffect(() => {
    if (fitNonce === lastFit.current) return;
    lastFit.current = fitNonce;
    userMoved.current = false;
    // Wait a frame so freshly mounted nodes are measured.
    const frame = requestAnimationFrame(() =>
      fitView({ ...fitOptions(true), duration: 300 }),
    );
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

  const initialFit = useMemo(
    () => ({
      nodes: mainPath.map((id) => ({ id })),
      padding: 0.12,
      maxZoom: 1,
    }),
    [mainPath],
  );

  const onMoveStart = useCallback((event: MouseEvent | TouchEvent | null) => {
    if (event) userMoved.current = true;
  }, []);

  return (
    <div ref={containerRef} className="h-full w-full" onKeyDown={onKeyDown}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onMoveStart={onMoveStart}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        fitView
        fitViewOptions={initialFit}
        minZoom={0.1}
        maxZoom={2}
        aria-label="Mapa del sistema"
        ariaLabelConfig={ARIA_LABELS}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="var(--grid)"
        />
        <ZoomSlider position="bottom-left" onFit={fitMainPath} />
        {children}
      </ReactFlow>
    </div>
  );
}
