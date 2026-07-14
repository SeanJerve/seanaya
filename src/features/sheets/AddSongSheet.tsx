import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppStore } from "@/features/app/store";
import { FieldWrap, Input, Select, PrimaryButton } from "./form-ui";
import { useDraft, useOnline } from "@/lib/idb-drafts";
import { CloudOff, Save } from "lucide-react";

const CATS = ["favorite","study","travel","comfort","future"] as const;

type Form = { title: string; artist: string; category: typeof CATS[number] };

export function AddSongSheet({ relationshipId }: { relationshipId: string }) {
  const { closeSheet } = useAppStore();
  const qc = useQueryClient();
  const online = useOnline();
  const [form, setForm] = useState<Form>({ title: "", artist: "", category: "favorite" });
  const { clear } = useDraft(`song:${relationshipId}`, form, setForm);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const add = useMutation({
    mutationFn: async () => {
      if (!form.title) throw new Error("Song title is required");
      const { error } = await supabase.from("songs").insert({
        relationship_id: relationshipId,
        title: form.title, artist: form.artist || null, category: form.category,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Added to your radio");
      qc.invalidateQueries({ queryKey: ["songs"] });
      clear();
      closeSheet();
    },
    onError: (e: any) => toast.error(e?.message || String(e) || "Try again"),
  });

  return (
    <div className="space-y-4">
      {!online && (
        <div className="flex items-center gap-2 rounded-2xl bg-white/40 px-3 py-2 text-[11px] text-muted-foreground">
          <CloudOff size={12} /> Offline — draft saved. Will sync when you're back.
        </div>
      )}

      <FieldWrap label="Title"><Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Song title" /></FieldWrap>
      <FieldWrap label="Artist"><Input value={form.artist} onChange={(e) => set("artist", e.target.value)} placeholder="Optional" /></FieldWrap>
      <FieldWrap label="Category">
        <Select value={form.category} onChange={(e) => set("category", e.target.value as Form["category"])}>
          {CATS.map((c) => <option key={c}>{c}</option>)}
        </Select>
      </FieldWrap>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Save size={11} /> Draft autosaved locally
      </div>

      <PrimaryButton disabled={add.isPending || !online} onClick={() => add.mutate()}>
        {online ? "Add song" : "Waiting to sync…"}
      </PrimaryButton>
    </div>
  );
}
