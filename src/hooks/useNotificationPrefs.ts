import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "./useUser";

export type PrefKind = "memory" | "event" | "trip" | "note" | "song" | "hug" | "capsule";
export type Prefs = Record<PrefKind, boolean>;

const DEFAULT: Prefs = {
  memory: true,
  event: true,
  trip: true,
  note: true,
  song: true,
  hug: true,
  capsule: true,
};

export function useNotificationPrefs() {
  const { user } = useUser();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["notification-prefs", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Prefs> => {
      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!data) return DEFAULT;
      return {
        memory: data.memory,
        event: data.event,
        trip: data.trip,
        note: data.note,
        song: data.song,
        hug: data.hug,
        capsule: data.capsule,
      };
    },
  });

  const set = useMutation({
    mutationFn: async (patch: Partial<Prefs>) => {
      if (!user) throw new Error("no user");
      const next = { ...(q.data ?? DEFAULT), ...patch };
      await supabase.from("notification_preferences").upsert({ user_id: user.id, ...next });
      return next;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-prefs"] });
    },
  });

  return { prefs: q.data ?? DEFAULT, isLoading: q.isLoading, set: set.mutate };
}
