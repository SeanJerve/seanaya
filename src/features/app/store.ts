import { useSyncExternalStore } from "react";

export type TabKey = "home" | "calendar" | "memories" | "wall" | "stickers" | "pet";
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
  activeRoamingPetIds: string[];
  isPetVisible: boolean;
};
 
const getLocalPetIds = () => {
  if (typeof window === "undefined") return [];
  const val = localStorage.getItem("active_roaming_pet_ids");
  return val ? val.split(",").filter(Boolean) : [];
};
const getLocalPetVisible = () => typeof window !== "undefined" ? localStorage.getItem("is_pet_visible") !== "false" : true;

let state: State = { 
  tab: "home", 
  sheet: null, 
  confirmDialog: null, 
  activeStickerPageId: null,
  activeRoamingPetIds: getLocalPetIds(),
  isPetVisible: getLocalPetVisible()
};
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
    activeRoamingPetIds: s.activeRoamingPetIds,
    isPetVisible: s.isPetVisible,
    setTab: (t: TabKey) => { state = { ...state, tab: t, sheet: null }; emit(); },
    openSheet: (k: Exclude<SheetKey, null>) => { state = { ...state, sheet: k }; emit(); },
    closeSheet: () => { state = { ...state, sheet: null }; emit(); },
    confirm: (options: ConfirmOptions) => { state = { ...state, confirmDialog: options }; emit(); },
    closeConfirm: () => { state = { ...state, confirmDialog: null }; emit(); },
    setActiveStickerPageId: (id: string | null) => { state = { ...state, activeStickerPageId: id }; emit(); },
    toggleActiveRoamingPetId: (id: string) => {
      let ids = [...state.activeRoamingPetIds];
      if (ids.includes(id)) {
        ids = ids.filter((x) => x !== id);
      } else {
        ids.push(id);
      }
      localStorage.setItem("active_roaming_pet_ids", ids.join(","));
      state = { ...state, activeRoamingPetIds: ids };
      emit();
    },
    setActiveRoamingPetIds: (ids: string[]) => {
      localStorage.setItem("active_roaming_pet_ids", ids.join(","));
      state = { ...state, activeRoamingPetIds: ids };
      emit();
    },
    setIsPetVisible: (v: boolean) => {
      localStorage.setItem("is_pet_visible", v ? "true" : "false");
      state = { ...state, isPetVisible: v };
      emit();
    },
  };
}
