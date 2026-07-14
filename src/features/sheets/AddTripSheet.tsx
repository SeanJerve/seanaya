import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { useAppStore } from "@/features/app/store";
import { FieldWrap, Input, PrimaryButton } from "./form-ui";
import { useDraft, useOnline } from "@/lib/idb-drafts";
import { uploadImage } from "@/lib/storage";
import { DropZone } from "@/lib/DropZone";
import { ImagePlus, X, CloudOff, Save } from "lucide-react";

const STATUSES = ["visited","dream","planned"] as const;

type Form = {
  title: string; location: string; status: typeof STATUSES[number];
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
  const onFile = (f: File) => { setFile(f); setPreview(URL.createObjectURL(f)); };

  const create = useMutation({
    mutationFn: async () => {
      if (!user || !form.title || !form.location) throw new Error("Title and place are required");
      const { data: trip, error } = await supabase.from("trips").insert({
        relationship_id: relationshipId, created_by: user.id,
        title: form.title, location: form.location, status: form.status,
      }).select("id").single();
      if (error) throw error;

      if (file) {
        try {
          const { path, url } = await uploadImage("trips", relationshipId, file, `${trip.id}/cover`);
          await supabase.from("trips").update({ cover_url: url, cover_path: path }).eq("id", trip.id);
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
    <div className="space-y-4">
      {!online && (
        <div className="flex items-center gap-2 rounded-2xl bg-white/40 px-3 py-2 text-[11px] text-muted-foreground">
          <CloudOff size={12} /> Offline — draft saved. Will sync when you're back.
        </div>
      )}

      <FieldWrap label="Photo (optional)">
        {preview ? (
          <div className="relative overflow-hidden rounded-2xl border border-white/50">
            <img src={preview} alt="" className="h-40 w-full object-cover" />
            <button type="button" onClick={() => { setFile(null); setPreview(null); }}
              className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white"><X size={14} /></button>
          </div>
        ) : (
          <DropZone onFile={onFile}
            className="flex h-32 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-foreground/25 bg-white/40 text-xs text-muted-foreground">
            <ImagePlus size={18} />
            <span>Drop a photo or tap to choose</span>
          </DropZone>
        )}
      </FieldWrap>

      <FieldWrap label="Title"><Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="A name for this trip" /></FieldWrap>
      <FieldWrap label="Where"><Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="City, country" /></FieldWrap>
      <FieldWrap label="Status">
        <div className="grid grid-cols-3 gap-2">
          {STATUSES.map((s) => (
            <button
              key={s} onClick={() => set("status", s)}
              className={`rounded-full py-2 text-xs capitalize transition ${
                form.status === s ? "bg-foreground text-background" : "border border-white/50 bg-white/40 text-foreground/70"
              }`}
            >{s}</button>
          ))}
        </div>
      </FieldWrap>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Save size={11} /> Draft autosaved locally
      </div>

      <PrimaryButton disabled={create.isPending || !online} onClick={() => create.mutate()}>
        {online ? "Add pin" : "Waiting to sync…"}
      </PrimaryButton>
    </div>
  );
}
