import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pin } from "lucide-react";
import { useAppStore } from "@/features/app/store";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { uploadImage } from "@/lib/storage";
import { Lightbox } from "@/lib/Lightbox";

type Note = {
  id: string; body: string; kind: string; color: string | null; pinned: boolean;
  image_url: string | null; rotation: number | null;
};

export function WallView({ relationshipId }: { relationshipId: string }) {
  const qc = useQueryClient();
  const { openSheet } = useAppStore();
  const { user } = useUser();
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", relationshipId],
    queryFn: async () =>
      ((await supabase
        .from("notes")
        .select("id,body,kind,color,pinned,image_url,rotation")
        .eq("relationship_id", relationshipId)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
      ).data ?? []) as Note[],
  });

  const togglePin = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      await supabase.from("notes").update({ pinned }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });

  const uploadPhotoNote = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Not ready");
      const noteId = crypto.randomUUID();
      const { url, path } = await uploadImage("wall", relationshipId, file, `notes/${noteId}`);
      const { error } = await supabase.from("notes").insert({
        relationship_id: relationshipId, author_id: user.id,
        body: "(photo)", kind: "photo",
        image_url: url, image_path: path,
        rotation: (Math.random() - 0.5) * 6,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pinned to your wall"); qc.invalidateQueries({ queryKey: ["notes"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Try again"),
  });

  const { textNotes, photoNotes } = useMemo(() => ({
    textNotes: notes.filter((n) => !n.image_url),
    photoNotes: notes.filter((n) => !!n.image_url),
  }), [notes]);

  return (
    <div
      className="mx-auto max-w-md px-5 py-6 pb-32"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f && f.type.startsWith("image/")) uploadPhotoNote.mutate(f);
      }}
    >
      {dragOver && (
        <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center">
          <div className="rounded-3xl border-2 border-dashed border-primary/60 bg-white/40 backdrop-blur-xl px-8 py-6 text-sm">Drop to pin a photo</div>
        </div>
      )}

      {notes.length === 0 && (
        <div className="rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-8 text-center">
          <div className="display text-xl">The wall is quiet.</div>
          <p className="mt-2 text-sm text-muted-foreground">Drop a photo here, or leave a note.</p>
        </div>
      )}

      {photoNotes.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Photo board</div>
          <div className="flex flex-wrap gap-3">
            {photoNotes.map((n) => (
              <button
                key={n.id}
                onClick={() => setLightbox(n.image_url)}
                className="group relative shrink-0"
                style={{ transform: `rotate(${n.rotation ?? 0}deg)` }}
              >
                <div className="h-28 w-28 overflow-hidden rounded-2xl border border-white/60 bg-white p-1.5 shadow-[0_10px_24px_-14px_rgba(80,110,160,0.6)]">
                  <img src={n.image_url!} alt="" loading="lazy" className="h-full w-full rounded-lg object-cover" />
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); togglePin.mutate({ id: n.id, pinned: !n.pinned }); }}
                  className={`absolute -right-1 -top-1 rounded-full bg-white/80 p-1 shadow ${n.pinned ? "text-foreground" : "text-foreground/40"}`}
                ><Pin size={10} /></button>
              </button>
            ))}
          </div>
        </div>
      )}

      {textNotes.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {textNotes.map((n) => (
            <div
              key={n.id}
              className="relative rounded-2xl border border-white/40 p-4 backdrop-blur-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)]"
              style={{ background: n.color ?? "oklch(0.95 0.03 240 / 0.6)", transform: `rotate(${n.rotation ?? 0}deg)` }}
            >
              <button
                onClick={() => togglePin.mutate({ id: n.id, pinned: !n.pinned })}
                className={`absolute right-2 top-2 rounded-full p-1 ${n.pinned ? "text-foreground" : "text-foreground/40"}`}
              ><Pin size={12} /></button>
              <div className="text-[10px] uppercase tracking-wider text-foreground/60">{n.kind}</div>
              <p className="mt-1 text-sm leading-snug text-foreground/90">{n.body}</p>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => openSheet("add-note")}
        className="fixed bottom-24 right-5 z-20 flex items-center gap-2 rounded-full border border-white/50 bg-white/60 backdrop-blur-2xl px-5 py-3 text-sm shadow-[0_10px_30px_-10px_rgba(80,110,160,0.4)]">
        <Plus size={16} /> New note
      </button>

      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
