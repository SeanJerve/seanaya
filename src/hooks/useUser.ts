import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

/**
 * The signed-in user, shared by every component.
 * One session read and one auth listener for the whole app, instead of a network
 * round trip per component.
 */
type State = { user: User | null; loading: boolean };
let state: State = { user: null, loading: true };
const subs = new Set<() => void>();
let started = false;

function set(next: State) {
  if (next.user?.id === state.user?.id && next.loading === state.loading && next.user === state.user) return;
  state = next;
  subs.forEach((fn) => fn());
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  supabase.auth
    .getSession()
    .then(({ data }) => set({ user: data.session?.user ?? null, loading: false }))
    .catch((err) => {
      console.error("[useUser] getSession error:", err);
      set({ user: state.user, loading: false });
    });
  supabase.auth.onAuthStateChange((_e, session) => {
    const user = session?.user ?? null;
    // Token refreshes hand back a new object for the same person; keep the old one
    // so components keyed on the user don't re-run for nothing.
    set({ user: user && state.user && user.id === state.user.id ? state.user : user, loading: false });
  });
}

function subscribe(fn: () => void) {
  start();
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => state;

export function useUser() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
