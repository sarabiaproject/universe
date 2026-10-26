import { create } from "zustand";

import { getMainPath } from "@/lib/graph";
import { BUNDLED_MAPS } from "@/maps";

type MapState = {
  mapId: string;
  selectedId: string | null;
  /** Bumped whenever the canvas should center on the selected node. */
  focusNonce: number;
  /** Bumped whenever the canvas should fit the main path. */
  fitNonce: number;
  setMap: (mapId: string) => void;
  select: (id: string, options?: { center?: boolean }) => void;
  fitMainPath: () => void;
};

function firstMainNode(mapId: string): string | null {
  const entry = BUNDLED_MAPS.find((m) => m.id === mapId);
  return entry ? (getMainPath(entry.map)[0] ?? entry.map.nodes[0]?.id ?? null) : null;
}

const initialMapId = BUNDLED_MAPS[0].id;

export const useMapStore = create<MapState>((set) => ({
  mapId: initialMapId,
  selectedId: firstMainNode(initialMapId),
  focusNonce: 0,
  fitNonce: 0,
  setMap: (mapId) =>
    set((s) => ({ mapId, selectedId: firstMainNode(mapId), fitNonce: s.fitNonce + 1 })),
  select: (id, options) =>
    set((s) => ({
      selectedId: id,
      focusNonce: options?.center ? s.focusNonce + 1 : s.focusNonce,
    })),
  fitMainPath: () => set((s) => ({ fitNonce: s.fitNonce + 1 })),
}));
