import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";

const CATS = ["relationship","travel","family","pets","personal","health","study","custom"] as const;

export function EventPanel({ relationshipId }: { relationshipId: string }) {
  const { user } = useUser();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState(new Date().toISOString().slice(0, 16));
  const [cat, setCat] = useState<typeof CATS[number]>("relationship");
  const [countdown, setCountdown] = useState(false);
  const [recurring, setRecurring] = useState(false);

  const create = useMutation({
    mutationFn: async () => {
      if (!user || !title.trim()) throw new Error("Title required");
      const { error } = await supabase.from("events").insert({
        relationship_id: relationshipId, created_by: user.id, title,
        starts_at: new Date(when).toISOString(), category: cat, countdown,
        recurrence: recurring ? "MONTHLY:19" : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Added to your calendar");
      setTitle("");
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="p-8">
      <h2 className="display text-3xl">New moment</h2>
      <p className="mt-1 text-sm text-muted-foreground">Something worth remembering, planning, or looking forward to.</p>
      <div className="soft-card mt-6 p-5 space-y-3">
        <input placeholder="What is it?" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-full border border-border bg-background/60 px-4 py-2.5 text-sm" />
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="w-full rounded-full border border-border bg-background/60 px-4 py-2.5 text-sm" />
        <select value={cat} onChange={(e) => setCat(e.target.value as typeof CATS[number])} className="w-full rounded-full border border-border bg-background/60 px-4 py-2.5 text-sm capitalize">
          {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={countdown} onChange={(e) => setCountdown(e.target.checked)} /> Show countdown on our home
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} /> Repeat monthly (like our monthsary)
        </label>
        <button onClick={() => create.mutate()} disabled={create.isPending} className="w-full rounded-full bg-primary py-2.5 text-sm text-primary-foreground shadow-soft disabled:opacity-60">
          Save event
        </button>
      </div>
    </div>
  );
}
