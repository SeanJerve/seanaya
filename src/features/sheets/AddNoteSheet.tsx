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
import { Upload, X, CloudOff, Palette } from "lucide-react";

const KINDS = ["note", "compliment", "promise", "gratitude", "photo"] as const;
const PASTEL_COLORS = [
  { label: "Butter", value: "oklch(0.95 0.07 90 / 0.85)" },
  { label: "Rose", value: "oklch(0.94 0.06 5 / 0.85)" },
  { label: "Mint", value: "oklch(0.94 0.06 160 / 0.85)" },
  { label: "Lavender", value: "oklch(0.93 0.06 290 / 0.85)" },
  { label: "Peach", value: "oklch(0.94 0.07 55 / 0.85)" },
  { label: "Sky", value: "oklch(0.94 0.05 230 / 0.85)" },
];

type Form = { body: string; kind: (typeof KINDS)[number] };

export function AddNoteSheet({ relationshipId }: { relationshipId: string }) {
  const { user } = useUser();
  const { closeSheet } = useAppStore();
  const qc = useQueryClient();
  const online = useOnline();

  const [form, setForm] = useState<Form>({ body: "", kind: "note" });
  const [selectedColor, setSelectedColor] = useState(PASTEL_COLORS[0].value);
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
        image_url = up.url;
        image_path = up.path;
      }

      const { error } = await supabase.from("notes").insert({
        relationship_id: relationshipId,
        author_id: user.id,
        body: form.body || (isPhoto ? "(photo)" : ""),
        kind: isPhoto ? "note" : form.kind, // Fix: Use 'note' instead of 'photo' to satisfy DB check constraints
        color: selectedColor,
        image_url,
        image_path,
        pos_x: Math.random() * 0.5 + 0.1,
        pos_y: Math.random() * 0.5 + 0.1,
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
    onError: (e: any) => toast.error(e?.message || String(e) || "Try again"),
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
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setPreview(null);
              }}
              className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <DropZone
            onFile={(f) => {
              setFile(f);
              const reader = new FileReader();
              reader.onload = () => setPreview(reader.result as string);
              reader.readAsDataURL(f);
              setForm((prev) => ({ ...prev, body: prev.body.slice(0, 20) }));
            }}
            className="flex h-24 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-foreground/25 bg-white/40 text-xs text-muted-foreground"
          >
            <Upload size={16} />
            <span>Upload photo</span>
          </DropZone>
        )}
      </FieldWrap>

      {!file && (
        <FieldWrap label="Kind">
          <Select
            value={form.kind}
            onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as Form["kind"] }))}
          >
            {KINDS.filter((k) => k !== "photo").map((k) => (
              <option key={k}>{k}</option>
            ))}
          </Select>
        </FieldWrap>
      )}

      <FieldWrap label="Choose Pastel Color">
        <div className="flex items-center gap-2 py-1 overflow-x-auto">
          {PASTEL_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setSelectedColor(c.value)}
              className={`h-8 w-8 rounded-full border transition-all flex items-center justify-center ${
                selectedColor === c.value
                  ? "border-primary scale-110 ring-2 ring-primary/20 shadow-md"
                  : "border-white/60 hover:scale-105"
              }`}
              style={{ background: c.value }}
              title={c.label}
            >
              {selectedColor === c.value && <Palette size={12} className="text-foreground/75" />}
            </button>
          ))}
        </div>
      </FieldWrap>

      <FieldWrap label={file ? "Caption (optional)" : "Body"}>
        <div className="relative">
          {(() => {
            const limit = file ? 20 : 100;
            return (
              <>
                <Textarea
                  rows={4}
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value.slice(0, limit) }))}
                  placeholder={file ? "A little caption…" : "Say something soft…"}
                  maxLength={limit}
                />
                <div className="absolute bottom-2 right-3 text-[10px] text-muted-foreground">
                  {Math.max(0, limit - form.body.length)} characters left
                </div>
              </>
            );
          })()}
        </div>
      </FieldWrap>

      <PrimaryButton disabled={create.isPending || !online} onClick={() => create.mutate()}>
        Pin it
      </PrimaryButton>
    </div>
  );
}
