import { useSyncExternalStore } from "react";

export type TabKey = "home" | "calendar" | "memories" | "wall" | "more";
export type SheetKey =
  | "add-memory"
  | "add-event"
  | "add-note"
  | "add-trip"
  | "add-song"
  | "settings"
  | null;

type State = { tab: TabKey; sheet: SheetKey };
let state: State = { tab: "home", sheet: null };
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const emit = () => listeners.forEach((l) => l());
const getSnapshot = () => state;

export function useAppStore() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    tab: s.tab,
    sheet: s.sheet,
    setTab: (t: TabKey) => { state = { ...state, tab: t, sheet: null }; emit(); },
    openSheet: (k: Exclude<SheetKey, null>) => { state = { ...state, sheet: k }; emit(); },
    closeSheet: () => { state = { ...state, sheet: null }; emit(); },
  };
}
