import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";

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
import { backup, openStorage, safeGet, safeSet, STORAGE_KEY, STORAGE_MESSAGES } from "@/lib/storage";
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
  /** Visible warning about saving (blocked storage, full storage, backups); null when all is well. */
  storageWarning: string | null;
  /** Node to focus after a delete (the canvas focuses it, or itself when null). */
  refocus: { nodeId: string | null; nonce: number };

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
  dismissStorageWarning: () => void;
  /** Another tab saved "Mis mapas": take its maps, keep this tab's open map and mode. */
  syncFromStorage: (raw: string | null) => void;
};

export { STORAGE_KEY };
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

type Persisted = Pick<MapState, "userMaps" | "mapId" | "mode">;

/**
 * Keeps only stored maps that pass the field rules and have a unique id that is
 * not an example's. `dropped` counts what was left out. Unknown map ids fall back
 * to the first example.
 */
export function restore(persisted: unknown): Persisted & { dropped: number } {
  const raw = (persisted ?? {}) as Partial<Record<keyof Persisted, unknown>>;
  const userMaps: StoredMap[] = [];
  let dropped = 0;
  if (raw.userMaps !== undefined && !Array.isArray(raw.userMaps)) dropped++;
  if (Array.isArray(raw.userMaps)) {
    for (const entry of raw.userMaps as Partial<StoredMap>[]) {
      const result = parseDraftMap(entry?.map);
      const id = entry?.id;
      if (result.ok && typeof id === "string" && !isBundled(id) && !userMaps.some((m) => m.id === id)) {
        userMaps.push({ id, map: result.map, updatedAt: Number(entry.updatedAt) || 0 });
      } else {
        dropped++;
      }
    }
  }
  const mapId =
    typeof raw.mapId === "string" && (isBundled(raw.mapId) || userMaps.some((m) => m.id === raw.mapId))
      ? raw.mapId
      : DEFAULT_MAP_ID;
  const mode: Mode = raw.mode === "edit" && !isBundled(mapId) ? "edit" : "view";
  return { userMaps, mapId, mode, dropped };
}

const { storage: textStorage, persistent } = openStorage();

/** What the last read found, so `merge` can back the raw value up before it is overwritten. */
const lastRead: { raw: string | null; unreadable: boolean } = { raw: null, unreadable: false };
const lastWrite = { failing: false };

const persistStorage: PersistStorage<Persisted> = {
  getItem: (name) => {
    const raw = safeGet(textStorage, name);
    lastRead.raw = raw;
    lastRead.unreadable = false;
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as StorageValue<Persisted>;
    } catch {
      lastRead.unreadable = true; // corrupt JSON: merge backs it up
      return null;
    }
  },
  setItem: (name, value) => {
    const ok = safeSet(textStorage, name, JSON.stringify(value));
    // Quota exceeded (or blocked mid-session): warn when saving starts failing, not on
    // every write (the warning itself is a state change that writes again).
    const startedFailing = !ok && !lastWrite.failing;
    lastWrite.failing = !ok;
    if (startedFailing) useMapStore.setState({ storageWarning: STORAGE_MESSAGES.full });
  },
  removeItem: (name) => {
    try {
      textStorage.removeItem(name);
    } catch {
      // Nothing to do.
    }
  },
};

/** Stored version of the persisted state. Bump it and extend `migrate` when the format changes. */
export const STORAGE_VERSION = 1;

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
          // Edges are selected by index: follow the same from → to after the edit, or drop it.
          const picked = s.selectedEdge !== null ? currentMap(s).edges[s.selectedEdge] : undefined;
          const index = picked ? map.edges.findIndex((e) => e.from === picked.from && e.to === picked.to) : -1;
          const selectedEdge = index >= 0 ? index : null;
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
        storageWarning: null,
        refocus: { nodeId: null, nonce: 0 },

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
          // Keyboard and screen reader users keep their place: focus a neighbour of what was deleted.
          if (action.type === "deleteNode" || action.type === "deleteEdge") {
            set((st) => ({ refocus: { nodeId: focusAfterDelete(map, action), nonce: st.refocus.nonce + 1 } }));
          }
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
        dismissStorageWarning: () => set({ storageWarning: null }),
        syncFromStorage: (raw) => {
          if (raw === null) return;
          let parsed: StorageValue<Persisted>;
          try {
            parsed = JSON.parse(raw) as StorageValue<Persisted>;
          } catch {
            return;
          }
          if (parsed.version !== STORAGE_VERSION) return;
          const { userMaps, dropped } = restore(parsed.state);
          const s = get();
          // Identical maps: nothing to do (and no write back, which would bounce between tabs).
          if (dropped > 0 || JSON.stringify(userMaps) === JSON.stringify(s.userMaps)) return;
          if (!isBundled(s.mapId) && !userMaps.some((m) => m.id === s.mapId)) {
            open(userMaps[0]?.id ?? DEFAULT_MAP_ID, userMaps, "view");
            return;
          }
          const map = currentMap({ userMaps, mapId: s.mapId });
          const changed = JSON.stringify(map) !== JSON.stringify(currentMap(s));
          // Set as is (no new updatedAt): a write here would bounce back to the other tab.
          set({ userMaps });
          if (!changed) return;
          // The open map changed in the other tab: its undo history no longer applies.
          set({
            history: emptyHistory(),
            selectedId: s.selectedId && map.nodes.some((n) => n.id === s.selectedId) ? s.selectedId : null,
            selectedEdge: null,
            confirmDeleteId: null,
          });
        },
      };
    },
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: persistStorage,
      // Hook for future formats. Today any other version is read as v1 and validated;
      // whatever does not pass is backed up in `merge` before being overwritten.
      migrate: (persisted, version) => {
        lastRead.unreadable ||= version !== STORAGE_VERSION;
        return persisted as Persisted;
      },
      // Read on mount (see MapViewer) so the server render and the first client render match.
      skipHydration: true,
      partialize: (s): Persisted => ({ userMaps: s.userMaps, mapId: s.mapId, mode: s.mode }),
      merge: (persisted, current) => {
        const { dropped, ...restored } = restore(persisted);
        let storageWarning = persistent ? current.storageWarning : STORAGE_MESSAGES.blocked;
        // Never lose data silently: keep the raw value before the next write replaces it.
        if ((dropped > 0 || lastRead.unreadable) && lastRead.raw !== null) {
          const key = backup(textStorage, lastRead.raw);
          storageWarning = key ? STORAGE_MESSAGES.backup(key) : STORAGE_MESSAGES.full;
        }
        return {
          ...current,
          ...restored,
          storageWarning,
          selectedId: firstNode(findMap(restored, restored.mapId)),
          selectedEdge: null,
          history: emptyHistory(),
        };
      },
      onRehydrateStorage: () => () => useMapStore.setState({ hydrated: true }),
    },
  ),
);

/** Where focus goes after a delete: the previous node on the path, the edge's source, or any neighbour. */
function focusAfterDelete(map: SystemMap, action: EditAction): string | null {
  if (action.type === "deleteEdge") return map.edges[action.index]?.from ?? null;
  if (action.type !== "deleteNode") return null;
  const touching = map.edges.filter((e) => e.from === action.id || e.to === action.id);
  const prev = touching.find((e) => e.type === "main" && e.to === action.id)?.from;
  const other = touching.map((e) => (e.from === action.id ? e.to : e.from))[0];
  return prev ?? other ?? null;
}
