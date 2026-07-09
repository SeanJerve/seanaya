import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { Copy, Users } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export function TopBar({ relationshipId, inviteCode }: { relationshipId: string; inviteCode: string }) {
  const { user } = useUser();
  const [joinCode, setJoinCode] = useState("");
  const { data: partner } = useQuery({
    queryKey: ["partner", relationshipId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: rel } = await supabase.from("relationships").select("user_a_id,user_b_id").eq("id", relationshipId).single();
      if (!rel) return null;
      const otherId = rel.user_a_id === user?.id ? rel.user_b_id : rel.user_a_id;
      if (!otherId) return null;
      const { data } = await supabase.from("profiles").select("display_name,avatar_url").eq("id", otherId).maybeSingle();
      return data;
    },
  });

  async function join() {
    if (!joinCode || !user) return;
    const { data: found, error } = await supabase.from("relationships").select("*").eq("invite_code", joinCode.toUpperCase()).maybeSingle();
    if (error || !found) return toast.error("Invite not found");
    if (found.user_a_id === user.id) return toast.error("That's your own code");
    const { error: upErr } = await supabase.from("relationships").update({ user_b_id: user.id }).eq("id", found.id);
    if (upErr) return toast.error(upErr.message);
    toast.success("Linked. Welcome home.");
    setTimeout(() => window.location.reload(), 600);
  }

  return (
    <div className="glass-panel flex items-center justify-between px-5 py-2.5">
      <div className="flex items-center gap-3">
        <div className="display text-xl">Seanaya</div>
        <div className="text-xs text-muted-foreground">· a home for two</div>
      </div>
      <div className="flex items-center gap-3 text-xs">
        {partner ? (
          <div className="flex items-center gap-2">
            <Users size={14} className="text-primary" />
            <span>Linked with <b>{partner.display_name}</b></span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Invite code:</span>
              <button
                onClick={() => { navigator.clipboard.writeText(inviteCode); toast.success("Copied"); }}
                className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 font-mono tracking-wider hover:bg-accent transition"
              >
                {inviteCode} <Copy size={12} />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="join code"
                className="w-24 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-mono tracking-wider outline-none focus:ring-2 focus:ring-ring/60"
              />
              <button onClick={join} className="rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground">Join</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
