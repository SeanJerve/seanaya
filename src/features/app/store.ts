import { useSyncExternalStore } from "react";

export type PanelKey =
  | "memory" | "event" | "note" | "trip" | "music"
  | "capsule" | "garden" | "pets" | "wall" | "vault"
  | "calendar" | "dashboard" | null;

let panel: PanelKey = null;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const getSnapshot = () => panel;

export function usePanel() {
  const openPanel = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setPanel = (p: PanelKey) => { panel = p; listeners.forEach((l) => l()); };
  const togglePanel = (p: Exclude<PanelKey, null>) => setPanel(openPanel === p ? null : p);
  return { openPanel, setPanel, togglePanel };
}
