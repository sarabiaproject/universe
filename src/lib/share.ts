import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

import { parseImportValue, type ImportResult } from "@/lib/io";
import type { SystemMap } from "@/lib/schema";

/** Hash prefix of a shared map: `#m=<lz-string>`. */
export const SHARE_PREFIX = "#m=";

/** Past this length some apps and browsers may cut the link. */
export const SHARE_URL_WARN_LENGTH = 8000;

export function encodeMap(map: SystemMap): string {
  return compressToEncodedURIComponent(JSON.stringify(map));
}

/** Link to `map` on the page at `base` (any existing hash is replaced). */
export function shareUrl(map: SystemMap, base: string): string {
  return `${base.split("#")[0]}${SHARE_PREFIX}${encodeMap(map)}`;
}

/** True when `hash` (as in `location.hash`) carries a shared map. */
export function isShareHash(hash: string): boolean {
  return hash.startsWith(SHARE_PREFIX);
}

/**
 * Reads the map in a `#m=` hash. Never throws: a cut, corrupt or invalid link
 * comes back as `ok: false` with messages in Spanish.
 */
export function decodeShareHash(hash: string): ImportResult {
  const data = hash.slice(SHARE_PREFIX.length);
  if (!isShareHash(hash) || data.length === 0) {
    return { ok: false, errors: ["El enlace no contiene ningún mapa."] };
  }
  let text: string | null = null;
  try {
    text = decompressFromEncodedURIComponent(data);
  } catch {
    text = null;
  }
  if (!text) {
    return { ok: false, errors: ["El enlace está dañado o incompleto: no se pudo leer el mapa. Pide que te lo vuelvan a enviar."] };
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["El enlace está dañado o incompleto: el mapa no es JSON válido."] };
  }
  return parseImportValue(value);
}
