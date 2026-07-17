import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
const KEY = "seanaya.theme";
const listeners = new Set<() => void>();

function read(): Theme {
  if (typeof window === "undefined") return "light";
  const v = localStorage.getItem(KEY);
  return v === "dark" || v === "dusk" || v === "night" ? "dark" : "light";
}

let current: Theme = "light";

export function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = "light";
  document.documentElement.classList.remove("dark");
  localStorage.setItem(KEY, "light");
  current = "light";
  listeners.forEach((l) => l());
}

export function bootTheme() {
  current = "light";
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = "light";
    document.documentElement.classList.remove("dark");
  }
}

const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const getSnapshot = () => "light" as Theme;

export function useTheme(): [Theme, (t: Theme) => void] {
  const t = useSyncExternalStore(subscribe, getSnapshot, () => "light" as Theme);
  return [t, applyTheme];
}
