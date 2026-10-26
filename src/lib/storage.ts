/**
 * The only place that touches `localStorage` (enforced by ESLint). Reading it can
 * throw (SecurityError when the browser blocks site data) and writing can throw
 * (QuotaExceededError), so every access goes through try/catch.
 */

export const STORAGE_KEY = "universe";
export const BACKUP_PREFIX = `${STORAGE_KEY}:backup-`;

export const STORAGE_MESSAGES = {
  blocked: "Este navegador no permite guardar datos: los cambios no se guardarán al cerrar la página.",
  full: "No se pudo guardar: el almacenamiento del navegador está lleno. Los últimos cambios no se guardaron.",
  backup: (key: string) =>
    `Algunos mapas guardados no se pudieron leer. Se guardó una copia de seguridad en este navegador (${key}).`,
};

export type TextStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function memoryStorage(): TextStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

/** `localStorage` when it can be read, otherwise an in-memory store for this session. */
export function openStorage(): { storage: TextStorage; persistent: boolean } {
  try {
    const storage = globalThis.localStorage;
    if (storage) {
      storage.getItem(STORAGE_KEY); // throws when blocked
      return { storage, persistent: true };
    }
  } catch {
    // Blocked: fall through to memory.
  }
  return { storage: memoryStorage(), persistent: false };
}

/** Writes; false when the browser refused (quota, blocked mid-session). */
export function safeSet(storage: TextStorage, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeGet(storage: TextStorage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/** Keeps a copy of `raw` under a new `universe:backup-<time>` key; returns the key, or null. */
export function backup(storage: TextStorage, raw: string, now = Date.now()): string | null {
  const key = `${BACKUP_PREFIX}${now}`;
  return safeSet(storage, key, raw) ? key : null;
}
