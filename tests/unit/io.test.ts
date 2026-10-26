import { describe, expect, it } from "vitest";

import { mapToJson, parseImportText, slugify } from "@/lib/io";
import type { SystemMap } from "@/lib/schema";
import { BUNDLED_MAPS } from "@/maps";

const map: SystemMap = {
  version: 1,
  title: "Pago",
  summary: "",
  nodes: [
    { id: "a", title: "Carrito", summary: "", details: "", track: "main" },
    { id: "b", title: "Pagar", summary: "", details: "", track: "main" },
  ],
  edges: [{ from: "a", to: "b", type: "main" }],
};

describe("import JSON", () => {
  it("accepts exported maps unchanged (export → import round trip)", () => {
    for (const m of [map, ...BUNDLED_MAPS.map((b) => b.map)]) {
      expect(parseImportText(mapToJson(m))).toEqual({ ok: true, map: m, problems: [] });
    }
  });

  it("exports the exact schema, pretty printed", () => {
    expect(JSON.parse(mapToJson(map))).toEqual(map);
    expect(mapToJson(map)).toContain('\n  "title": "Pago"');
  });

  it("fills defaults like the schema (details)", () => {
    const node: Partial<SystemMap["nodes"][number]> = { ...map.nodes[0] };
    delete node.details;
    const result = parseImportText(JSON.stringify({ ...map, nodes: [node, map.nodes[1]] }));
    expect(result.ok && result.map.nodes[0].details).toBe("");
  });

  it("explains empty text and broken JSON with line and column", () => {
    expect(parseImportText("  ")).toEqual({ ok: false, errors: [expect.stringMatching(/No hay nada que importar/)] });
    const result = parseImportText('{\n  "version": 1,\n  "title": "x",,\n}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/^El texto no es JSON válido \(línea 3, columna \d+\)/);
  });

  it("lists schema errors with their path, in Spanish", () => {
    const bad = {
      ...map,
      nodes: [{ ...map.nodes[0], summary: "x".repeat(141) }, { ...map.nodes[1], track: "lateral" }],
      edges: [{ from: "a", to: "zzz", type: "main" }],
    };
    const result = parseImportText(JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain("nodes.0.summary: El resumen no puede superar 140 caracteres");
    expect(result.errors.some((e) => e.startsWith("nodes.1.track: "))).toBe(true);
  });

  it("rejects unknown keys, wrong versions and non-objects", () => {
    expect(parseImportText(JSON.stringify({ ...map, extra: 1 })).ok).toBe(false);
    expect(parseImportText(JSON.stringify({ ...map, version: 2 })).ok).toBe(false);
    expect(parseImportText("42").ok).toBe(false);
    expect(parseImportText("null").ok).toBe(false);
  });

  it("accepts a draft that only breaks the main path rules, listing the problems", () => {
    const draft = { ...map, edges: [] };
    const result = parseImportText(JSON.stringify(draft));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.map).toEqual(draft);
      expect(result.problems).toHaveLength(1);
      expect(result.problems[0]).toMatch(/una sola cadena/);
    }
  });
});

describe("slugify", () => {
  it.each([
    ["Mapa de Ñandú: v2", "mapa-de-nandu-v2"],
    ["universe: el spec", "universe-el-spec"],
    ["  ¿Qué?  ", "que"],
    ["🚀🚀", "mapa"],
    ["a".repeat(80), "a".repeat(60)],
  ])("%s → %s", (title, slug) => expect(slugify(title)).toBe(slug));
});
