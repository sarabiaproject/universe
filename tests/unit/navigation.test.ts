import { describe, expect, it } from "vitest";

import { getNodeContext, positionLabel } from "@/lib/graph";
import { BUNDLED_MAPS } from "@/maps";

const spec = BUNDLED_MAPS.find((m) => m.id === "universe-spec")!.map;
const share = BUNDLED_MAPS.find((m) => m.id === "share-modal")!.map;
const ctx = (id: string, map = spec) => getNodeContext(map, id)!;

describe("prev/next navigation", () => {
  it("walks the main path", () => {
    const c = ctx("flujo-usuario");
    expect(c.kind).toBe("main");
    expect(c.prev?.id).toBe("mapa-universal");
    expect(c.next?.id).toBe("stack");
    expect(positionLabel(c)).toBe("3/9 · camino principal");
  });

  it("has no prev on the first and no next on the last main node", () => {
    expect(ctx("problema").prev).toBeNull();
    expect(ctx("problema").next?.id).toBe("mapa-universal");
    expect(ctx("deploy").next).toBeNull();
    expect(positionLabel(ctx("deploy"))).toBe("9/9 · camino principal");
  });

  it("on a branch node: prev = parent, next = next main node after its anchor", () => {
    const c = ctx("diferencial");
    expect(c.kind).toBe("branch");
    expect(c.prev?.id).toBe("competencia");
    expect(c.anchor?.id).toBe("problema");
    expect(c.next?.id).toBe("mapa-universal");
    expect(positionLabel(c)).toBe("rama de Problema");
  });

  it("labels edge cases and resolves their anchor through branches", () => {
    const c = ctx("json-invalido");
    expect(c.kind).toBe("edge_case");
    expect(c.prev?.id).toBe("esquema");
    expect(c.anchor?.id).toBe("mapa-universal");
    expect(c.next?.id).toBe("flujo-usuario");
    expect(positionLabel(c)).toBe("caso límite de Mapa universal");
  });

  it("branch off the last main node has no next", () => {
    expect(ctx("preguntas").next).toBeNull();
  });

  it("lists incoming and outgoing connections", () => {
    const c = ctx("stack");
    expect(c.connections.map((x) => `${x.direction}:${x.id}`).sort()).toEqual(
      ["in:flujo-usuario", "out:arquitectura", "out:componentes-shadcn", "out:react-flow-ui"].sort(),
    );
  });

  it("works on the share modal map", () => {
    expect(ctx("email-entered", share).next?.id).toBe("first-added");
    const c = ctx("clipboard-unavailable", share);
    expect(c.prev?.id).toBe("link-copied");
    expect(c.next?.id).toBe("email-entered");
  });

  it("returns null for unknown ids", () => {
    expect(getNodeContext(spec, "nope")).toBeNull();
  });
});
