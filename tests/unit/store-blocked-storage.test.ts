import { describe, expect, it, vi } from "vitest";

// B1: browsers that block site data make *reading* `localStorage` throw. Hoisted:
// the store picks its storage when the module loads.
vi.hoisted(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("The operation is insecure.", "SecurityError");
    },
  });
});

import { createNode } from "@/lib/editor";
import { currentMap, useMapStore } from "@/store/map-store";

describe("map store with localStorage blocked", () => {
  it("still hydrates, shows the examples and warns that nothing is saved", async () => {
    await useMapStore.persist.rehydrate();
    const state = useMapStore.getState();
    expect(state.hydrated).toBe(true);
    expect(currentMap(state).nodes.length).toBe(26);
    expect(state.storageWarning).toMatch(/no se guardarán/);
  });

  it("editing works in memory for the session", () => {
    const { createMap } = useMapStore.getState();
    createMap();
    const map = currentMap(useMapStore.getState());
    useMapStore.getState().edit({ type: "addNode", node: createNode(map, { x: 0, y: 0 }) });
    expect(currentMap(useMapStore.getState()).nodes).toHaveLength(1);
  });
});
