import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { useAppStore } from "@/features/app/store";
import { FieldWrap, FormStack, Input, OfflineNote, PrimaryButton, Toggle } from "./form-ui";
import { useDraft, useOnline } from "@/lib/idb-drafts";
import { CloudOff, Save } from "lucide-react";

const CATS = [
  "relationship",
  "travel",
  "family",
  "pets",
  "personal",
  "health",
  "study",
  "custom",
] as const;

type Form = {
  title: string;
  when: string;
  cat: (typeof CATS)[number];
  countdown: boolean;
  recurring: boolean;
};

export function AddEventSheet({ relationshipId }: { relationshipId: string }) {
  const { user } = useUser();
  const { closeSheet } = useAppStore();
  const qc = useQueryClient();
  const online = useOnline();

  const [form, setForm] = useState<Form>({
    title: "",
    when: new Date().toISOString().slice(0, 16),
    cat: "relationship",
    countdown: false,
    recurring: false,
  });
  const { clear } = useDraft(`event:${relationshipId}`, form, setForm);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const create = useMutation({
    mutationFn: async () => {
      if (!user || !form.title.trim()) throw new Error("Title is required");
      const { error } = await supabase.from("events").insert({
        relationship_id: relationshipId,
        created_by: user.id,
        title: form.title,
        starts_at: new Date(form.when).toISOString(),
        category: "relationship",
        countdown: form.countdown,
        recurrence: form.recurring ? "MONTHLY:19" : null,
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
    onError: (e: any) => toast.error(e?.message || String(e) || "Try again"),
  });

  return (
    <FormStack>
      {!online && <OfflineNote />}
      <FieldWrap label="What's the moment?">
        <Input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Our 6th monthsary"
        />
      </FieldWrap>
      <FieldWrap label="When">
        <Input type="datetime-local" value={form.when} onChange={(e) => set("when", e.target.value)} />
      </FieldWrap>
      <div className="divide-y divide-[#e7e4f3]">
        <Toggle label="Count down on Home" on={form.countdown} onChange={(v) => set("countdown", v)} />
        <Toggle label="Repeat every monthsary" on={form.recurring} onChange={(v) => set("recurring", v)} />
      </div>
      <PrimaryButton disabled={create.isPending || !online} onClick={() => create.mutate()}>
        {online ? "Add moment" : "Waiting to sync…"}
      </PrimaryButton>
    </FormStack>
  );
}
