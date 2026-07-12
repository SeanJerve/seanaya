import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "./useUser";

export type NotifKind = "memory" | "event" | "note" | "trip" | "song" | "hug";
export type Notif = {
  id: string; kind: string; title: string | null; entity_id: string | null;
  read: boolean; created_at: string;
};

export function useNotifications(relationshipId: string | undefined) {
  const { user } = useUser();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["notifications", relationshipId, user?.id],
    enabled: !!relationshipId && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id,kind,title,entity_id,read,created_at")
        .eq("relationship_id", relationshipId!)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      return (data ?? []) as Notif[];
    },
  });

  useEffect(() => {
    if (!relationshipId || !user) return;
    const ch = supabase
      .channel(`notif-${relationshipId}-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["notifications"] });
        qc.invalidateQueries({ queryKey: ["stats"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [relationshipId, user, qc]);

  const list = q.data ?? [];
  const unread = list.filter((n) => !n.read).length;

  return {
    list,
    unread,
    markAllRead: async () => {
      if (!relationshipId || !user) return;
      await supabase.from("notifications").update({ read: true })
        .eq("relationship_id", relationshipId).eq("user_id", user.id).eq("read", false);
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    markOneRead: async (id: string) => {
      await supabase.from("notifications").update({ read: true }).eq("id", id);
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  };
}
