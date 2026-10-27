import { describe, expect, it } from "vitest";

import { getMainPath } from "@/lib/graph";
import { layoutMap, NODE_HEIGHT, NODE_WIDTH } from "@/lib/layout";
import { parseSystemMap } from "@/lib/schema";
import { BUNDLED_MAPS } from "@/maps";

// Every example in the gallery, present and future: valid, readable and drawn without overlaps.
describe.each(BUNDLED_MAPS.map((m) => [m.id, m] as const))("bundled map %s", (_, { map, description }) => {
  it("validates against the schema, graph rules included", () => {
    const result = parseSystemMap(structuredClone(map));
    expect(result.ok, result.ok ? "" : result.errors.join("\n")).toBe(true);
  });

  it("has a one-line gallery description and real explanations", () => {
    expect(description.length).toBeGreaterThan(10);
    expect(description.length).toBeLessThanOrEqual(80);
    expect(description).not.toContain("\n");
    for (const node of map.nodes) {
      expect(node.summary.length, node.id).toBeGreaterThan(10);
      expect(node.details.length, node.id).toBeGreaterThan(0);
    }
  });

  it("has a main path plus branches and edge cases", () => {
    expect(getMainPath(map).length).toBeGreaterThanOrEqual(4);
    expect(map.edges.some((e) => e.type === "branch")).toBe(true);
    expect(map.edges.some((e) => e.type === "edge_case")).toBe(true);
  });

  it("lays out without overlapping cards", () => {
    const pos = layoutMap(map);
    const ids = map.nodes.map((n) => n.id);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const [a, b] = [pos[ids[i]], pos[ids[j]]];
        const overlap = Math.abs(a.x - b.x) < NODE_WIDTH && Math.abs(a.y - b.y) < NODE_HEIGHT;
        expect(overlap, `${ids[i]} vs ${ids[j]}`).toBe(false);
      }
    }
  });
});

it("bundles four examples with unique ids and titles", () => {
  expect(BUNDLED_MAPS).toHaveLength(4);
  expect(new Set(BUNDLED_MAPS.map((m) => m.id)).size).toBe(4);
  expect(new Set(BUNDLED_MAPS.map((m) => m.map.title)).size).toBe(4);
});
