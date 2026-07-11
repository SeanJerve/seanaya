import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppStore } from "@/features/app/store";
import { FieldWrap, Input, Select, PrimaryButton } from "./form-ui";

const CATS = ["favorite","study","travel","comfort","future"] as const;

export function AddSongSheet({ relationshipId }: { relationshipId: string }) {
  const { closeSheet } = useAppStore();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [cat, setCat] = useState<typeof CATS[number]>("favorite");

  const add = useMutation({
    mutationFn: async () => {
      if (!title) throw new Error("Song title is required");
      const { error } = await supabase.from("songs").insert({
        relationship_id: relationshipId, title, artist: artist || null, category: cat,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Added to your radio");
      qc.invalidateQueries({ queryKey: ["songs"] });
      closeSheet();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Try again"),
  });

  return (
    <div className="space-y-4">
      <FieldWrap label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Song title" /></FieldWrap>
      <FieldWrap label="Artist"><Input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Optional" /></FieldWrap>
      <FieldWrap label="Category">
        <Select value={cat} onChange={(e) => setCat(e.target.value as typeof CATS[number])}>
          {CATS.map((c) => <option key={c}>{c}</option>)}
        </Select>
      </FieldWrap>
      <PrimaryButton disabled={add.isPending} onClick={() => add.mutate()}>Add song</PrimaryButton>
    </div>
  );
}
