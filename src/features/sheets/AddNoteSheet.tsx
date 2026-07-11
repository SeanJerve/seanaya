import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { useAppStore } from "@/features/app/store";
import { FieldWrap, Select, Textarea, PrimaryButton } from "./form-ui";

const KINDS = ["note","compliment","promise","gratitude"] as const;
const COLORS = [
  "oklch(0.95 0.03 85 / 0.7)",
  "oklch(0.93 0.04 350 / 0.7)",
  "oklch(0.92 0.05 190 / 0.7)",
  "oklch(0.94 0.04 280 / 0.7)",
];

export function AddNoteSheet({ relationshipId }: { relationshipId: string }) {
  const { user } = useUser();
  const { closeSheet } = useAppStore();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<typeof KINDS[number]>("note");

  const create = useMutation({
    mutationFn: async () => {
      if (!user || !body.trim()) throw new Error("Write something");
      const { error } = await supabase.from("notes").insert({
        relationship_id: relationshipId, author_id: user.id, body, kind,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pinned to your wall");
      qc.invalidateQueries({ queryKey: ["notes"] });
      closeSheet();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Try again"),
  });

  return (
    <div className="space-y-4">
      <FieldWrap label="Kind">
        <Select value={kind} onChange={(e) => setKind(e.target.value as typeof KINDS[number])}>
          {KINDS.map((k) => <option key={k}>{k}</option>)}
        </Select>
      </FieldWrap>
      <FieldWrap label="Body"><Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Say something soft…" /></FieldWrap>
      <PrimaryButton disabled={create.isPending} onClick={() => create.mutate()}>Pin it</PrimaryButton>
    </div>
  );
}
