import { useSyncExternalStore } from "react";

export type Theme = "light" | "dusk" | "night";
const KEY = "seanaya.theme";
const listeners = new Set<() => void>();

function read(): Theme {
  if (typeof window === "undefined") return "light";
  const v = localStorage.getItem(KEY) as Theme | null;
  return v === "dusk" || v === "night" ? v : "light";
}

let current: Theme = "light";

export function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = t;
  localStorage.setItem(KEY, t);
  current = t;
  listeners.forEach((l) => l());
}

export function bootTheme() {
  current = read();
  if (typeof document !== "undefined") document.documentElement.dataset.theme = current;
}

const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const getSnapshot = () => current;

export function useTheme(): [Theme, (t: Theme) => void] {
  const t = useSyncExternalStore(subscribe, getSnapshot, () => "light" as Theme);
  return [t, applyTheme];
}
