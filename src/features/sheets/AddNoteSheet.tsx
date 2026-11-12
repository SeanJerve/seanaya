import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { useAppStore } from "@/features/app/store";
import { FieldWrap, FormStack, Group, OfflineNote, PhotoPicker, PrimaryButton, Segmented, Textarea } from "./form-ui";
import { useDraft, useOnline } from "@/lib/idb-drafts";
import { uploadImage } from "@/lib/storage";
import { Check } from "lucide-react";

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

  const limit = file ? 20 : 100;
  return (
    <FormStack>
      {!online && <OfflineNote />}
      <PhotoPicker
        preview={preview}
        height="h-28"
        onFile={(f) => {
          setFile(f);
          const reader = new FileReader();
          reader.onload = () => setPreview(reader.result as string);
          reader.readAsDataURL(f);
          setForm((prev) => ({ ...prev, body: prev.body.slice(0, 20) }));
        }}
        onClear={() => {
          setFile(null);
          setPreview(null);
        }}
      />

      {!file && (
        <Group label="Kind">
          <Segmented
            options={KINDS.filter((k) => k !== "photo")}
            value={form.kind}
            onChange={(k) => setForm((f) => ({ ...f, kind: k }))}
          />
        </Group>
      )}

      <Group label="Paper">
        <div className="flex flex-wrap items-center gap-2.5">
          {PASTEL_COLORS.map((c) => {
            const on = selectedColor === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setSelectedColor(c.value)}
                aria-label={c.label}
                aria-pressed={on}
                title={c.label}
                className={`grid h-10 w-10 place-items-center rounded-full border-2 transition ${on ? "border-[#94b2f6] ring-2 ring-white" : "border-white"}`}
                style={{ background: c.value }}
              >
                {on && <Check size={16} strokeWidth={2.4} className="text-sn-navy" />}
              </button>
            );
          })}
        </div>
      </Group>

      <FieldWrap label={file ? "Caption" : "Note"}>
        <Textarea
          rows={4}
          value={form.body}
          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value.slice(0, limit) }))}
          placeholder={file ? "A little caption" : "Say something soft"}
          maxLength={limit}
        />
        <span className="mt-1.5 block text-right text-[12.5px] text-sn-muted tabular-nums">
          {form.body.length}/{limit}
        </span>
      </FieldWrap>

      <PrimaryButton disabled={create.isPending || !online} onClick={() => create.mutate()}>
        Pin it to the wall
      </PrimaryButton>
    </FormStack>
  );
}
