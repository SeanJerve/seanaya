import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { useAppStore } from "@/features/app/store";
import { FieldWrap, Input, Textarea, PrimaryButton } from "./form-ui";
import { useDraft, useOnline } from "@/lib/idb-drafts";
import { uploadImage } from "@/lib/storage";
import { DropZone } from "@/lib/DropZone";
import { Upload, X, CloudOff, Save } from "lucide-react";

type Form = {
  title: string; description: string; date: string; location: string;
};

export function AddMemorySheet({ relationshipId }: { relationshipId: string }) {
  const { user } = useUser();
  const { closeSheet } = useAppStore();
  const qc = useQueryClient();
  const online = useOnline();

  const [form, setForm] = useState<Form>({
    title: "", description: "", date: new Date().toISOString().slice(0, 10), location: "",
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
      const { data: mem, error } = await supabase.from("memories").insert({
        relationship_id: relationshipId, created_by: user.id,
        title: form.title, description: form.description || null,
        memory_date: form.date, category: "random", location: form.location || null,
        featured,
      }).select("id").single();
      if (error) throw error;

      if (file) {
        try {
          const { path, url } = await uploadImage("memories", relationshipId, file, `${mem.id}/cover`);
          await supabase.from("memories").update({ cover_url: url, cover_path: path }).eq("id", mem.id);
        } catch (e) {
          console.warn("Photo upload failed", e);
          toast.error("Memory saved, but the photo didn't upload");
        }
      }
      await supabase.from("lilies").insert({
        relationship_id: relationshipId, memory_id: mem.id, stage: "sprout",
        position_x: Math.random(), position_y: 0.5 + Math.random() * 0.4,
      });
    },
    onSuccess: () => {
      toast.success("Memory saved");
      qc.invalidateQueries({ queryKey: ["memories"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      clear();
      closeSheet();
    },
    onError: (e: any) => toast.error(e?.message || String(e) || "Try again"),
  });

  return (
    <div className="space-y-4">
      {!online && (
        <div className="flex items-center gap-2 rounded-2xl bg-white/40 px-3 py-2 text-[11px] text-muted-foreground">
          <CloudOff size={12} /> Offline — draft is saved automatically. Will sync when you're back.
        </div>
      )}

      <FieldWrap label="Photo (optional)">
        {preview ? (
          <div className="relative overflow-hidden rounded-2xl border border-white/50">
            <img src={preview} alt="" className="h-40 w-full object-cover" />
            <button
              type="button"
              onClick={() => { setFile(null); setPreview(null); }}
              className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white"
            ><X size={14} /></button>
          </div>
        ) : (
          <DropZone
            onFile={onFile}
            className="flex h-32 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-foreground/25 bg-white/40 text-xs text-muted-foreground"
          >
            <Upload size={18} />
            <span>Upload photo</span>
          </DropZone>
        )}
      </FieldWrap>

      <FieldWrap label="Title"><Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="A moment worth keeping" /></FieldWrap>
      <FieldWrap label="Story"><Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Tell the story…" /></FieldWrap>
      <FieldWrap label="Date"><Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></FieldWrap>
      <FieldWrap label="Location"><Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Optional" /></FieldWrap>
      <label className="flex items-center gap-2 text-sm text-foreground/80">
        <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="accent-foreground" />
        Feature this month (may appear on Monthsary)
      </label>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Save size={11} /> Draft autosaved locally
      </div>

      <PrimaryButton disabled={create.isPending || !online} onClick={() => create.mutate()}>
        {online ? "Save memory" : "Waiting to sync…"}
      </PrimaryButton>
    </div>
  );
}
