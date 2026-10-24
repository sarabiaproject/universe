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
});
