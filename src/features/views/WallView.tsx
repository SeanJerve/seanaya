import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Palette } from "lucide-react";
import { useAppStore } from "@/features/app/store";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { uploadImage } from "@/lib/storage";
import { Lightbox } from "@/lib/Lightbox";

type Note = {
  id: string; body: string; kind: string; color: string | null; pinned: boolean;
  image_url: string | null; rotation: number | null;
};

type PhotoTile = {
  id: string; title: string; sub: string; url: string; kind: "trip" | "memory";
};

// 6 pastel colors for notes
const PASTEL_COLORS = [
  { label: "Butter",   value: "oklch(0.95 0.07 90 / 0.85)" },
  { label: "Rose",     value: "oklch(0.94 0.06 5 / 0.85)" },
  { label: "Mint",     value: "oklch(0.94 0.06 160 / 0.85)" },
  { label: "Lavender", value: "oklch(0.93 0.06 290 / 0.85)" },
  { label: "Peach",    value: "oklch(0.94 0.07 55 / 0.85)" },
  { label: "Sky",      value: "oklch(0.94 0.05 230 / 0.85)" },
];

// Deterministic tilt from note ID (seeded by chars)
function getTilt(id: string): number {
  const seed = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  return ((seed % 11) - 5) * 0.9; // range roughly -4.5 to 4.5 degrees
}

export function WallView({ relationshipId }: { relationshipId: string }) {
  const qc = useQueryClient();
  const { openSheet } = useAppStore();
  const { user } = useUser();
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);

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

  const { data: extras = [] } = useQuery({
    queryKey: ["wall-extras", relationshipId],
    queryFn: async (): Promise<PhotoTile[]> => {
      const [trips, mems] = await Promise.all([
        supabase.from("trips").select("id,title,location,cover_url").eq("relationship_id", relationshipId).not("cover_url", "is", null).order("created_at", { ascending: false }),
        supabase.from("memories").select("id,title,location,cover_url,memory_date").eq("relationship_id", relationshipId).not("cover_url", "is", null).order("memory_date", { ascending: false }),
      ]);
      const t: PhotoTile[] = (trips.data ?? []).map((r) => ({ id: r.id, title: r.title, sub: r.location ?? "", url: r.cover_url!, kind: "trip" }));
      const m: PhotoTile[] = (mems.data ?? []).map((r) => ({ id: r.id, title: r.title, sub: r.location ?? "", url: r.cover_url!, kind: "memory" }));
      return [...m, ...t];
    },
  });

  const updateColor = useMutation({
    mutationFn: async ({ id, color }: { id: string; color: string }) => {
      const { error } = await supabase.from("notes").update({ color }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { setColorPickerFor(null); qc.invalidateQueries({ queryKey: ["notes"] }); },
    onError: (e: any) => toast.error(e?.message || String(e) || "Try again"),
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
        color: PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)].value,
        rotation: (Math.random() - 0.5) * 8,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pinned to your board"); qc.invalidateQueries({ queryKey: ["notes"] }); },
    onError: (e: any) => toast.error(e?.message || String(e) || "Try again"),
  });

  const { textNotes, photoNotes } = useMemo(() => ({
    textNotes: notes.filter((n) => !n.image_url),
    photoNotes: notes.filter((n) => !!n.image_url),
  }), [notes]);

  const allItems = useMemo(() => {
    // Interleave photos and text for a natural board look
    const photos = [...photoNotes, ...extras.map((e) => ({ ...e, isExtra: true }))];
    return { photos, textNotes };
  }, [photoNotes, extras, textNotes]);

  const nothing = notes.length === 0 && extras.length === 0;

  return (
    <div
      className="min-h-screen pb-32"
      style={{ background: "oklch(0.88 0.04 70 / 0.3)" }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f && f.type.startsWith("image/")) uploadPhotoNote.mutate(f);
      }}
    >
      {/* Cork board texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, oklch(0.5 0.05 60) 1px, transparent 0)`,
          backgroundSize: "16px 16px",
        }}
      />

      {dragOver && (
        <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center">
          <div className="rounded-3xl border-2 border-dashed border-primary/60 bg-white/40 backdrop-blur-xl px-8 py-6 text-sm">
            Drop to pin a photo
          </div>
        </div>
      )}

      <div className="relative mx-auto max-w-md px-4 pt-6">
        {/* Board header */}
        <div className="mb-5 flex items-center justify-between px-1">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-foreground/50">Bulletin Board</div>
            <div className="display text-xl text-foreground/80">Our little wall</div>
          </div>
          <div className="text-[11px] text-muted-foreground">{notes.length + extras.length} items</div>
        </div>

        {nothing && (
          <div
            className="rounded-3xl border-2 border-dashed border-foreground/20 p-12 text-center"
            style={{ background: "oklch(0.97 0.02 70 / 0.5)" }}
          >
            <div className="display text-xl text-foreground/60">The board is empty.</div>
            <p className="mt-2 text-sm text-muted-foreground">Drop a photo, or leave a note below.</p>
          </div>
        )}

        {/* Board items — 2-column masonry style */}
        {!nothing && (
          <div className="columns-2 gap-4 space-y-0">

            {/* Photo polaroids from notes */}
            {photoNotes.map((n, i) => {
              const tilt = n.rotation ?? getTilt(n.id);
              const borderColor = n.color ?? PASTEL_COLORS[i % PASTEL_COLORS.length].value;
              return (
                <div
                  key={n.id}
                  className="break-inside-avoid mb-4 inline-block w-full"
                  style={{ transform: `rotate(${tilt}deg)`, transformOrigin: "center center" }}
                >
                  <PolaroidCard
                    imageUrl={n.image_url!}
                    caption={n.body !== "(photo)" ? n.body : ""}
                    borderColor={borderColor}
                    onImageClick={() => setLightbox(n.image_url)}
                    onColorClick={() => setColorPickerFor(colorPickerFor === n.id ? null : n.id)}
                    showColorPicker={colorPickerFor === n.id}
                    onColorSelect={(color) => updateColor.mutate({ id: n.id, color })}
                  />
                </div>
              );
            })}

            {/* Extra photos from memories/trips */}
            {extras.map((t, i) => {
              const tilt = getTilt(t.id);
              const borderColor = PASTEL_COLORS[(i + 2) % PASTEL_COLORS.length].value;
              return (
                <div
                  key={`${t.kind}-${t.id}`}
                  className="break-inside-avoid mb-4 inline-block w-full"
                  style={{ transform: `rotate(${tilt}deg)`, transformOrigin: "center center" }}
                >
                  <PolaroidCard
                    imageUrl={t.url}
                    caption={t.title}
                    badge={t.kind}
                    borderColor={borderColor}
                    onImageClick={() => setLightbox(t.url)}
                  />
                </div>
              );
            })}

            {/* Sticky text notes */}
            {textNotes.map((n) => {
              const tilt = n.rotation ?? getTilt(n.id);
              return (
                <div
                  key={n.id}
                  className="break-inside-avoid mb-4 inline-block w-full"
                  style={{ transform: `rotate(${tilt}deg)`, transformOrigin: "center center" }}
                >
                  <StickyNote
                    note={n}
                    showColorPicker={colorPickerFor === n.id}
                    onColorClick={() => setColorPickerFor(colorPickerFor === n.id ? null : n.id)}
                    onColorSelect={(color) => updateColor.mutate({ id: n.id, color })}
                  />
                </div>
              );
            })}

          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => openSheet("add-note")}
        className="fixed bottom-24 right-5 z-20 flex items-center gap-2 rounded-full border border-white/50 bg-white/70 backdrop-blur-2xl px-5 py-3 text-sm shadow-[0_10px_30px_-10px_rgba(80,110,160,0.4)]"
      >
        <Plus size={16} /> New note
      </button>

      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />

      {/* Dismiss color picker on outside click */}
      {colorPickerFor && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setColorPickerFor(null)}
        />
      )}
    </div>
  );
}

// ── Polaroid Frame Component ──────────────────────────────────────────────────
function PolaroidCard({
  imageUrl, caption, badge, borderColor, onImageClick, onColorClick, showColorPicker, onColorSelect,
}: {
  imageUrl: string;
  caption?: string;
  badge?: string;
  borderColor: string;
  onImageClick?: () => void;
  onColorClick?: () => void;
  showColorPicker?: boolean;
  onColorSelect?: (c: string) => void;
}) {
  return (
    <div
      className="relative rounded-sm shadow-[0_6px_24px_-8px_rgba(0,0,0,0.25),0_2px_6px_rgba(0,0,0,0.1)]"
      style={{ background: "#fff" }}
    >
      {/* Push pin */}
      <div
        className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 w-4 h-4 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.3)] border border-white/60"
        style={{ background: borderColor }}
      />

      {/* Photo */}
      <button onClick={onImageClick} className="block w-full">
        <div className="relative overflow-hidden" style={{ aspectRatio: "4/3" }}>
          <img src={imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
          {/* Pastel tint border inside */}
          <div
            className="absolute inset-0 opacity-20"
            style={{ border: `4px solid ${borderColor}` }}
          />
        </div>
      </button>

      {/* Caption area */}
      <div className="px-3 pt-2 pb-3 relative">
        {badge && (
          <span className="text-[9px] uppercase tracking-widest text-foreground/40 mr-1">{badge}</span>
        )}
        {caption && (
          <p className="text-xs text-foreground/70 leading-snug line-clamp-2 font-[Nunito]">{caption}</p>
        )}
        {!caption && !badge && <div className="h-3" />}

        {/* Color picker button */}
        {onColorClick && (
          <div className="relative inline-block">
            <button
              onClick={(e) => { e.stopPropagation(); onColorClick(); }}
              className="absolute right-0 bottom-0 p-1 text-foreground/30 hover:text-foreground/60 transition-colors"
            >
              <Palette size={11} />
            </button>
            {showColorPicker && onColorSelect && (
              <div className="absolute bottom-6 right-0 z-30 flex gap-1.5 rounded-2xl border border-white/60 bg-white/90 backdrop-blur-xl p-2 shadow-lg">
                {PASTEL_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={(e) => { e.stopPropagation(); onColorSelect(c.value); }}
                    className="h-5 w-5 rounded-full border border-white/60 shadow-sm hover:scale-110 transition-transform"
                    style={{ background: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sticky Note Component ─────────────────────────────────────────────────────
function StickyNote({
  note, showColorPicker, onColorClick, onColorSelect,
}: {
  note: Note;
  showColorPicker: boolean;
  onColorClick: () => void;
  onColorSelect: (c: string) => void;
}) {
  const bg = note.color ?? PASTEL_COLORS[0].value;
  return (
    <div
      className="relative rounded-sm shadow-[0_4px_16px_-6px_rgba(0,0,0,0.2),0_1px_4px_rgba(0,0,0,0.08)] min-h-[100px]"
      style={{ background: bg }}
    >
      {/* Folded corner effect */}
      <div
        className="absolute bottom-0 right-0 w-6 h-6"
        style={{
          background: `linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.08) 50%)`,
          borderTopLeftRadius: "4px",
        }}
      />
      {/* Push pin */}
      <div
        className="absolute -top-2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.25)] border border-white/40"
        style={{ background: bg }}
      />

      <div className="px-3.5 pt-5 pb-4 relative">
        <div className="text-[9px] uppercase tracking-widest text-foreground/40 mb-1.5">{note.kind}</div>
        <p className="text-sm leading-relaxed text-foreground/85 font-[Nunito] whitespace-pre-wrap">{note.body}</p>

        {/* Color picker */}
        <div className="relative mt-3">
          <button
            onClick={(e) => { e.stopPropagation(); onColorClick(); }}
            className="text-foreground/30 hover:text-foreground/60 transition-colors"
          >
            <Palette size={11} />
          </button>
          {showColorPicker && (
            <div className="absolute bottom-5 left-0 z-30 flex gap-1.5 rounded-2xl border border-white/60 bg-white/90 backdrop-blur-xl p-2 shadow-lg">
              {PASTEL_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={(e) => { e.stopPropagation(); onColorSelect(c.value); }}
                  className="h-5 w-5 rounded-full border border-white/60 shadow-sm hover:scale-110 transition-transform"
                  style={{ background: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
