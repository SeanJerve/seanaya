import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { useAppStore } from "@/features/app/store";
import { FieldWrap, FormStack, Input, OfflineNote, PhotoPicker, PrimaryButton, Textarea, Toggle } from "./form-ui";
import { useDraft, useOnline } from "@/lib/idb-drafts";
import { uploadImage } from "@/lib/storage";
import { format } from "date-fns";

type Form = {
  title: string;
  description: string;
  date: string;
  location: string;
};

export function AddMemorySheet({ relationshipId }: { relationshipId: string }) {
  const { user } = useUser();
  const { closeSheet } = useAppStore();
  const qc = useQueryClient();
  const online = useOnline();

  const [form, setForm] = useState<Form>({
    title: "",
    description: "",
    date: format(new Date(), "yyyy-MM-dd"),
    location: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [featured, setFeatured] = useState(false);

  const { clear } = useDraft(`memory:${relationshipId}`, form, setForm);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const onFile = (f: File) => {
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!user || !form.title.trim()) throw new Error("Title is required");
      const { data: mem, error } = await supabase
        .from("memories")
        .insert({
          relationship_id: relationshipId,
          created_by: user.id,
          title: form.title,
          description: form.description || null,
          memory_date: form.date,
          category: "random",
          location: form.location || null,
          featured,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (file) {
        try {
          const { path, url } = await uploadImage(
            "memories",
            relationshipId,
            file,
            `${mem.id}/cover`,
          );
          const { error: coverError } = await supabase
            .from("memories")
            .update({ cover_url: url, cover_path: path })
            .eq("id", mem.id);
          if (coverError) throw coverError;
        } catch (e) {
          console.warn("Photo upload failed", e);
          toast.error("Memory saved, but the photo didn't upload");
        }
      }
      await supabase.from("lilies").insert({
        relationship_id: relationshipId,
        memory_id: mem.id,
        stage: "sprout",
        position_x: Math.random(),
        position_y: 0.5 + Math.random() * 0.4,
      });
    },
    onSuccess: () => {
      toast.success("Memory saved");
      qc.invalidateQueries({ queryKey: ["memories"] });
      qc.invalidateQueries({ queryKey: ["photos-cal"] });
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
      <FieldWrap label="Title">
        <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="A moment worth keeping" />
      </FieldWrap>
      <FieldWrap label="Story">
        <Textarea
          rows={3}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="What happened?"
        />
      </FieldWrap>
      <div className="grid gap-5 sm:grid-cols-2">
        <FieldWrap label="Date">
          <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
        </FieldWrap>
        <FieldWrap label="Place">
          <Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Optional" />
        </FieldWrap>
      </div>
      <Toggle label="Feature in this month's story" on={featured} onChange={setFeatured} />
      <PrimaryButton disabled={create.isPending || !online} onClick={() => create.mutate()}>
        {online ? "Keep this memory" : "Waiting to sync…"}
      </PrimaryButton>
    </FormStack>
  );
}
