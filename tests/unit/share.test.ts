import { compressToEncodedURIComponent } from "lz-string";
import { describe, expect, it } from "vitest";

import type { SystemMap } from "@/lib/schema";
import { decodeShareHash, encodeMap, isShareHash, SHARE_PREFIX, shareUrl } from "@/lib/share";
import { BUNDLED_MAPS } from "@/maps";

const unicode: SystemMap = {
  version: 1,
  title: "Ñandú: «año» 🚀 & <b>",
  summary: "Acentos, emoji y símbolos #?&=",
  nodes: [
    { id: "a", title: "Inicio ✓", summary: "Línea 1", details: "- **uno**\n- `dos`", track: "main", position: { x: 0.5, y: -20 } },
    { id: "b", title: "Fin", summary: "", details: "", track: "main", preview: { type: "metric", content: "99 %" } },
    { id: "c", title: "Error", summary: "", details: "", track: "branch" },
  ],
  edges: [
    { from: "a", to: "b", type: "main" },
    { from: "a", to: "c", type: "edge_case", label: "falla?" },
  ],
};

describe("share links", () => {
  it.each([...BUNDLED_MAPS.map((m) => [m.id, m.map] as const), ["unicode", unicode] as const])(
    "round-trips %s exactly",
    (_, map) => {
      const url = shareUrl(map, "https://universe.example/?x=1#old");
      expect(url.startsWith(`https://universe.example/?x=1${SHARE_PREFIX}`)).toBe(true);
      const hash = url.slice(url.indexOf("#"));
      const result = decodeShareHash(hash);
      expect(result).toEqual({ ok: true, map, problems: [] });
    },
  );

  it("only uses URL-safe characters", () => {
    expect(encodeMap(unicode)).toMatch(/^[A-Za-z0-9+\-$]*$/);
  });

  it("recognises share hashes", () => {
    expect(isShareHash("#m=abc")).toBe(true);
    expect(isShareHash("")).toBe(false);
    expect(isShareHash("#detalle")).toBe(false);
  });

  it("explains empty, cut and corrupt links in Spanish", () => {
    const full = `#m=${encodeMap(unicode)}`;
    for (const hash of ["#m=", "#m=%%%", "#m=hola", full.slice(0, full.length / 2)]) {
      const result = decodeShareHash(hash);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors[0]).toMatch(/enlace/);
    }
  });

  it("rejects a link whose map breaks the schema, with the path", () => {
    const bad = { ...unicode, nodes: [{ ...unicode.nodes[0], summary: "x".repeat(141) }, ...unicode.nodes.slice(1)] };
    const result = decodeShareHash(`#m=${compressToEncodedURIComponent(JSON.stringify(bad))}`);
    expect(result).toEqual({ ok: false, errors: ["nodes.0.summary: El resumen no puede superar 140 caracteres"] });
  });

  it("rejects a link that is JSON but not a map", () => {
    const result = decodeShareHash(`#m=${compressToEncodedURIComponent("[1,2]")}`);
    expect(result.ok).toBe(false);
  });
});
