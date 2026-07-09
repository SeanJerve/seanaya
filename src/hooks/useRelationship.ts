import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "./useUser";

/**
 * Resolves the current relationship — creates a solo one if missing.
 * Every piece of content is scoped by relationship_id.
 */
export function useRelationship() {
  const { user } = useUser();
  return useQuery({
    queryKey: ["relationship", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const { data: existing } = await supabase
        .from("relationships")
        .select("*")
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle();
      if (existing) return existing;
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      const { data: created, error } = await supabase
        .from("relationships")
        .insert({ user_a_id: user.id, invite_code: code, name: "Seanaya" })
        .select("*")
        .single();
      if (error) throw error;
      return created;
    },
  });
}
