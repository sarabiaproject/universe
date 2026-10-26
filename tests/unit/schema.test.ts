import { describe, expect, it } from "vitest";

import { parseSystemMap } from "@/lib/schema";
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
      expect(errors.some((e) => e.includes("se bifurca en a"))).toBe(true);
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
      expect(errors.some((e) => e.includes("más de una arista main entrante"))).toBe(true);
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
      expect(errors.some((e) => e.startsWith("edges.0.type") && e.includes('track "main"'))).toBe(true);
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
});
