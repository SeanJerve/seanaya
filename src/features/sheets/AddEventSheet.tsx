import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { useAppStore } from "@/features/app/store";
import { FieldWrap, Input, Select, PrimaryButton } from "./form-ui";
import { useDraft, useOnline } from "@/lib/idb-drafts";
import { CloudOff, Save } from "lucide-react";

const CATS = ["relationship","travel","family","pets","personal","health","study","custom"] as const;

type Form = {
  title: string;
  when: string;
  cat: typeof CATS[number];
  countdown: boolean;
  recurring: boolean;
};

export function AddEventSheet({ relationshipId }: { relationshipId: string }) {
  const { user } = useUser();
  const { closeSheet } = useAppStore();
  const qc = useQueryClient();
  const online = useOnline();

  const [form, setForm] = useState<Form>({
    title: "", when: new Date().toISOString().slice(0, 16),
    cat: "relationship", countdown: false, recurring: false,
  });
  const { clear } = useDraft(`event:${relationshipId}`, form, setForm);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const create = useMutation({
    mutationFn: async () => {
      if (!user || !form.title.trim()) throw new Error("Title is required");
      const { error } = await supabase.from("events").insert({
        relationship_id: relationshipId, created_by: user.id, title: form.title,
        starts_at: new Date(form.when).toISOString(), category: form.cat,
        countdown: form.countdown, recurrence: form.recurring ? "MONTHLY:19" : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Added to your calendar");
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      clear();
      closeSheet();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Try again"),
  });

  return (
    <div className="space-y-4">
      {!online && (
        <div className="flex items-center gap-2 rounded-2xl bg-white/40 px-3 py-2 text-[11px] text-muted-foreground">
          <CloudOff size={12} /> Offline — draft saved locally. Will sync when you're back.
        </div>
      )}

      <FieldWrap label="Title"><Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="What is it?" /></FieldWrap>
      <FieldWrap label="When"><Input type="datetime-local" value={form.when} onChange={(e) => set("when", e.target.value)} /></FieldWrap>
      <FieldWrap label="Category">
        <Select value={form.cat} onChange={(e) => set("cat", e.target.value as Form["cat"])}>
          {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </FieldWrap>
      <label className="flex items-center gap-2 text-sm text-foreground/80">
        <input type="checkbox" checked={form.countdown} onChange={(e) => set("countdown", e.target.checked)} className="accent-foreground" />
        Show countdown on Home
      </label>
      <label className="flex items-center gap-2 text-sm text-foreground/80">
        <input type="checkbox" checked={form.recurring} onChange={(e) => set("recurring", e.target.checked)} className="accent-foreground" />
        Repeat monthly (monthsary)
      </label>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Save size={11} /> Draft autosaved locally
      </div>

      <PrimaryButton disabled={create.isPending || !online} onClick={() => create.mutate()}>
        {online ? "Save event" : "Waiting to sync…"}
      </PrimaryButton>
    </div>
  );
}
