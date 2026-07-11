import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { useAppStore } from "@/features/app/store";
import { FieldWrap, Input, PrimaryButton } from "./form-ui";

const STATUSES = ["visited","dream","planned"] as const;

export function AddTripSheet({ relationshipId }: { relationshipId: string }) {
  const { user } = useUser();
  const { closeSheet } = useAppStore();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<typeof STATUSES[number]>("visited");

  const create = useMutation({
    mutationFn: async () => {
      if (!user || !title || !location) throw new Error("Title and place are required");
      const { error } = await supabase.from("trips").insert({
        relationship_id: relationshipId, created_by: user.id, title, location, status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pinned to your map");
      qc.invalidateQueries({ queryKey: ["trips"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      closeSheet();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Try again"),
  });

  return (
    <div className="space-y-4">
      <FieldWrap label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A name for this trip" /></FieldWrap>
      <FieldWrap label="Where"><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, country" /></FieldWrap>
      <FieldWrap label="Status">
        <div className="grid grid-cols-3 gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-full py-2 text-xs capitalize transition ${
                status === s
                  ? "bg-foreground text-background"
                  : "border border-white/50 bg-white/40 text-foreground/70"
              }`}
            >{s}</button>
          ))}
        </div>
      </FieldWrap>
      <PrimaryButton disabled={create.isPending} onClick={() => create.mutate()}>Add pin</PrimaryButton>
    </div>
  );
}
