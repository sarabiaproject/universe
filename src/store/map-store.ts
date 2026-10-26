import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import {
  applyEdit,
  emptyHistory,
  record,
  redo as redoHistory,
  undo as undoHistory,
  type EditAction,
  type History,
} from "@/lib/editor";
import { getMainPath } from "@/lib/graph";
import { layoutMap } from "@/lib/layout";
import { parseDraftMap, type SystemMap } from "@/lib/schema";
import { BUNDLED_MAPS } from "@/maps";

export type StoredMap = { id: string; map: SystemMap; updatedAt: number };
export type Mode = "view" | "edit";

type MapState = {
  /** "Mis mapas", persisted in localStorage. Bundled maps are read-only examples. */
  userMaps: StoredMap[];
  mapId: string;
  mode: Mode;
  selectedId: string | null;
  /** Index into `map.edges` of the selected edge (edit mode). */
  selectedEdge: number | null;
  /** Undo/redo of the current map; reset when switching maps. */
  history: History;
  /** Node waiting for the delete confirmation (it has connections). */
  confirmDeleteId: string | null;
  /** Short status message for screen readers ("Copia creada", …). */
  notice: string;
  /** Bumped whenever the canvas should center on the selected node. */
  focusNonce: number;
  /** Bumped whenever the canvas should fit the map. */
  fitNonce: number;
  /** localStorage has been read (the UI waits for it to avoid a flash). */
  hydrated: boolean;

  setMap: (mapId: string) => void;
  setMode: (mode: Mode) => void;
  select: (id: string, options?: { center?: boolean }) => void;
  selectEdge: (index: number) => void;
  clearSelection: () => void;
  fitMainPath: () => void;
  /** Applies an edit to the current user map. `key` merges consecutive edits into one undo step. */
  edit: (action: EditAction, options?: { key?: string }) => void;
  undo: () => void;
  redo: () => void;
  requestDeleteNode: (id: string) => void;
  confirmDelete: () => void;
  cancelDelete: () => void;
  createMap: () => string;
  duplicateMap: (id?: string) => string | null;
  renameMap: (id: string, title: string) => void;
  deleteMap: (id: string) => void;
};

export const STORAGE_KEY = "universe";
const DEFAULT_MAP_ID = BUNDLED_MAPS[0].id;

export function isBundled(mapId: string) {
  return BUNDLED_MAPS.some((m) => m.id === mapId);
}

export function findMap(state: Pick<MapState, "userMaps">, mapId: string): SystemMap | null {
  return (
    state.userMaps.find((m) => m.id === mapId)?.map ?? BUNDLED_MAPS.find((m) => m.id === mapId)?.map ?? null
  );
}

/** The map on screen. */
export function currentMap(state: Pick<MapState, "userMaps" | "mapId">): SystemMap {
  return findMap(state, state.mapId) ?? BUNDLED_MAPS[0].map;
}

function firstNode(map: SystemMap | null): string | null {
  return map ? (getMainPath(map)[0] ?? map.nodes[0]?.id ?? null) : null;
}

function newId() {
  return `m-${crypto.randomUUID().slice(0, 8)}`;
}

function uniqueTitle(userMaps: StoredMap[], base: string) {
  const titles = new Set(userMaps.map((m) => m.map.title));
  if (!titles.has(base)) return base;
  let i = 2;
  while (titles.has(`${base} ${i}`)) i++;
  return `${base} ${i}`;
}

/** Fixes every node at its computed position so dragging one does not move the rest. */
function withPositions(map: SystemMap): SystemMap {
  const positions = layoutMap(map);
  return { ...map, nodes: map.nodes.map((n) => ({ ...n, position: n.position ?? positions[n.id] })) };
}

const memory = new Map<string, string>();
const memoryStorage: StateStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => void memory.set(key, value),
  removeItem: (key) => void memory.delete(key),
};

type Persisted = Pick<MapState, "userMaps" | "mapId" | "mode">;

/** Keeps only stored maps that still pass the field rules; unknown map ids fall back to the first example. */
function restore(persisted: unknown): Persisted {
  const raw = (persisted ?? {}) as Partial<Record<keyof Persisted, unknown>>;
  const userMaps: StoredMap[] = [];
  if (Array.isArray(raw.userMaps)) {
    for (const entry of raw.userMaps as Partial<StoredMap>[]) {
      const result = parseDraftMap(entry?.map);
      if (result.ok && typeof entry.id === "string") {
        userMaps.push({ id: entry.id, map: result.map, updatedAt: Number(entry.updatedAt) || 0 });
      }
    }
  }
  const mapId =
    typeof raw.mapId === "string" && (isBundled(raw.mapId) || userMaps.some((m) => m.id === raw.mapId))
      ? raw.mapId
      : DEFAULT_MAP_ID;
  const mode: Mode = raw.mode === "edit" && !isBundled(mapId) ? "edit" : "view";
  return { userMaps, mapId, mode };
}

export const useMapStore = create<MapState>()(
  persist(
    (set, get) => {
      /** Switches to `mapId` with a fresh selection and history. */
      const open = (mapId: string, userMaps = get().userMaps, mode?: Mode) => {
        const map = findMap({ userMaps }, mapId);
        set((s) => ({
          userMaps,
          mapId,
          mode: isBundled(mapId) ? "view" : (mode ?? s.mode),
          selectedId: firstNode(map),
          selectedEdge: null,
          history: emptyHistory(),
          confirmDeleteId: null,
          fitNonce: s.fitNonce + 1,
        }));
      };

      /** Replaces the current user map and keeps the selection pointing at things that exist. */
      const replaceCurrent = (map: SystemMap, history: History) => {
        set((s) => {
          const selectedId = s.selectedId && map.nodes.some((n) => n.id === s.selectedId) ? s.selectedId : null;
          const selectedEdge = s.selectedEdge !== null && map.edges[s.selectedEdge] ? s.selectedEdge : null;
          return {
            history,
            selectedId,
            selectedEdge: selectedId ? null : selectedEdge,
            userMaps: s.userMaps.map((m) => (m.id === s.mapId ? { ...m, map, updatedAt: Date.now() } : m)),
          };
        });
      };

      return {
        userMaps: [],
        mapId: DEFAULT_MAP_ID,
        mode: "view",
        selectedId: firstNode(BUNDLED_MAPS[0].map),
        selectedEdge: null,
        history: emptyHistory(),
        confirmDeleteId: null,
        notice: "",
        focusNonce: 0,
        fitNonce: 0,
        hydrated: false,

        setMap: (mapId) => open(mapId),
        setMode: (mode) => {
          const { mapId } = get();
          if (mode === "edit" && isBundled(mapId)) {
            // Examples are read-only: editing one works on a copy.
            const copy = get().duplicateMap(mapId);
            if (copy) set({ mode: "edit", notice: "Los ejemplos son de solo lectura: se creó una copia editable." });
            return;
          }
          set({ mode, selectedEdge: null, confirmDeleteId: null });
        },
        select: (id, options) =>
          set((s) => ({
            selectedId: id,
            selectedEdge: null,
            focusNonce: options?.center ? s.focusNonce + 1 : s.focusNonce,
          })),
        selectEdge: (index) => set({ selectedEdge: index, selectedId: null }),
        clearSelection: () => set({ selectedId: null, selectedEdge: null }),
        fitMainPath: () => set((s) => ({ fitNonce: s.fitNonce + 1 })),

        edit: (action, options) => {
          const s = get();
          if (isBundled(s.mapId)) return;
          const map = currentMap(s);
          const next = applyEdit(map, action);
          if (next === map) return;
          replaceCurrent(next, record(s.history, map, options?.key ?? null));
          if (action.type === "addNode") {
            set((st) => ({ selectedId: action.node.id, selectedEdge: null, focusNonce: st.focusNonce + 1 }));
          }
        },
        undo: () => {
          const s = get();
          const result = undoHistory(s.history, currentMap(s));
          if (result) replaceCurrent(result.map, result.history);
        },
        redo: () => {
          const s = get();
          const result = redoHistory(s.history, currentMap(s));
          if (result) replaceCurrent(result.map, result.history);
        },

        requestDeleteNode: (id) => {
          const map = currentMap(get());
          if (map.edges.some((e) => e.from === id || e.to === id)) set({ confirmDeleteId: id });
          else get().edit({ type: "deleteNode", id });
        },
        confirmDelete: () => {
          const id = get().confirmDeleteId;
          set({ confirmDeleteId: null });
          if (id) get().edit({ type: "deleteNode", id });
        },
        cancelDelete: () => set({ confirmDeleteId: null }),

        createMap: () => {
          const { userMaps } = get();
          const id = newId();
          const map: SystemMap = {
            version: 1,
            title: uniqueTitle(userMaps, "Mapa sin título"),
            summary: "",
            nodes: [],
            edges: [],
          };
          open(id, [...userMaps, { id, map, updatedAt: Date.now() }], "edit");
          set({ notice: `Mapa creado: ${map.title}` });
          return id;
        },
        duplicateMap: (source = get().mapId) => {
          const { userMaps } = get();
          const original = findMap({ userMaps }, source);
          if (!original) return null;
          const id = newId();
          const map = { ...withPositions(structuredClone(original)), title: uniqueTitle(userMaps, `${original.title} (copia)`) };
          open(id, [...userMaps, { id, map, updatedAt: Date.now() }]);
          set({ notice: `Copia creada: ${map.title}` });
          return id;
        },
        renameMap: (id, title) => {
          if (!title.trim()) return;
          if (id === get().mapId) {
            get().edit({ type: "updateMap", patch: { title } });
            return;
          }
          set((s) => ({
            userMaps: s.userMaps.map((m) => (m.id === id ? { ...m, map: { ...m.map, title }, updatedAt: Date.now() } : m)),
          }));
        },
        deleteMap: (id) => {
          const s = get();
          const userMaps = s.userMaps.filter((m) => m.id !== id);
          const title = s.userMaps.find((m) => m.id === id)?.map.title ?? "";
          if (s.mapId === id) open(userMaps[0]?.id ?? DEFAULT_MAP_ID, userMaps, "view");
          else set({ userMaps });
          set({ notice: `Mapa borrado: ${title}` });
        },
      };
    },
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => (typeof localStorage === "undefined" ? memoryStorage : localStorage)),
      // Read on mount (see MapViewer) so the server render and the first client render match.
      skipHydration: true,
      partialize: (s): Persisted => ({ userMaps: s.userMaps, mapId: s.mapId, mode: s.mode }),
      merge: (persisted, current) => {
        const restored = restore(persisted);
        return {
          ...current,
          ...restored,
          selectedId: firstNode(findMap(restored, restored.mapId)),
          selectedEdge: null,
          history: emptyHistory(),
        };
      },
      onRehydrateStorage: () => () => useMapStore.setState({ hydrated: true }),
    },
  ),
);
