import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { useAppStore } from "@/features/app/store";

export function MemoriesView({ relationshipId }: { relationshipId: string }) {
  const { openSheet } = useAppStore();
  const { data: memories = [] } = useQuery({
    queryKey: ["memories", relationshipId],
    queryFn: async () => (await supabase.from("memories").select("*").eq("relationship_id", relationshipId).order("memory_date", { ascending: false }).limit(100)).data ?? [],
  });

  return (
    <div className="mx-auto max-w-md space-y-3 px-5 py-6 pb-32">
      {memories.length === 0 && (
        <div className="rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-8 text-center">
          <div className="display text-xl">Nothing kept yet.</div>
          <p className="mt-2 text-sm text-muted-foreground">The first memory is always the sweetest.</p>
        </div>
      )}
      {memories.map((m) => (
        <article key={m.id} className="rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="display truncate text-lg leading-tight">{m.title}</h3>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {m.memory_date && format(new Date(m.memory_date), "MMM d, yyyy")}
                {m.location && ` · ${m.location}`}
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-white/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{m.category}</span>
          </div>
          {m.description && <p className="mt-3 text-sm text-foreground/80">{m.description}</p>}
        </article>
      ))}

      <button
        onClick={() => openSheet("add-memory")}
        className="fixed bottom-24 right-5 z-20 flex items-center gap-2 rounded-full border border-white/50
          bg-white/60 backdrop-blur-2xl px-5 py-3 text-sm shadow-[0_10px_30px_-10px_rgba(80,110,160,0.4)]"
      >
        <Plus size={16} /> New memory
      </button>
    </div>
  );
}
