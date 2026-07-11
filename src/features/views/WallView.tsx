import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pin } from "lucide-react";
import { useAppStore } from "@/features/app/store";

export function WallView({ relationshipId }: { relationshipId: string }) {
  const qc = useQueryClient();
  const { openSheet } = useAppStore();

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", relationshipId],
    queryFn: async () => (await supabase.from("notes").select("*").eq("relationship_id", relationshipId).order("pinned", { ascending: false }).order("created_at", { ascending: false })).data ?? [],
  });

  const togglePin = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      await supabase.from("notes").update({ pinned }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });

  return (
    <div className="mx-auto max-w-md px-5 py-6 pb-32">
      {notes.length === 0 ? (
        <div className="rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-8 text-center">
          <div className="display text-xl">The wall is quiet.</div>
          <p className="mt-2 text-sm text-muted-foreground">Leave a note, a promise, a small gratitude.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {notes.map((n) => (
            <div
              key={n.id}
              className="relative rounded-2xl border border-white/40 p-4 backdrop-blur-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)]"
              style={{ background: n.color ?? "oklch(0.95 0.03 240 / 0.6)" }}
            >
              <button
                onClick={() => togglePin.mutate({ id: n.id, pinned: !n.pinned })}
                className={`absolute right-2 top-2 rounded-full p-1 ${n.pinned ? "text-foreground" : "text-foreground/40"}`}
              >
                <Pin size={12} />
              </button>
              <div className="text-[10px] uppercase tracking-wider text-foreground/60">{n.kind}</div>
              <p className="mt-1 text-sm leading-snug text-foreground/90">{n.body}</p>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => openSheet("add-note")}
        className="fixed bottom-24 right-5 z-20 flex items-center gap-2 rounded-full border border-white/50
          bg-white/60 backdrop-blur-2xl px-5 py-3 text-sm shadow-[0_10px_30px_-10px_rgba(80,110,160,0.4)]"
      >
        <Plus size={16} /> New note
      </button>
    </div>
  );
}
