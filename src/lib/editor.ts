import { NODE_HEIGHT, NODE_WIDTH, type Point } from "@/lib/layout";
import type { EdgeType, MapEdge, MapNode, Preview, SystemMap } from "@/lib/schema";

/** Every change to a map goes through one of these actions (and so through undo/redo). */
export type EditAction =
  | { type: "addNode"; node: MapNode; connectFrom?: { from: string; type: EdgeType } }
  | { type: "updateNode"; id: string; patch: NodePatch }
  | { type: "moveNodes"; positions: Record<string, Point> }
  | { type: "deleteNode"; id: string }
  | { type: "addEdge"; edge: MapEdge }
  | { type: "updateEdge"; index: number; patch: EdgePatch }
  | { type: "deleteEdge"; index: number }
  | { type: "updateMap"; patch: { title?: string; summary?: string } };

/** `preview: null` removes the preview. */
export type NodePatch = Partial<Omit<MapNode, "id" | "preview" | "position">> & {
  preview?: Preview | null;
};
export type EdgePatch = Partial<Pick<MapEdge, "type" | "label">>;

export const NEW_NODE_TITLE = "Nuevo nodo";
const GAP_X = 80;
const GAP_Y = 56;

/**
 * Applies one edit and returns a new map (the input is never mutated). Edits keep
 * the main path coherent where it is cheap to do so:
 * - a `main` edge promotes both ends to `track: "main"`;
 * - a node moved to `track: "branch"` turns its `main` edges into `branch`;
 * - deleting a node in the middle of the main path joins its neighbours.
 * Invalid edits (unknown ids, self-loops, duplicate edges) return the same map.
 */
export function applyEdit(map: SystemMap, action: EditAction): SystemMap {
  switch (action.type) {
    case "addNode": {
      if (map.nodes.some((n) => n.id === action.node.id)) return map;
      const next = { ...map, nodes: [...map.nodes, action.node] };
      const link = action.connectFrom;
      if (!link) return next;
      return applyEdit(next, { type: "addEdge", edge: { from: link.from, to: action.node.id, type: link.type } });
    }
    case "updateNode": {
      const node = map.nodes.find((n) => n.id === action.id);
      if (!node) return map;
      const { preview, ...rest } = action.patch;
      const updated: MapNode = { ...node, ...rest };
      if (preview === null) delete updated.preview;
      else if (preview) updated.preview = preview;
      let edges = map.edges;
      if (node.track === "main" && updated.track === "branch") {
        edges = edges.map((e) =>
          e.type === "main" && (e.from === node.id || e.to === node.id) ? { ...e, type: "branch" } : e,
        );
      }
      return { ...map, nodes: map.nodes.map((n) => (n.id === node.id ? updated : n)), edges };
    }
    case "moveNodes": {
      const nodes = map.nodes.map((n) => {
        const p = action.positions[n.id];
        return p ? { ...n, position: { x: Math.round(p.x), y: Math.round(p.y) } } : n;
      });
      return { ...map, nodes };
    }
    case "deleteNode": {
      const { id } = action;
      if (!map.nodes.some((n) => n.id === id)) return map;
      const prev = map.edges.find((e) => e.type === "main" && e.to === id)?.from;
      const next = map.edges.find((e) => e.type === "main" && e.from === id)?.to;
      const edges = map.edges.filter((e) => e.from !== id && e.to !== id);
      if (prev && next && prev !== next && !edges.some((e) => e.from === prev && e.to === next)) {
        edges.push({ from: prev, to: next, type: "main" });
      }
      return { ...map, nodes: map.nodes.filter((n) => n.id !== id), edges };
    }
    case "addEdge": {
      const { edge } = action;
      if (connectionError(map, edge.from, edge.to)) return map;
      const withEdge = { ...map, edges: [...map.edges, edge] };
      return edge.type === "main" ? promote(withEdge, [edge.from, edge.to]) : withEdge;
    }
    case "updateEdge": {
      const edge = map.edges[action.index];
      if (!edge) return map;
      const updated: MapEdge = { ...edge, ...action.patch };
      if (updated.label !== undefined && updated.label.trim() === "") delete updated.label;
      const next = { ...map, edges: map.edges.map((e, i) => (i === action.index ? updated : e)) };
      return updated.type === "main" ? promote(next, [updated.from, updated.to]) : next;
    }
    case "deleteEdge":
      if (!map.edges[action.index]) return map;
      return { ...map, edges: map.edges.filter((_, i) => i !== action.index) };
    case "updateMap":
      return { ...map, ...action.patch };
  }
}

function promote(map: SystemMap, ids: string[]): SystemMap {
  return {
    ...map,
    nodes: map.nodes.map((n) => (ids.includes(n.id) && n.track !== "main" ? { ...n, track: "main" } : n)),
  };
}

/** Why `from → to` cannot be added, in Spanish, or null when it can. */
export function connectionError(map: SystemMap, from: string, to: string): string | null {
  if (from === to) return "Un nodo no puede conectarse consigo mismo.";
  const ids = new Set(map.nodes.map((n) => n.id));
  if (!ids.has(from) || !ids.has(to)) return "Ese nodo ya no existe.";
  if (map.edges.some((e) => (e.from === from && e.to === to) || (e.from === to && e.to === from))) {
    return "Esos nodos ya están conectados.";
  }
  return null;
}

/** Edge type suggested for a new connection: extends the main path when it can. */
export function suggestedEdgeType(map: SystemMap, from: string, to: string): EdgeType {
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const source = byId.get(from);
  const target = byId.get(to);
  const hasOut = map.edges.some((e) => e.type === "main" && e.from === from);
  const hasIn = map.edges.some((e) => e.type === "main" && e.to === to);
  return source?.track === "main" && target?.track === "main" && !hasOut && !hasIn ? "main" : "branch";
}

/** Readable, unique id from a title: "Pago fallido" → "pago-fallido", "pago-fallido-2", … */
export function uniqueNodeId(map: SystemMap, title: string): string {
  const base =
    title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "nodo";
  const ids = new Set(map.nodes.map((n) => n.id));
  if (!ids.has(base)) return base;
  let i = 2;
  while (ids.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

function overlaps(a: Point, b: Point) {
  return Math.abs(a.x - b.x) < NODE_WIDTH + 16 && Math.abs(a.y - b.y) < NODE_HEIGHT + 16;
}

/** First spot at or below `near` that does not overlap any of `taken`. */
export function freeSpot(taken: Point[], near: Point): Point {
  const spot = { x: Math.round(near.x), y: Math.round(near.y) };
  while (taken.some((p) => overlaps(p, spot))) spot.y += NODE_HEIGHT + GAP_Y;
  return spot;
}

/** A new, empty node. The first node of a map starts the main path. */
export function createNode(map: SystemMap, position: Point, track?: MapNode["track"]): MapNode {
  return {
    id: uniqueNodeId(map, NEW_NODE_TITLE),
    title: NEW_NODE_TITLE,
    summary: "",
    details: "",
    track: track ?? (map.nodes.some((n) => n.track === "main") ? "branch" : "main"),
    position,
  };
}

/**
 * "Añadir siguiente" from `fromId`: continues the main path when `fromId` is its
 * last node, otherwise adds a branch below.
 */
export function nextStepAction(
  map: SystemMap,
  fromId: string,
  positions: Record<string, Point>,
): Extract<EditAction, { type: "addNode" }> | null {
  const from = map.nodes.find((n) => n.id === fromId);
  const origin = positions[fromId];
  if (!from || !origin) return null;
  const extendsMain = from.track === "main" && !map.edges.some((e) => e.type === "main" && e.from === fromId);
  const near = extendsMain
    ? { x: origin.x + NODE_WIDTH + GAP_X, y: origin.y }
    : { x: origin.x + NODE_WIDTH + GAP_X, y: origin.y + NODE_HEIGHT + GAP_Y };
  const node = createNode(map, freeSpot(Object.values(positions), near), extendsMain ? "main" : "branch");
  return { type: "addNode", node, connectFrom: { from: fromId, type: extendsMain ? "main" : "branch" } };
}

// --- Undo / redo ---------------------------------------------------------------

export const HISTORY_LIMIT = 100;

export type History = {
  past: SystemMap[];
  future: SystemMap[];
  /** Consecutive edits with the same key (typing in one field) form one undo step. */
  lastKey: string | null;
};

export const emptyHistory = (): History => ({ past: [], future: [], lastKey: null });

/** Records that the map was `previous` before an edit. */
export function record(history: History, previous: SystemMap, key: string | null = null): History {
  if (key !== null && key === history.lastKey) return { ...history, future: [], lastKey: key };
  return { past: [...history.past, previous].slice(-HISTORY_LIMIT), future: [], lastKey: key };
}

export function undo(history: History, present: SystemMap): { history: History; map: SystemMap } | null {
  const map = history.past.at(-1);
  if (!map) return null;
  return {
    map,
    history: { past: history.past.slice(0, -1), future: [present, ...history.future], lastKey: null },
  };
}

export function redo(history: History, present: SystemMap): { history: History; map: SystemMap } | null {
  const [map, ...future] = history.future;
  if (!map) return null;
  return { map, history: { past: [...history.past, present], future, lastKey: null } };
}
