import { describe, expect, it } from "vitest";

import { getMainPath } from "@/lib/graph";
import { layoutMap, NODE_HEIGHT, NODE_WIDTH } from "@/lib/layout";
import type { SystemMap } from "@/lib/schema";
import { BUNDLED_MAPS } from "@/maps";

const spec = BUNDLED_MAPS.find((m) => m.id === "universe-spec")!.map;
const share = BUNDLED_MAPS.find((m) => m.id === "share-modal")!.map;

function overlaps(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) < NODE_WIDTH && Math.abs(a.y - b.y) < NODE_HEIGHT;
}

describe("layoutMap", () => {
  it.each([spec, share])("orders the main path left → right on one row ($title)", (map) => {
    const pos = layoutMap(map);
    const path = getMainPath(map);
    for (let i = 1; i < path.length; i++) {
      expect(pos[path[i]].x).toBeGreaterThan(pos[path[i - 1]].x);
      expect(pos[path[i]].y).toBe(pos[path[0]].y);
    }
  });

  it("follows main edges for the spec map", () => {
    expect(getMainPath(spec)).toEqual([
      "problema",
      "mapa-universal",
      "flujo-usuario",
      "stack",
      "arquitectura",
      "slice-0",
      "slice-1",
      "slice-2",
      "deploy",
    ]);
  });

  it.each([spec, share])("puts branches above or below the main row without overlaps ($title)", (map) => {
    const pos = layoutMap(map);
    const mainY = pos[getMainPath(map)[0]].y;
    for (const node of map.nodes) {
      if (node.track === "branch") expect(pos[node.id].y).not.toBe(mainY);
    }
    const ids = map.nodes.map((n) => n.id);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        expect(overlaps(pos[ids[i]], pos[ids[j]]), `${ids[i]} vs ${ids[j]}`).toBe(false);
      }
    }
  });

  it("places edge cases off the main path below it", () => {
    const pos = layoutMap(spec);
    expect(pos["movil-360"].y).toBeGreaterThan(pos["slice-0"].y);
    expect(pos["url-larga"].y).toBeGreaterThan(pos["slice-2"].y);
  });

  it("branches start to the right of their anchor", () => {
    const pos = layoutMap(spec);
    expect(pos["competencia"].x).toBeGreaterThan(pos["problema"].x);
    expect(pos["diferencial"].x).toBeGreaterThan(pos["competencia"].x);
  });

  it("respects explicit positions", () => {
    const map: SystemMap = {
      version: 1,
      title: "Fijo",
      summary: "",
      nodes: [
        { id: "a", title: "A", summary: "", details: "", track: "main", position: { x: 5, y: 7 } },
        { id: "b", title: "B", summary: "", details: "", track: "main" },
      ],
      edges: [{ from: "a", to: "b", type: "main" }],
    };
    expect(layoutMap(map).a).toEqual({ x: 5, y: 7 });
  });
});
