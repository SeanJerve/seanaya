import { useSyncExternalStore } from "react";

export type TabKey = "home" | "calendar" | "memories" | "wall" | "stickers" | "more";
export type SheetKey =
  | "add-memory"
  | "add-event"
  | "add-note"
  | "add-trip"
  | "add-song"
  | "settings"
  | "notifications"
  | "add-sticker"
  | null;

export type ConfirmOptions = {
  title: string;
  message: string;
  onConfirm: () => void;
};

type State = {
  tab: TabKey;
  sheet: SheetKey;
  confirmDialog: ConfirmOptions | null;
  activeStickerPageId: string | null;
};

let state: State = { tab: "home", sheet: null, confirmDialog: null, activeStickerPageId: null };
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const emit = () => listeners.forEach((l) => l());
const getSnapshot = () => state;

export function useAppStore() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    tab: s.tab,
    sheet: s.sheet,
    confirmDialog: s.confirmDialog,
    activeStickerPageId: s.activeStickerPageId,
    setTab: (t: TabKey) => { state = { ...state, tab: t, sheet: null }; emit(); },
    openSheet: (k: Exclude<SheetKey, null>) => { state = { ...state, sheet: k }; emit(); },
    closeSheet: () => { state = { ...state, sheet: null }; emit(); },
    confirm: (options: ConfirmOptions) => { state = { ...state, confirmDialog: options }; emit(); },
    closeConfirm: () => { state = { ...state, confirmDialog: null }; emit(); },
    setActiveStickerPageId: (id: string | null) => { state = { ...state, activeStickerPageId: id }; emit(); },
  };
}
