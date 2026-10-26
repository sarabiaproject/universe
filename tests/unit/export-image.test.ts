import { describe, expect, it } from "vitest";

import { IMAGE_MAX_SIDE, IMAGE_PADDING, imageFrame } from "@/lib/export-image";
import { layoutMap, NODE_HEIGHT, NODE_WIDTH } from "@/lib/layout";
import type { SystemMap } from "@/lib/schema";
import { BUNDLED_MAPS } from "@/maps";

/** Applies the frame's translate to a flow point. */
function place(transform: string, p: { x: number; y: number }) {
  const [, tx, ty] = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(transform)!.map(Number);
  return { x: p.x + tx, y: p.y + ty };
}

describe("PNG frame", () => {
  it.each(BUNDLED_MAPS.map((m) => [m.id, m.map] as const))("holds every node of %s, at 2x", (_, map) => {
    const frame = imageFrame(map);
    const positions = layoutMap(map);
    expect(frame.pixelRatio).toBe(2);
    for (const node of map.nodes) {
      const p = place(frame.transform, positions[node.id]);
      expect(p.x).toBeGreaterThanOrEqual(IMAGE_PADDING - 0.5);
      expect(p.y).toBeGreaterThanOrEqual(IMAGE_PADDING - 0.5);
      expect(p.x + NODE_WIDTH).toBeLessThanOrEqual(frame.width - IMAGE_PADDING + 0.5);
      expect(p.y + NODE_HEIGHT).toBeLessThanOrEqual(frame.height - IMAGE_PADDING + 1);
    }
  });

  it("is tight: one node is the card plus padding", () => {
    const map: SystemMap = {
      version: 1,
      title: "x",
      summary: "",
      nodes: [{ id: "a", title: "A", summary: "", details: "", track: "main", position: { x: -300, y: 40 } }],
      edges: [],
    };
    expect(imageFrame(map)).toEqual({
      width: NODE_WIDTH + IMAGE_PADDING * 2,
      height: NODE_HEIGHT + IMAGE_PADDING * 2,
      transform: `translate(${IMAGE_PADDING + 300}px, ${IMAGE_PADDING - 40}px) scale(1)`,
      pixelRatio: 2,
    });
  });

  it("lowers the pixel ratio for huge maps instead of failing", () => {
    const nodes = [0, 20000].map((x, i) => ({
      id: `n${i}`,
      title: "N",
      summary: "",
      details: "",
      track: "branch" as const,
      position: { x, y: 0 },
    }));
    const frame = imageFrame({ version: 1, title: "x", summary: "", nodes, edges: [] });
    expect(frame.width * frame.pixelRatio).toBeLessThanOrEqual(IMAGE_MAX_SIDE + 1);
  });
});
