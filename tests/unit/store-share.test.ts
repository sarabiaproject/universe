import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SystemMap } from "@/lib/schema";
import { shareUrl } from "@/lib/share";
import { BUNDLED_MAPS } from "@/maps";
import { currentMap, SHARED_ID, STORAGE_KEY, useMapStore } from "@/store/map-store";

const { store } = vi.hoisted(() => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    },
  });
  return { store: data };
});

const initial = useMapStore.getState();
const state = () => useMapStore.getState();
const persisted = () => JSON.parse(store.get(STORAGE_KEY) ?? "null")?.state;

const map: SystemMap = {
  version: 1,
  title: "Compartido",
  summary: "Un mapa que llega por enlace",
  nodes: [
    { id: "a", title: "A", summary: "", details: "", track: "main", position: { x: 0, y: 0 } },
    { id: "b", title: "B", summary: "", details: "", track: "main", position: { x: 300, y: 0 } },
  ],
  edges: [{ from: "a", to: "b", type: "main" }],
};
const hashOf = (m: SystemMap) => shareUrl(m, "http://x/").slice("http://x/".length);

beforeEach(() => {
  store.clear();
  useMapStore.setState(initial, true);
});

describe("shared links in the store", () => {
  it("ignores hashes without a map", () => {
    expect(state().openLink("")).toBeNull();
    expect(state().openLink("#detalle")).toBeNull();
    expect(state().mapId).toBe(BUNDLED_MAPS[0].id);
  });

  it("opens a link read-only, exactly as sent, without saving it", () => {
    state().openLink(hashOf(map));
    expect(state().mapId).toBe(SHARED_ID);
    expect(state().mode).toBe("view");
    expect(currentMap(state())).toEqual(map);
    expect(state().selectedId).toBe("a");
    // Read-only: edits are ignored.
    state().edit({ type: "updateMap", patch: { title: "Otro" } });
    expect(currentMap(state()).title).toBe("Compartido");
    // Not persisted: a reload goes back to the map that was open.
    expect(persisted().userMaps).toEqual([]);
    expect(persisted().mapId).toBe(BUNDLED_MAPS[0].id);
  });

  it("saves the shared map in Mis mapas and opens it in edit mode", () => {
    state().openLink(hashOf(map));
    const id = state().saveShared();
    expect(id).toBeTruthy();
    expect(state().mapId).toBe(id);
    expect(state().mode).toBe("edit");
    expect(state().shared).toBeNull();
    expect(persisted().userMaps).toEqual([{ id, map, updatedAt: expect.any(Number) }]);
    expect(state().notice).toBe("Guardado en Mis mapas: Compartido");
  });

  it("Editar on a shared map saves it first", () => {
    state().openLink(hashOf(map));
    state().setMode("edit");
    expect(state().mode).toBe("edit");
    expect(state().userMaps).toHaveLength(1);
    expect(state().userMaps[0].map).toEqual(map);
  });

  it("shows an error and keeps the current map for a corrupt link", () => {
    const result = state().openLink("#m=esto-no-es-un-mapa");
    expect(result?.ok).toBe(false);
    expect(state().mapId).toBe(BUNDLED_MAPS[0].id);
    expect(state().alert?.title).toBe("No se pudo abrir el enlace");
    expect(state().alert?.items[0]).toMatch(/dañado o incompleto/);
    state().dismissAlert();
    expect(state().alert).toBeNull();
  });

  it("can go back to the shared map from the picker until it is saved", () => {
    state().openLink(hashOf(map));
    state().setMap(BUNDLED_MAPS[1].id);
    expect(currentMap(state()).title).toBe(BUNDLED_MAPS[1].map.title);
    state().setMap(SHARED_ID);
    expect(currentMap(state())).toEqual(map);
  });
});

describe("import in the store", () => {
  it("adds a new map to Mis mapas, unique title, fixed positions", () => {
    const withoutPositions: SystemMap = { ...map, nodes: map.nodes.map((n) => ({ ...n, position: undefined })) };
    const first = state().importMap(withoutPositions);
    expect(state().mapId).toBe(first);
    const saved = currentMap(state());
    expect(saved.nodes.every((n) => n.position)).toBe(true);
    expect(saved.title).toBe("Compartido");
    state().importMap(map);
    expect(currentMap(state()).title).toBe("Compartido 2");
    expect(persisted().userMaps).toHaveLength(2);
  });

  it("keeps a map with full positions exactly", () => {
    state().importMap(map);
    expect(currentMap(state())).toEqual(map);
  });

  it("opens drafts with problems in edit mode and says so", () => {
    state().importMap({ ...map, edges: [] }, ["problema"]);
    expect(state().mode).toBe("edit");
    expect(state().notice).toMatch(/1 problema del camino principal/);
  });
});
