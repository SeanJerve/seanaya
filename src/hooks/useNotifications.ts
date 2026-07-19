import { useEffect, useRef } from "react";
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

const TOAST_TITLE: Record<NotifKind, string> = {
  memory: "A new memory was kept",
  event: "A new moment on the calendar",
  note: "A note landed on the wall",
  trip: "A new place was pinned",
  song: "A song joined your radio",
  hug: "A hug arrived 💗",
  capsule: "A time capsule was placed",
};

export function useNotifications(relationshipId: string | undefined) {
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
    if (!relationshipId || !user) return;
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
          qc.invalidateQueries({ queryKey: ["notifications"] });
          qc.invalidateQueries({ queryKey: ["stats"] });
          qc.invalidateQueries({ queryKey: ["memories"] });
          qc.invalidateQueries({ queryKey: ["notes"] });
          qc.invalidateQueries({ queryKey: ["events"] });
          qc.invalidateQueries({ queryKey: ["trips"] });
          qc.invalidateQueries({ queryKey: ["songs"] });
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
  }, [relationshipId, user, qc]);

  const list = q.data ?? [];
  const unread = list.filter((n) => !n.read).length;

  return {
    list,
    unread,
    markAllRead: async () => {
      if (!relationshipId || !user) return;
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("relationship_id", relationshipId)
        .eq("user_id", user.id)
        .eq("read", false);
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    markOneRead: async (id: string) => {
      await supabase.from("notifications").update({ read: true }).eq("id", id);
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  };
}
