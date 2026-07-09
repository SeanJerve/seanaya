import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus } from "lucide-react";

const CATS = ["firsts","campus","travel","random","family","future"] as const;

export function MemoryPanel({ relationshipId }: { relationshipId: string }) {
  const { user } = useUser();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [cat, setCat] = useState<typeof CATS[number]>("random");
  const [location, setLocation] = useState("");

  const { data: memories = [] } = useQuery({
    queryKey: ["memories", relationshipId],
    queryFn: async () => {
      const { data } = await supabase.from("memories").select("*").eq("relationship_id", relationshipId).order("memory_date", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user || !title.trim()) throw new Error("Title required");
      const { data: mem, error } = await supabase.from("memories").insert({
        relationship_id: relationshipId, created_by: user.id, title, description: desc || null,
        memory_date: date, category: cat, location: location || null,
      }).select("id").single();
      if (error) throw error;
      // Plant a lily for this memory
      await supabase.from("lilies").insert({
        relationship_id: relationshipId, memory_id: mem.id, stage: "sprout",
        position_x: Math.random(), position_y: 0.5 + Math.random() * 0.4,
      });
    },
    onSuccess: () => {
      toast.success("Memory saved · a lily bloomed");
      setTitle(""); setDesc(""); setLocation(""); setOpen(false);
      qc.invalidateQueries({ queryKey: ["memories"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <h2 className="display text-3xl">Memory Vault</h2>
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs text-primary-foreground shadow-soft">
          <Plus size={14} /> New
        </button>
      </div>

      {open && (
        <div className="soft-card mt-4 p-4 space-y-3">
          <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-full border border-border bg-background/60 px-4 py-2 text-sm" />
          <textarea placeholder="Tell the story…" value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className="w-full rounded-2xl border border-border bg-background/60 px-4 py-2 text-sm resize-none" />
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-full border border-border bg-background/60 px-4 py-2 text-sm" />
            <select value={cat} onChange={(e) => setCat(e.target.value as typeof CATS[number])} className="rounded-full border border-border bg-background/60 px-4 py-2 text-sm capitalize">
              {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <input placeholder="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-full border border-border bg-background/60 px-4 py-2 text-sm" />
          <button onClick={() => create.mutate()} disabled={create.isPending} className="w-full rounded-full bg-primary py-2 text-sm text-primary-foreground shadow-soft disabled:opacity-60">
            Save memory
          </button>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {memories.length === 0 && <div className="text-sm text-muted-foreground italic">No memories yet. The first one is always the sweetest.</div>}
        {memories.map((m) => (
          <div key={m.id} className="soft-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="display text-lg leading-tight">{m.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {m.memory_date && format(new Date(m.memory_date), "MMM d, yyyy")}
                  {m.location && ` · ${m.location}`}
                </div>
              </div>
              <span className="text-[10px] uppercase tracking-wider rounded-full bg-accent px-2 py-0.5">{m.category}</span>
            </div>
            {m.description && <p className="mt-2 text-sm text-foreground/80">{m.description}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
