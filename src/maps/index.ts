import { parseSystemMap, type SystemMap } from "@/lib/schema";

import lanzarOpenSource from "./lanzar-open-source.json";
import miSemana from "./mi-semana.json";
import shareModal from "./share-modal.json";
import universeSpec from "./universe-spec.json";

/** `description` is the one line shown on the example's card in the gallery. */
export type BundledMap = { id: string; description: string; map: SystemMap };

function load(id: string, description: string, raw: unknown): BundledMap {
  const result = parseSystemMap(raw);
  if (!result.ok) {
    throw new Error(`Mapa "${id}" inválido:\n${result.errors.join("\n")}`);
  }
  return { id, description, map: result.map };
}

export const BUNDLED_MAPS: BundledMap[] = [
  load("universe-spec", "Esta misma app, mapeada con ella: idea, stack y slices.", universeSpec),
  load("share-modal", "Los estados de un modal para compartir, con sus errores.", shareModal),
  load("mi-semana", "Rutinas y hábitos de una semana, y cómo volver cuando se rompen.", miSemana),
  load("lanzar-open-source", "Un plan de proyecto: de la idea al lanzamiento y al mantenimiento.", lanzarOpenSource),
];
