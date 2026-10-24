import { parseSystemMap, type SystemMap } from "@/lib/schema";

import shareModal from "./share-modal.json";
import universeSpec from "./universe-spec.json";

export type BundledMap = { id: string; map: SystemMap };

function load(id: string, raw: unknown): BundledMap {
  const result = parseSystemMap(raw);
  if (!result.ok) {
    throw new Error(`Mapa "${id}" inválido:\n${result.errors.join("\n")}`);
  }
  return { id, map: result.map };
}

export const BUNDLED_MAPS: BundledMap[] = [
  load("universe-spec", universeSpec),
  load("share-modal", shareModal),
];
