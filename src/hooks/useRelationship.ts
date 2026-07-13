import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "./useUser";

/**
 * Resolves the current relationship. PinGate is responsible for creating it,
 * so we just read here — no silent insert paths.
 */
export function useRelationship() {
  const { user } = useUser();
  return useQuery({
    queryKey: ["relationship", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("relationships")
        .select("*")
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
  });
}
