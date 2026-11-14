import { useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "./useUser";
import { toast } from "sonner";

export type NotifKind = "memory" | "note" | "hug" | "event" | "capsule" | "trip" | "song";
export type Notif = {
  id: string;
  kind: NotifKind;
  ref_id: string | null;
  read: boolean;
  created_at: string;
};

// Hugs get their own full-screen moment, so they don't toast.
const TOAST_TITLE: Partial<Record<NotifKind, string>> = {
  memory: "A new memory was kept",
  event: "A new moment on the calendar",
  note: "A note landed on the wall",
};

/**
 * `live`: subscribe to new notifications. Only one mounted place (the dock) should
 * pass it, or every toast and refresh happens twice.
 */
export function useNotifications(relationshipId: string | undefined, { live = false } = {}) {
  const { user } = useUser();
  const qc = useQueryClient();
  const bootstrapped = useRef(false);

  const q = useQuery({
    queryKey: ["notifications", relationshipId, user?.id],
    enabled: !!relationshipId && !!user,
    queryFn: async (): Promise<Notif[]> => {
      const { data } = await supabase
        .from("notifications")
        .select("id,kind,ref_id,read,created_at")
        .eq("relationship_id", relationshipId!)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      bootstrapped.current = true;
      return (data ?? []) as Notif[];
    },
  });

  useEffect(() => {
    if (!live || !relationshipId || !user) return;
    const channelId = `notif-${relationshipId}-${user.id}-${Math.random().toString(36).slice(2, 10)}`;
    const ch = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // The content itself is refreshed by the app's own realtime channel.
          qc.invalidateQueries({ queryKey: ["notifications"] });
          qc.invalidateQueries({ queryKey: ["stats"] });
          // Rich toast — but only after first bootstrap load, to avoid replaying history
          if (!bootstrapped.current) return;
          const kind = (payload.new as { kind?: NotifKind } | null)?.kind;
          if (kind && TOAST_TITLE[kind]) toast(TOAST_TITLE[kind]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [live, relationshipId, user, qc]);

  const list = q.data ?? [];
  const unread = list.filter((n) => !n.read).length;

  // Stable identities so consumers can safely list these as effect deps.
  const userId = user?.id;
  const markAllRead = useCallback(async () => {
    if (!relationshipId || !userId) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("relationship_id", relationshipId)
      .eq("user_id", userId)
      .eq("read", false);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }, [relationshipId, userId, qc]);

  const markOneRead = useCallback(
    async (id: string) => {
      await supabase.from("notifications").update({ read: true }).eq("id", id);
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    [qc],
  );

  return {
    list,
    unread,
    markAllRead,
    markOneRead,
  };
}
