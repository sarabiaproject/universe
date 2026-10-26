import type { EdgeType, MapNode, SystemMap } from "@/lib/schema";

export type NodeKind = "main" | "branch" | "edge_case";

export type Connection = {
  id: string;
  direction: "in" | "out";
  type: EdgeType;
  label?: string;
};

export type NodeContext = {
  node: MapNode;
  kind: NodeKind;
  /** 0-based index on the main path, or null for branch nodes. */
  index: number | null;
  total: number;
  /** Main node this branch hangs off (the node itself for main nodes). */
  anchor: MapNode | null;
  /** Main path: previous node. Branch: the node it hangs off. */
  prev: MapNode | null;
  next: MapNode | null;
  connections: Connection[];
};

/**
 * Ordered list of main-track node ids. Starts at the first main node without an
 * incoming main edge and follows main edges; leftover main nodes keep file order.
 */
export function getMainPath(map: SystemMap): string[] {
  const main = map.nodes.filter((n) => n.track === "main");
  const mainIds = new Set(main.map((n) => n.id));
  const mainEdges = map.edges.filter(
    (e) => e.type === "main" && mainIds.has(e.from) && mainIds.has(e.to),
  );
  const hasIncoming = new Set(mainEdges.map((e) => e.to));
  const visited = new Set<string>();
  const path: string[] = [];

  const walk = (start: string) => {
    let current: string | undefined = start;
    while (current && !visited.has(current)) {
      visited.add(current);
      path.push(current);
      current = mainEdges.find((e) => e.from === current && !visited.has(e.to))?.to;
    }
  };

  for (const node of main) if (!hasIncoming.has(node.id)) walk(node.id);
  for (const node of main) walk(node.id);
  return path;
}

/** First incoming edge, preferring edges whose source is not the node itself. */
function incomingEdge(map: SystemMap, id: string) {
  return map.edges.find((e) => e.to === id && e.from !== id);
}

/** Closest main-track ancestor following first incoming edges. */
export function getAnchor(map: SystemMap, id: string): MapNode | null {
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  let current = byId.get(id);
  while (current && !seen.has(current.id)) {
    if (current.track === "main") return current;
    seen.add(current.id);
    const edge = incomingEdge(map, current.id);
    current = edge ? byId.get(edge.from) : undefined;
  }
  return null;
}

export function getNodeContext(map: SystemMap, id: string): NodeContext | null {
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const node = byId.get(id);
  if (!node) return null;

  const path = getMainPath(map);
  const at = (i: number) => (i >= 0 && i < path.length ? byId.get(path[i]) ?? null : null);
  const connections: Connection[] = map.edges.flatMap((e): Connection[] => {
    if (e.from === id && e.to !== id) return [{ id: e.to, direction: "out", type: e.type, label: e.label }];
    if (e.to === id && e.from !== id) return [{ id: e.from, direction: "in", type: e.type, label: e.label }];
    return [];
  });

  if (node.track === "main") {
    const index = path.indexOf(id);
    return {
      node,
      kind: "main",
      index,
      total: path.length,
      anchor: node,
      prev: at(index - 1),
      next: at(index + 1),
      connections,
    };
  }

  const edge = incomingEdge(map, id);
  const parent = edge ? byId.get(edge.from) ?? null : null;
  const anchor = getAnchor(map, id);
  const anchorIndex = anchor ? path.indexOf(anchor.id) : -1;
  return {
    node,
    kind: edge?.type === "edge_case" ? "edge_case" : "branch",
    index: null,
    total: path.length,
    anchor,
    prev: parent,
    next: anchorIndex >= 0 ? at(anchorIndex + 1) : null,
    connections,
  };
}

export const KIND_LABEL: Record<NodeKind, string> = {
  main: "Camino principal",
  branch: "Rama",
  edge_case: "Caso límite",
};

export function positionLabel(ctx: NodeContext): string {
  if (ctx.kind === "main" && ctx.index !== null) {
    return `${ctx.index + 1}/${ctx.total} · camino principal`;
  }
  const prefix = ctx.kind === "edge_case" ? "caso límite" : "rama";
  return ctx.anchor ? `${prefix} de ${ctx.anchor.title}` : prefix;
}
