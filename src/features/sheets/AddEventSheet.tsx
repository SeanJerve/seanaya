import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { useAppStore } from "@/features/app/store";
import { FieldWrap, Input, Select, PrimaryButton } from "./form-ui";

const CATS = ["relationship","travel","family","pets","personal","health","study","custom"] as const;

export function AddEventSheet({ relationshipId }: { relationshipId: string }) {
  const { user } = useUser();
  const { closeSheet } = useAppStore();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState(new Date().toISOString().slice(0, 16));
  const [cat, setCat] = useState<typeof CATS[number]>("relationship");
  const [countdown, setCountdown] = useState(false);
  const [recurring, setRecurring] = useState(false);

  const create = useMutation({
    mutationFn: async () => {
      if (!user || !title.trim()) throw new Error("Title is required");
      const { error } = await supabase.from("events").insert({
        relationship_id: relationshipId, created_by: user.id, title,
        starts_at: new Date(when).toISOString(), category: cat, countdown,
        recurrence: recurring ? "MONTHLY:19" : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Added to your calendar");
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      closeSheet();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Try again"),
  });

  return (
    <div className="space-y-4">
      <FieldWrap label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What is it?" /></FieldWrap>
      <FieldWrap label="When"><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></FieldWrap>
      <FieldWrap label="Category">
        <Select value={cat} onChange={(e) => setCat(e.target.value as typeof CATS[number])}>
          {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </FieldWrap>
      <label className="flex items-center gap-2 text-sm text-foreground/80">
        <input type="checkbox" checked={countdown} onChange={(e) => setCountdown(e.target.checked)} className="accent-foreground" />
        Show countdown on Home
      </label>
      <label className="flex items-center gap-2 text-sm text-foreground/80">
        <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="accent-foreground" />
        Repeat monthly (monthsary)
      </label>
      <PrimaryButton disabled={create.isPending} onClick={() => create.mutate()}>Save event</PrimaryButton>
    </div>
  );
}
