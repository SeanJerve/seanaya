import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppStore } from "@/features/app/store";
import { FieldWrap, FormStack, Input, OfflineNote, PrimaryButton } from "./form-ui";
import { useDraft, useOnline } from "@/lib/idb-drafts";

type Form = { title: string; artist: string };

export function AddSongSheet({ relationshipId }: { relationshipId: string }) {
  const { closeSheet } = useAppStore();
  const qc = useQueryClient();
  const online = useOnline();
  const [form, setForm] = useState<Form>({ title: "", artist: "" });
  const { clear } = useDraft(`song:${relationshipId}`, form, setForm);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const add = useMutation({
    mutationFn: async () => {
      if (!form.title) throw new Error("Song title is required");
      const { error } = await supabase.from("songs").insert({
        relationship_id: relationshipId,
        title: form.title,
        artist: form.artist || null,
        category: "favorite",
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
    <FormStack>
      {!online && <OfflineNote />}
      <FieldWrap label="Song">
        <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Song title" />
      </FieldWrap>
      <FieldWrap label="Artist">
        <Input value={form.artist} onChange={(e) => set("artist", e.target.value)} placeholder="Optional" />
      </FieldWrap>
      <PrimaryButton disabled={add.isPending || !online} onClick={() => add.mutate()}>
        {online ? "Add song" : "Waiting to sync…"}
      </PrimaryButton>
    </FormStack>
  );
}
