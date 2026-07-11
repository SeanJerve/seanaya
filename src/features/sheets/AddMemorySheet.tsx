import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { useAppStore } from "@/features/app/store";
import { FieldWrap, Input, Select, Textarea, PrimaryButton } from "./form-ui";

const CATS = ["firsts","campus","travel","random","family","future"] as const;

export function AddMemorySheet({ relationshipId }: { relationshipId: string }) {
  const { user } = useUser();
  const { closeSheet } = useAppStore();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [cat, setCat] = useState<typeof CATS[number]>("random");
  const [location, setLocation] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      if (!user || !title.trim()) throw new Error("Title is required");
      const { data: mem, error } = await supabase.from("memories").insert({
        relationship_id: relationshipId, created_by: user.id, title, description: desc || null,
        memory_date: date, category: cat, location: location || null,
      }).select("id").single();
      if (error) throw error;
      await supabase.from("lilies").insert({
        relationship_id: relationshipId, memory_id: mem.id, stage: "sprout",
        position_x: Math.random(), position_y: 0.5 + Math.random() * 0.4,
      });
    },
    onSuccess: () => {
      toast.success("Memory saved");
      qc.invalidateQueries({ queryKey: ["memories"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      closeSheet();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Try again"),
  });

  return (
    <div className="space-y-4">
      <FieldWrap label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A moment worth keeping" /></FieldWrap>
      <FieldWrap label="Story"><Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Tell the story…" /></FieldWrap>
      <div className="grid grid-cols-2 gap-3">
        <FieldWrap label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></FieldWrap>
        <FieldWrap label="Category">
          <Select value={cat} onChange={(e) => setCat(e.target.value as typeof CATS[number])}>
            {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </FieldWrap>
      </div>
      <FieldWrap label="Location"><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Optional" /></FieldWrap>
      <PrimaryButton disabled={create.isPending} onClick={() => create.mutate()}>Save memory</PrimaryButton>
    </div>
  );
}
