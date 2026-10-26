import { describe, expect, it } from "vitest";

import {
  applyEdit,
  connectionError,
  createNode,
  emptyHistory,
  freeSpot,
  HISTORY_LIMIT,
  nextStepAction,
  record,
  redo,
  suggestedEdgeType,
  undo,
  uniqueNodeId,
} from "@/lib/editor";
import { NODE_WIDTH } from "@/lib/layout";
import { mapProblems, parseSystemMap, type MapNode, type SystemMap } from "@/lib/schema";

const n = (id: string, track: MapNode["track"] = "main", x = 0): MapNode => ({
  id,
  title: id.toUpperCase(),
  summary: "",
  details: "",
  track,
  position: { x, y: 0 },
});

const chain: SystemMap = {
  version: 1,
  title: "Cadena",
  summary: "",
  nodes: [n("a"), n("b", "main", 300), n("c", "main", 600)],
  edges: [
    { from: "a", to: "b", type: "main" },
    { from: "b", to: "c", type: "main" },
  ],
};

describe("applyEdit", () => {
  it("never mutates the input map", () => {
    const frozen = structuredClone(chain);
    applyEdit(chain, { type: "updateNode", id: "a", patch: { title: "Nuevo" } });
    applyEdit(chain, { type: "deleteNode", id: "b" });
    applyEdit(chain, { type: "moveNodes", positions: { a: { x: 5, y: 5 } } });
    expect(chain).toEqual(frozen);
  });

  it("adds nodes, optionally connected, and ignores duplicate ids", () => {
    const added = applyEdit(chain, { type: "addNode", node: n("d", "branch") });
    expect(added.nodes.map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
    expect(applyEdit(added, { type: "addNode", node: n("d") })).toBe(added);

    const linked = applyEdit(chain, { type: "addNode", node: n("d"), connectFrom: { from: "c", type: "main" } });
    expect(linked.edges.at(-1)).toEqual({ from: "c", to: "d", type: "main" });
    expect(parseSystemMap(linked).ok).toBe(true);
  });

  it("updates fields, sets and removes the preview", () => {
    let map = applyEdit(chain, {
      type: "updateNode",
      id: "a",
      patch: { title: "Inicio", summary: "Hola", preview: { type: "code", content: "x()" } },
    });
    expect(map.nodes[0]).toMatchObject({ title: "Inicio", summary: "Hola", preview: { type: "code", content: "x()" } });
    map = applyEdit(map, { type: "updateNode", id: "a", patch: { preview: null } });
    expect("preview" in map.nodes[0]).toBe(false);
  });

  it("turns main edges into branches when a node leaves the main path", () => {
    const map = applyEdit(chain, { type: "updateNode", id: "c", patch: { track: "branch" } });
    expect(map.edges[1]).toEqual({ from: "b", to: "c", type: "branch" });
    expect(parseSystemMap(map).ok).toBe(true);
  });

  it("moves nodes to rounded positions", () => {
    const map = applyEdit(chain, { type: "moveNodes", positions: { b: { x: 10.4, y: -20.6 } } });
    expect(map.nodes[1].position).toEqual({ x: 10, y: -21 });
  });

  it("deleting a node removes its edges and rejoins the main path", () => {
    const map = applyEdit(chain, { type: "deleteNode", id: "b" });
    expect(map.nodes.map((x) => x.id)).toEqual(["a", "c"]);
    expect(map.edges).toEqual([{ from: "a", to: "c", type: "main" }]);
    expect(parseSystemMap(map).ok).toBe(true);
  });

  it("main edges promote both ends to the main path", () => {
    const map = applyEdit(
      { ...chain, nodes: [...chain.nodes, n("d", "branch")] },
      { type: "addEdge", edge: { from: "c", to: "d", type: "main" } },
    );
    expect(map.nodes.at(-1)?.track).toBe("main");
    expect(parseSystemMap(map).ok).toBe(true);
  });

  it("rejects self-loops, unknown nodes and duplicate connections", () => {
    expect(applyEdit(chain, { type: "addEdge", edge: { from: "a", to: "a", type: "branch" } })).toBe(chain);
    expect(applyEdit(chain, { type: "addEdge", edge: { from: "a", to: "zz", type: "branch" } })).toBe(chain);
    expect(applyEdit(chain, { type: "addEdge", edge: { from: "b", to: "a", type: "branch" } })).toBe(chain);
    expect(connectionError(chain, "a", "a")).toMatch(/consigo mismo/);
    expect(connectionError(chain, "a", "b")).toMatch(/ya están conectados/);
    expect(connectionError(chain, "a", "c")).toBeNull();
  });

  it("updates and deletes edges; blank labels are dropped", () => {
    let map = applyEdit(chain, { type: "updateEdge", index: 0, patch: { label: "sí" } });
    expect(map.edges[0].label).toBe("sí");
    map = applyEdit(map, { type: "updateEdge", index: 0, patch: { label: "  " } });
    expect("label" in map.edges[0]).toBe(false);
    map = applyEdit(map, { type: "deleteEdge", index: 0 });
    expect(map.edges).toEqual([{ from: "b", to: "c", type: "main" }]);
    expect(applyEdit(map, { type: "deleteEdge", index: 9 })).toBe(map);
  });

  it("updates the map title and summary", () => {
    expect(applyEdit(chain, { type: "updateMap", patch: { title: "Otro" } }).title).toBe("Otro");
  });
});

describe("editor helpers", () => {
  it("suggests main only when it extends the chain", () => {
    const withBranch = { ...chain, nodes: [...chain.nodes, n("d"), n("x", "branch")] };
    expect(suggestedEdgeType(withBranch, "c", "d")).toBe("main");
    expect(suggestedEdgeType(withBranch, "a", "d")).toBe("branch");
    expect(suggestedEdgeType(withBranch, "c", "x")).toBe("branch");
  });

  it("builds readable unique ids", () => {
    expect(uniqueNodeId(chain, "Pago fallido")).toBe("pago-fallido");
    expect(uniqueNodeId(chain, "A")).toBe("a-2");
    expect(uniqueNodeId(chain, "¿Qué?")).toBe("que");
    expect(uniqueNodeId(chain, "!!!")).toBe("nodo");
  });

  it("the first node starts the main path, later ones are branches", () => {
    const empty: SystemMap = { ...chain, nodes: [], edges: [] };
    expect(createNode(empty, { x: 0, y: 0 }).track).toBe("main");
    expect(createNode(chain, { x: 0, y: 0 }).track).toBe("branch");
  });

  it("finds a free spot that does not overlap other cards", () => {
    const spot = freeSpot([{ x: 0, y: 0 }], { x: 10, y: 10 });
    expect(spot.x).toBe(10);
    expect(spot.y).toBeGreaterThan(100);
    expect(freeSpot([{ x: 0, y: 0 }], { x: 500, y: 0 })).toEqual({ x: 500, y: 0 });
  });

  it("'next step' extends the main path from its last node, otherwise adds a branch", () => {
    const positions = Object.fromEntries(chain.nodes.map((x) => [x.id, x.position!]));
    const fromEnd = nextStepAction(chain, "c", positions);
    expect(fromEnd?.connectFrom).toEqual({ from: "c", type: "main" });
    expect(fromEnd?.node.position?.x).toBe(600 + NODE_WIDTH + 80);

    const fromMiddle = nextStepAction(chain, "a", positions);
    expect(fromMiddle?.node.track).toBe("branch");
    expect(fromMiddle?.connectFrom?.type).toBe("branch");
    const map = applyEdit(chain, fromMiddle!);
    expect(mapProblems(map)).toEqual([]);
  });
});

describe("history", () => {
  const v = (title: string): SystemMap => ({ ...chain, title });

  it("undo and redo walk back and forth", () => {
    let h = record(emptyHistory(), v("1"));
    h = record(h, v("2"));
    const u1 = undo(h, v("3"))!;
    expect(u1.map.title).toBe("2");
    const u2 = undo(u1.history, u1.map)!;
    expect(u2.map.title).toBe("1");
    expect(undo(u2.history, u2.map)).toBeNull();
    const r1 = redo(u2.history, u2.map)!;
    expect(r1.map.title).toBe("2");
    const r2 = redo(r1.history, r1.map)!;
    expect(r2.map.title).toBe("3");
    expect(redo(r2.history, r2.map)).toBeNull();
  });

  it("a new edit clears the redo stack", () => {
    const h = record(emptyHistory(), v("1"));
    const u = undo(h, v("2"))!;
    expect(record(u.history, u.map).future).toEqual([]);
  });

  it("edits with the same key merge into one step", () => {
    let h = record(emptyHistory(), v("a"), "title");
    h = record(h, v("ab"), "title");
    h = record(h, v("abc"), "title");
    expect(h.past.map((m) => m.title)).toEqual(["a"]);
    h = record(h, v("abcd"), "summary");
    expect(h.past).toHaveLength(2);
  });

  it(`keeps at most ${HISTORY_LIMIT} steps`, () => {
    let h = emptyHistory();
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) h = record(h, v(String(i)));
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    expect(h.past[0].title).toBe("20");
  });
});
