import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { Pin, Star } from "lucide-react";

const KINDS = ["note","compliment","promise","gratitude"] as const;
const COLORS = ["oklch(0.95 0.03 85)","oklch(0.93 0.04 350)","oklch(0.92 0.05 190)","oklch(0.94 0.04 280)"];

export function NotePanel({ relationshipId }: { relationshipId: string }) {
  const { user } = useUser();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<typeof KINDS[number]>("note");

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", relationshipId],
    queryFn: async () => {
      const { data } = await supabase.from("notes").select("*").eq("relationship_id", relationshipId).order("pinned", { ascending: false }).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user || !body.trim()) throw new Error("Write something");
      const { error } = await supabase.from("notes").insert({
        relationship_id: relationshipId, author_id: user.id, body, kind,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
      if (error) throw error;
    },
    onSuccess: () => { setBody(""); toast.success("Pinned to your wall"); qc.invalidateQueries({ queryKey: ["notes"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const pin = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      await supabase.from("notes").update({ pinned }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });

  return (
    <div className="p-8">
      <h2 className="display text-3xl">Forever Wall</h2>
      <p className="mt-1 text-sm text-muted-foreground">Little things worth remembering, in your own words.</p>

      <div className="soft-card mt-4 p-4 space-y-3">
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof KINDS[number])} className="rounded-full border border-border bg-background/60 px-4 py-2 text-sm capitalize">
          {KINDS.map((k) => <option key={k}>{k}</option>)}
        </select>
        <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Say something soft…" className="w-full rounded-2xl border border-border bg-background/60 px-4 py-2 text-sm resize-none" />
        <button onClick={() => create.mutate()} disabled={create.isPending} className="w-full rounded-full bg-primary py-2 text-sm text-primary-foreground shadow-soft">Pin it</button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {notes.map((n) => (
          <div key={n.id} className="relative rounded-2xl p-4 shadow-soft" style={{ background: n.color ?? "oklch(0.95 0.03 85)" }}>
            <button onClick={() => pin.mutate({ id: n.id, pinned: !n.pinned })} className={`absolute top-2 right-2 p-1 rounded-full ${n.pinned ? "text-primary" : "text-foreground/40"}`}>
              <Pin size={12} />
            </button>
            <div className="text-[10px] uppercase tracking-wider text-foreground/60">{n.kind}</div>
            <div className="mt-1 text-sm text-foreground/90">{n.body}</div>
            {n.favorite && <Star size={12} className="absolute bottom-2 right-2 text-warm" />}
          </div>
        ))}
      </div>
    </div>
  );
}
