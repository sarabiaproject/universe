import { beforeEach, describe, expect, it, vi } from "vitest";

import { createNode } from "@/lib/editor";
import { BUNDLED_MAPS } from "@/maps";
import { currentMap, isBundled, STORAGE_KEY, useMapStore } from "@/store/map-store";

// In-memory localStorage so persistence can be checked in Node. Hoisted: the
// store picks its storage when the module loads.
const store = vi.hoisted(() => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    },
  });
  return data;
});

const initial = useMapStore.getState();
const state = () => useMapStore.getState();
const map = () => currentMap(state());

function addNode(position = { x: 0, y: 0 }) {
  const node = createNode(map(), position);
  state().edit({ type: "addNode", node });
  return node.id;
}

beforeEach(() => {
  store.clear();
  useMapStore.setState(initial, true);
});

describe("map store", () => {
  it("starts on the first example in view mode", () => {
    expect(state().mapId).toBe(BUNDLED_MAPS[0].id);
    expect(state().mode).toBe("view");
    expect(state().selectedId).toBe("problema");
  });

  it("creates an empty map in edit mode", () => {
    const id = state().createMap();
    expect(state().mapId).toBe(id);
    expect(state().mode).toBe("edit");
    expect(map()).toMatchObject({ title: "Mapa sin título", nodes: [], edges: [] });
    state().createMap();
    expect(map().title).toBe("Mapa sin título 2");
  });

  it("never edits the bundled maps; editing an example works on a copy", () => {
    const before = structuredClone(BUNDLED_MAPS[0].map);
    state().edit({ type: "updateMap", patch: { title: "hack" } });
    expect(BUNDLED_MAPS[0].map).toEqual(before);

    state().setMode("edit");
    expect(isBundled(state().mapId)).toBe(false);
    expect(state().mode).toBe("edit");
    expect(map().title).toBe("universe: el spec (copia)");
    expect(map().nodes.every((n) => n.position)).toBe(true);
    state().edit({ type: "updateNode", id: "problema", patch: { title: "Editado" } });
    expect(map().nodes[0].title).toBe("Editado");
    expect(BUNDLED_MAPS[0].map).toEqual(before);
  });

  it("undo/redo cover create, edit, move, connect and delete", () => {
    state().createMap();
    const a = addNode();
    const b = addNode({ x: 300, y: 0 });
    expect(state().selectedId).toBe(b);
    state().edit({ type: "updateNode", id: a, patch: { title: "Inicio" } });
    state().edit({ type: "moveNodes", positions: { a: { x: 0, y: 50 }, [b]: { x: 320, y: 0 } } });
    state().edit({ type: "addEdge", edge: { from: a, to: b, type: "main" } });
    state().requestDeleteNode(b); // has an edge: asks first
    expect(state().confirmDeleteId).toBe(b);
    state().confirmDelete();
    const final = structuredClone(map());
    expect(final.nodes).toHaveLength(1);
    expect(state().selectedId).toBeNull();

    const steps = [
      (m: typeof final) => expect(m.nodes).toHaveLength(2), // delete undone
      (m: typeof final) => expect(m.edges).toHaveLength(0), // connect undone
      (m: typeof final) => expect(m.nodes[1].position).toEqual({ x: 300, y: 0 }), // move undone
      (m: typeof final) => expect(m.nodes[0].title).toBe("Nuevo nodo"), // edit undone
      (m: typeof final) => expect(m.nodes).toHaveLength(1), // second create undone
      (m: typeof final) => expect(m.nodes).toHaveLength(0), // first create undone
    ];
    for (const check of steps) {
      state().undo();
      check(map());
    }
    state().undo(); // nothing left
    expect(map().nodes).toHaveLength(0);

    for (let i = 0; i < steps.length; i++) state().redo();
    expect(map()).toEqual(final);
  });

  it("typing in one field is a single undo step", () => {
    state().createMap();
    const a = addNode();
    for (const title of ["H", "Ho", "Hol", "Hola"]) {
      state().edit({ type: "updateNode", id: a, patch: { title } }, { key: `${a}:title` });
    }
    state().undo();
    expect(map().nodes[0].title).toBe("Nuevo nodo");
  });

  it("deletes nodes without edges right away", () => {
    state().createMap();
    const a = addNode();
    state().requestDeleteNode(a);
    expect(state().confirmDeleteId).toBeNull();
    expect(map().nodes).toHaveLength(0);
  });

  it("renames, duplicates and deletes user maps", () => {
    const id = state().createMap();
    addNode();
    state().renameMap(id, "Mi flujo");
    expect(map().title).toBe("Mi flujo");
    state().renameMap(id, "   ");
    expect(map().title).toBe("Mi flujo");

    const copy = state().duplicateMap()!;
    expect(state().mapId).toBe(copy);
    expect(map().title).toBe("Mi flujo (copia)");
    expect(map().nodes).toHaveLength(1);

    state().deleteMap(copy);
    expect(state().userMaps.map((m) => m.id)).toEqual([id]);
    expect(state().mapId).toBe(id);
    state().deleteMap(id);
    expect(state().mapId).toBe(BUNDLED_MAPS[0].id);
    expect(state().mode).toBe("view");
  });

  it("switching maps resets selection and history", () => {
    state().createMap();
    addNode();
    state().setMap("share-modal");
    expect(state().history.past).toHaveLength(0);
    expect(state().mode).toBe("view");
    expect(state().selectedId).toBe("default");
  });

  it("persists my maps, the open map and the mode across reloads", async () => {
    const id = state().createMap();
    addNode();
    state().edit({ type: "updateNode", id: map().nodes[0].id, patch: { title: "Guardado" } });
    const saved = structuredClone(map());
    expect(store.get(STORAGE_KEY)).toContain("Guardado");

    // "Reload": fresh in-memory state, same localStorage. (Resetting the state writes it, so restore the snapshot.)
    const snapshot = store.get(STORAGE_KEY)!;
    useMapStore.setState(initial, true);
    store.set(STORAGE_KEY, snapshot);
    await useMapStore.persist.rehydrate();
    expect(state().hydrated).toBe(true);
    expect(state().mapId).toBe(id);
    expect(state().mode).toBe("edit");
    expect(map()).toEqual(saved);
    expect(state().selectedId).toBe(saved.nodes[0].id);
  });

  it("drops invalid stored maps and unknown map ids", async () => {
    store.set(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        state: {
          mapId: "m-gone",
          mode: "edit",
          userMaps: [
            { id: "m-bad", map: { version: 1, title: "", summary: "", nodes: [], edges: [] }, updatedAt: 1 },
            { id: "m-ok", map: { version: 1, title: "Bien", summary: "", nodes: [], edges: [] }, updatedAt: 1 },
          ],
        },
      }),
    );
    await useMapStore.persist.rehydrate();
    expect(state().userMaps.map((m) => m.id)).toEqual(["m-ok"]);
    expect(state().mapId).toBe(BUNDLED_MAPS[0].id);
    expect(state().mode).toBe("view");
  });
});
