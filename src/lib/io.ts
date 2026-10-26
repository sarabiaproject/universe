import { mapProblems, parseDraftMap, parseSystemMap, type SystemMap } from "@/lib/schema";

/**
 * A map read from outside (file, pasted text or link). Maps that break only the
 * main path rules are accepted, like a draft in "Mis mapas" (the editor lists
 * the `problems`); field, id and reference errors are not.
 */
export type ImportResult =
  | { ok: true; map: SystemMap; problems: string[] }
  | { ok: false; errors: string[] };

/** Bigger files are refused before reading them. */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export function parseImportValue(value: unknown): ImportResult {
  const full = parseSystemMap(value);
  if (full.ok) return { ok: true, map: full.map, problems: [] };
  const draft = parseDraftMap(value);
  if (draft.ok) return { ok: true, map: draft.map, problems: mapProblems(draft.map) };
  return { ok: false, errors: draft.errors };
}

/** Line and column of a JSON syntax error, from the engine's message when it says where. */
function syntaxErrorPlace(text: string, error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const lineCol = /line (\d+) column (\d+)/.exec(message);
  if (lineCol) return ` (línea ${lineCol[1]}, columna ${lineCol[2]})`;
  const position = /position (\d+)/.exec(message);
  if (!position) return "";
  const before = text.slice(0, Number(position[1])).split("\n");
  return ` (línea ${before.length}, columna ${before[before.length - 1].length + 1})`;
}

/** Parses the text of a JSON file or of the paste box. Never throws. */
export function parseImportText(text: string): ImportResult {
  if (!text.trim()) return { ok: false, errors: ["No hay nada que importar: pega el JSON de un mapa o elige un archivo."] };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      errors: [`El texto no es JSON válido${syntaxErrorPlace(text, error)}. Revisa comas, comillas y llaves.`],
    };
  }
  return parseImportValue(value);
}

/** The exact `SystemMap` as pretty JSON, ready to import again. */
export function mapToJson(map: SystemMap): string {
  return `${JSON.stringify(map, null, 2)}\n`;
}

/** "Mapa de Ñandú: v2" → "mapa-de-nandu-v2". Never empty. */
export function slugify(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "mapa";
}
