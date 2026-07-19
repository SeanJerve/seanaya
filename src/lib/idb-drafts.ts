/**
 * Tiny IndexedDB draft store — one object per (kind, key).
 * Used by every add-sheet for offline-safe autosave.
 * Sync-on-online is triggered by the sheet's mutation flushing the draft.
 */
import { useEffect, useRef, useState } from "react";

const DB_NAME = "seanaya-drafts";
const STORE = "drafts";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    r.onsuccess = () => resolve(r.result as T);
    r.onerror = () => reject(r.error);
  });
}

export const drafts = {
  get: <T>(key: string) =>
    tx<T | undefined>("readonly", (s) => s.get(key) as IDBRequest<T | undefined>),
  set: (key: string, value: unknown) => tx("readwrite", (s) => s.put(value, key)),
  del: (key: string) => tx("readwrite", (s) => s.delete(key)),
  keys: () => tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys()),
};

/** Autosaves `state` under `key` (debounced). Restores once on mount. */
export function useDraft<T extends object>(
  key: string,
  state: T,
  setState: (v: T) => void,
  enabled = true,
) {
  const loaded = useRef(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (!enabled || loaded.current) return;
    loaded.current = true;
    drafts.get<T>(key).then((v) => {
      if (v) setState({ ...state, ...v });
      setHydrated(true);
    });
  }, [key, enabled]);

  useEffect(() => {
    if (!enabled || !hydrated) return;
    const id = setTimeout(() => {
      drafts.set(key, state).catch(() => {});
    }, 350);
    return () => clearTimeout(id);
  }, [key, state, enabled, hydrated]);

  return {
    clear: () => drafts.del(key).catch(() => {}),
    hydrated,
  };
}

/** True when browser reports online. */
export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}
