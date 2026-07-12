import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { useAppStore } from "@/features/app/store";
import { FieldWrap, Select, Textarea, PrimaryButton } from "./form-ui";
import { useDraft, useOnline } from "@/lib/idb-drafts";
import { DropZone } from "@/lib/DropZone";
import { uploadImage } from "@/lib/storage";
import { ImagePlus, X, CloudOff } from "lucide-react";

const KINDS = ["note","compliment","promise","gratitude","photo"] as const;
const COLORS = [
  "oklch(0.95 0.03 85 / 0.7)",
  "oklch(0.93 0.04 350 / 0.7)",
  "oklch(0.92 0.05 190 / 0.7)",
  "oklch(0.94 0.04 280 / 0.7)",
];

type Form = { body: string; kind: typeof KINDS[number] };

export function AddNoteSheet({ relationshipId }: { relationshipId: string }) {
  const { user } = useUser();
  const { closeSheet } = useAppStore();
  const qc = useQueryClient();
  const online = useOnline();

  const [form, setForm] = useState<Form>({ body: "", kind: "note" });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const { clear } = useDraft(`note:${relationshipId}`, form, setForm);

  const isPhoto = form.kind === "photo" || !!file;

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not ready");
      if (!isPhoto && !form.body.trim()) throw new Error("Write something");
      if (isPhoto && !file) throw new Error("Add a photo");

      let image_url: string | null = null;
      let image_path: string | null = null;
      if (file) {
        const noteId = crypto.randomUUID();
        const up = await uploadImage("wall", relationshipId, file, `notes/${noteId}`);
        image_url = up.url; image_path = up.path;
      }

      const { error } = await supabase.from("notes").insert({
        relationship_id: relationshipId, author_id: user.id,
        body: form.body || (isPhoto ? "(photo)" : ""),
        kind: isPhoto ? "photo" : form.kind,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        image_url, image_path,
        pos_x: Math.random(), pos_y: Math.random(),
        rotation: (Math.random() - 0.5) * 6,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pinned to your wall");
      qc.invalidateQueries({ queryKey: ["notes"] });
      clear();
      closeSheet();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Try again"),
  });

  return (
    <div className="space-y-4">
      {!online && (
        <div className="flex items-center gap-2 rounded-2xl bg-white/40 px-3 py-2 text-[11px] text-muted-foreground">
          <CloudOff size={12} /> Offline — draft saved locally.
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
          <DropZone onFile={(f) => { setFile(f); setPreview(URL.createObjectURL(f)); }}
            className="flex h-24 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-foreground/25 bg-white/40 text-xs text-muted-foreground">
            <ImagePlus size={16} /><span>Drop a photo or tap to choose</span>
          </DropZone>
        )}
      </FieldWrap>

      {!file && (
        <FieldWrap label="Kind">
          <Select value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as Form["kind"] }))}>
            {KINDS.filter((k) => k !== "photo").map((k) => <option key={k}>{k}</option>)}
          </Select>
        </FieldWrap>
      )}

      <FieldWrap label={file ? "Caption (optional)" : "Body"}>
        <Textarea rows={4} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          placeholder={file ? "A little caption…" : "Say something soft…"} />
      </FieldWrap>

      <PrimaryButton disabled={create.isPending || !online} onClick={() => create.mutate()}>
        Pin it
      </PrimaryButton>
    </div>
  );
}
