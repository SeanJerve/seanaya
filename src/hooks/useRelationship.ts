import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "./useUser";

/** Everything the app reads from a relationship. PIN hashes stay on the server. */
export const REL_COLUMNS =
  "id,name,name_a,name_b,anniversary,invite_code,user_a_id,user_b_id,sticker_pad_bg,created_at,updated_at";

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
        .select(REL_COLUMNS)
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
  });
}
