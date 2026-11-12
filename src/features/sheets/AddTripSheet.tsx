import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { useAppStore } from "@/features/app/store";
import { FieldWrap, FormStack, Group, Input, OfflineNote, PhotoPicker, PrimaryButton, Segmented } from "./form-ui";
import { useDraft, useOnline } from "@/lib/idb-drafts";
import { uploadImage } from "@/lib/storage";

const STATUSES = ["visited", "dream", "planned"] as const;

type Form = {
  title: string;
  location: string;
  status: (typeof STATUSES)[number];
};

export function AddTripSheet({ relationshipId }: { relationshipId: string }) {
  const { user } = useUser();
  const { closeSheet } = useAppStore();
  const qc = useQueryClient();
  const online = useOnline();

  const [form, setForm] = useState<Form>({ title: "", location: "", status: "visited" });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const { clear } = useDraft(`trip:${relationshipId}`, form, setForm);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const onFile = (f: File) => {
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!user || !form.title || !form.location) throw new Error("Title and place are required");
      const { data: trip, error } = await supabase
        .from("trips")
        .insert({
          relationship_id: relationshipId,
          created_by: user.id,
          title: form.title,
          location: form.location,
          status: form.status,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (file) {
        try {
          const { path, url } = await uploadImage(
            "trips",
            relationshipId,
            file,
            `${trip.id}/cover`,
          );
          await supabase
            .from("trips")
            .update({ cover_url: url, cover_path: path })
            .eq("id", trip.id);
        } catch (e) {
          console.warn("Trip photo upload failed", e);
          toast.error("Pin saved, but the photo didn't upload");
        }
      }
    },
    onSuccess: () => {
      toast.success("Pinned to your map");
      qc.invalidateQueries({ queryKey: ["trips"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      clear();
      closeSheet();
    },
    onError: (e: any) => toast.error(e?.message || String(e) || "Try again"),
  });

  return (
    <FormStack>
      {!online && <OfflineNote />}
      <PhotoPicker
        preview={preview}
        onFile={onFile}
        onClear={() => {
          setFile(null);
          setPreview(null);
        }}
      />
      <FieldWrap label="Name">
        <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="A name for this place" />
      </FieldWrap>
      <FieldWrap label="Where">
        <Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="City, country" />
      </FieldWrap>
      <Group label="Status">
        <Segmented options={STATUSES} value={form.status} onChange={(s) => set("status", s)} />
      </Group>
      <PrimaryButton disabled={create.isPending || !online} onClick={() => create.mutate()}>
        {online ? "Pin this place" : "Waiting to sync…"}
      </PrimaryButton>
    </FormStack>
  );
}
