import { describe, expect, it } from "vitest";

import { mapProblems, parseDraftMap, parseSystemMap, type SystemMap } from "@/lib/schema";
import { BUNDLED_MAPS } from "@/maps";

const valid = {
  version: 1,
  title: "Mini",
  summary: "Un mapa mínimo",
  nodes: [
    { id: "a", title: "A", summary: "Primero", details: "", track: "main" },
    { id: "b", title: "B", summary: "Segundo", details: "- uno", track: "main" },
  ],
  edges: [{ from: "a", to: "b", type: "main" }],
};

const node = (id: string, track: "main" | "branch" = "main") => ({
  id,
  title: id.toUpperCase(),
  summary: id,
  track,
});

const errorsOf = (input: unknown) => {
  const result = parseSystemMap(input);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.errors;
};

describe("SystemMap schema", () => {
  it("accepts a valid map", () => {
    const result = parseSystemMap(valid);
    expect(result.ok).toBe(true);
  });

  it("validates both bundled maps", () => {
    expect(BUNDLED_MAPS.map((m) => m.id)).toEqual(["universe-spec", "share-modal"]);
    for (const { map } of BUNDLED_MAPS) expect(parseSystemMap(map).ok).toBe(true);
  });

  it("rejects summaries longer than 140 characters", () => {
    const map = structuredClone(valid);
    map.nodes[0].summary = "x".repeat(141);
    const result = parseSystemMap(map);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/^nodes\.0\.summary/);
  });

  it("rejects unknown edge types and tracks", () => {
    const map = structuredClone(valid) as Record<string, unknown> & typeof valid;
    (map.edges[0] as { type: string }).type = "sideways";
    (map.nodes[1] as { track: string }).track = "side";
    const result = parseSystemMap(map);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveLength(2);
  });

  it("rejects edges pointing to missing nodes and duplicate ids", () => {
    const map = structuredClone(valid);
    map.edges.push({ from: "b", to: "zzz", type: "main" });
    map.nodes.push({ ...map.nodes[0] });
    const result = parseSystemMap(map);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("zzz"))).toBe(true);
      expect(result.errors.some((e) => e.includes("duplicado"))).toBe(true);
    }
  });

  it("rejects non-object input", () => {
    expect(parseSystemMap("nope").ok).toBe(false);
    expect(parseSystemMap({ ...valid, version: 2 }).ok).toBe(false);
  });

  describe("main path structure", () => {
    it("rejects main nodes that are not chained by main edges", () => {
      const errors = errorsOf({ ...valid, nodes: [node("a"), node("b"), node("c")], edges: [] });
      expect(errors.some((e) => e.includes("una sola cadena"))).toBe(true);
    });

    it("rejects a main path split in two chains", () => {
      const errors = errorsOf({
        ...valid,
        nodes: [node("a"), node("b"), node("c"), node("d")],
        edges: [
          { from: "a", to: "b", type: "main" },
          { from: "c", to: "d", type: "main" },
        ],
      });
      expect(errors.some((e) => e.includes("una sola cadena"))).toBe(true);
    });

    it("rejects a forked main path", () => {
      const errors = errorsOf({
        ...valid,
        nodes: [node("a"), node("b"), node("c")],
        edges: [
          { from: "a", to: "b", type: "main" },
          { from: "a", to: "c", type: "main" },
        ],
      });
      expect(errors.some((e) => e.includes("se bifurca en «A»"))).toBe(true);
    });

    it("rejects two main edges into the same node", () => {
      const errors = errorsOf({
        ...valid,
        nodes: [node("a"), node("b"), node("c")],
        edges: [
          { from: "a", to: "c", type: "main" },
          { from: "b", to: "c", type: "main" },
        ],
      });
      expect(errors.some((e) => e.includes("más de una arista principal entrante"))).toBe(true);
    });

    it("rejects a main path that loops back", () => {
      const errors = errorsOf({
        ...valid,
        nodes: [node("a"), node("b")],
        edges: [
          { from: "a", to: "b", type: "main" },
          { from: "b", to: "a", type: "main" },
        ],
      });
      expect(errors.some((e) => e.includes("una sola cadena"))).toBe(true);
    });

    it("rejects main edges that touch branch nodes", () => {
      const errors = errorsOf({
        ...valid,
        nodes: [node("a"), node("x", "branch"), node("y", "branch")],
        edges: [{ from: "x", to: "y", type: "main" }],
      });
      expect(errors.some((e) => e.startsWith("edges.0.type") && e.includes("solo puede unir nodos del camino principal"))).toBe(true);
    });

    it("rejects self-loops", () => {
      const errors = errorsOf({
        ...valid,
        edges: [...valid.edges, { from: "b", to: "b", type: "branch" }],
      });
      expect(errors.some((e) => e.includes("a sí mismo"))).toBe(true);
    });

    it("rejects blank ids and trims surrounding spaces", () => {
      const errors = errorsOf({ ...valid, nodes: [...valid.nodes, { ...node("c", "branch"), id: "  " }] });
      expect(errors.some((e) => e.startsWith("nodes.2.id") && e.includes("vacío"))).toBe(true);

      const result = parseSystemMap({ ...valid, edges: [{ from: " a ", to: "b", type: "main" }] });
      expect(result.ok).toBe(true);
    });

    it("accepts a single main node and branch-only edges between branches", () => {
      const result = parseSystemMap({
        ...valid,
        nodes: [node("a"), node("x", "branch"), node("y", "branch")],
        edges: [
          { from: "a", to: "x", type: "branch" },
          { from: "x", to: "y", type: "edge_case" },
        ],
      });
      expect(result.ok).toBe(true);
    });
  });

  describe("slice 1 rules", () => {
    it("rejects unknown keys instead of dropping them (strict)", () => {
      const typo = { ...valid, nodes: [{ ...valid.nodes[0], previw: { type: "text", content: "x" } }, valid.nodes[1]] };
      const errors = errorsOf(typo);
      expect(errors.some((e) => e.startsWith("nodes.0") && e.includes("previw"))).toBe(true);
      expect(errorsOf({ ...valid, extra: true }).length).toBeGreaterThan(0);
      expect(errorsOf({ ...valid, edges: [{ ...valid.edges[0], kind: "x" }] }).length).toBeGreaterThan(0);
    });

    it("reports generic Zod errors in Spanish", () => {
      const errors = errorsOf({ ...valid, nodes: [{ ...valid.nodes[0], track: "side" }, valid.nodes[1]] });
      expect(errors.join(" ")).toMatch(/inválid|esperaba/);
      expect(errors.join(" ")).not.toMatch(/Invalid|expected/);
    });

    it("rejects blank titles with a clear message", () => {
      const errors = errorsOf({ ...valid, nodes: [{ ...valid.nodes[0], title: "   " }, valid.nodes[1]] });
      expect(errors).toContain("nodes.0.title: El título no puede estar vacío");
    });

    it("accepts an empty map as the empty state (O-N5)", () => {
      expect(parseSystemMap({ ...valid, nodes: [], edges: [] }).ok).toBe(true);
    });

    it("rejects maps with nodes but no main path (O-N5)", () => {
      const errors = errorsOf({ ...valid, nodes: [node("x", "branch")], edges: [] });
      expect(errors.some((e) => e.includes("al menos un nodo en el camino principal"))).toBe(true);
    });

    it("names nodes by title in main path messages", () => {
      const map: SystemMap = {
        version: 1,
        title: "Mapa",
        summary: "",
        nodes: [
          { ...node("a"), title: "Inicio", details: "" },
          { ...node("b"), title: "Suelto", details: "" },
        ],
        edges: [],
      };
      expect(mapProblems(map).join(" ")).toContain("«Suelto»");
    });

    it("drafts skip the graph rules but keep the field rules", () => {
      const broken = { ...valid, edges: [] };
      expect(parseSystemMap(broken).ok).toBe(false);
      expect(parseDraftMap(broken).ok).toBe(true);
      expect(parseDraftMap({ ...valid, nodes: [{ ...valid.nodes[0], summary: "x".repeat(141) }] }).ok).toBe(false);
    });
  });
});
