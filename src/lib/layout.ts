import dagre from "@dagrejs/dagre";

import { getMainPath } from "@/lib/graph";
import type { SystemMap } from "@/lib/schema";

export const NODE_WIDTH = 208;
export const NODE_HEIGHT = 108;
const LANE_HEIGHT = NODE_HEIGHT + 56;
const RANK_SEP = 72;

export type Point = { x: number; y: number };

type Lane = { side: 1 | -1; index: number; from: number; to: number };

/**
 * Computes top-left positions for every node. dagre (rankdir LR) assigns the
 * horizontal rank of each node; the main path is then pinned to y = 0 and each
 * branch subtree is placed on the nearest free lane above or below its anchor.
 * Edge cases always go below.
 */
export function layoutMap(map: SystemMap): Record<string, Point> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", ranksep: RANK_SEP, nodesep: 32 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const node of map.nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of map.edges) {
    if (edge.from === edge.to) continue;
    g.setEdge(edge.from, edge.to, { weight: edge.type === "main" ? 8 : 1 });
  }
  dagre.layout(g);

  const centerX = (id: string) => g.node(id).x;
  const centerY = (id: string) => g.node(id).y;
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const centers: Record<string, Point> = {};

  const path = getMainPath(map);
  for (const id of path) centers[id] = { x: centerX(id), y: 0 };

  const assigned = new Set(path);
  const lanes: Lane[] = [];
  const isFree = (side: 1 | -1, index: number, from: number, to: number) =>
    !lanes.some(
      (l) => l.side === side && l.index === index && l.from < to && from < l.to,
    );
  const firstFree = (side: 1 | -1, rows: number, from: number, to: number) => {
    for (let k = 1; ; k++) {
      let ok = true;
      for (let r = 0; r < rows && ok; r++) ok = isFree(side, k + r, from, to);
      if (ok) return k;
    }
  };

  const placeSubtree = (rootId: string, preferred: 1 | -1, forced: boolean) => {
    const members: string[] = [];
    const queue = [rootId];
    assigned.add(rootId);
    while (queue.length) {
      const id = queue.shift()!;
      members.push(id);
      for (const e of map.edges) {
        const target = byId.get(e.to);
        if (e.from === id && target && target.track !== "main" && !assigned.has(e.to)) {
          assigned.add(e.to);
          queue.push(e.to);
        }
      }
    }

    // Nodes sharing a dagre rank inside one subtree stack on consecutive lanes.
    const columns = new Map<number, string[]>();
    for (const id of members) {
      const x = Math.round(centerX(id));
      columns.set(x, [...(columns.get(x) ?? []), id]);
    }
    const rows = Math.max(...[...columns.values()].map((c) => c.length));
    const xs = members.map(centerX);
    const from = Math.min(...xs) - NODE_WIDTH / 2 - RANK_SEP / 2;
    const to = Math.max(...xs) + NODE_WIDTH / 2 + RANK_SEP / 2;

    const kPreferred = firstFree(preferred, rows, from, to);
    const other = (preferred * -1) as 1 | -1;
    const kOther = forced ? Infinity : firstFree(other, rows, from, to);
    const side = kOther < kPreferred ? other : preferred;
    const k = Math.min(kPreferred, kOther);

    for (let r = 0; r < rows; r++) lanes.push({ side, index: k + r, from, to });
    for (const column of columns.values()) {
      column
        .sort((a, b) => side * (centerY(a) - centerY(b)))
        .forEach((id, r) => {
          centers[id] = { x: centerX(id), y: side * (k + r) * LANE_HEIGHT };
        });
    }
  };

  for (const anchorId of path) {
    let alternate: 1 | -1 = -1;
    for (const e of map.edges) {
      const child = byId.get(e.to);
      if (e.from !== anchorId || !child || child.track === "main" || assigned.has(child.id)) continue;
      if (e.type === "edge_case") {
        placeSubtree(child.id, 1, true);
      } else {
        placeSubtree(child.id, alternate, false);
        alternate = (alternate * -1) as 1 | -1;
      }
    }
  }
  // Branch nodes not reachable from the main path still get a lane.
  for (const node of map.nodes) {
    if (!assigned.has(node.id)) placeSubtree(node.id, 1, false);
  }

  const positions: Record<string, Point> = {};
  for (const node of map.nodes) {
    const c = centers[node.id];
    positions[node.id] =
      node.position ?? { x: c.x - NODE_WIDTH / 2, y: c.y - NODE_HEIGHT / 2 };
  }
  return positions;
}
