import { create } from "zustand";

export type PanelKey =
  | "memory"
  | "event"
  | "note"
  | "trip"
  | "music"
  | "capsule"
  | "garden"
  | "pets"
  | "wall"
  | "vault"
  | null;

interface AppState {
  openPanel: PanelKey;
  setPanel: (p: PanelKey) => void;
  togglePanel: (p: Exclude<PanelKey, null>) => void;
}

// Minimal internal store (no external dep) — implemented below.
let state: { openPanel: PanelKey } = { openPanel: null };
const listeners = new Set<() => void>();

export function useAppStore(): AppState {
  const [, force] = useForce();
  return {
    openPanel: state.openPanel,
    setPanel: (p) => { state = { openPanel: p }; listeners.forEach((l) => l()); },
    togglePanel: (p) => { state = { openPanel: state.openPanel === p ? null : p }; listeners.forEach((l) => l()); },
  };
  function useForce() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [n, setN] = useStateReact(0);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffectReact(() => {
      const l = () => setN((x) => x + 1);
      listeners.add(l);
      return () => { listeners.delete(l); };
    }, []);
    return [n, setN] as const;
  }
}

// stub the zustand dep away — use React directly
import { useState as useStateReact, useEffect as useEffectReact } from "react";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const create = <T,>(_x: unknown) => null as unknown as T;
