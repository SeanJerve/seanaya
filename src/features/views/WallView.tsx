import { useMemo, useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Palette, Trash2 } from "lucide-react";
import { useAppStore } from "@/features/app/store";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { uploadImage } from "@/lib/storage";
import { Lightbox } from "@/lib/Lightbox";
import { motion } from "framer-motion";
import { format } from "date-fns";

type Note = {
  id: string;
  body: string;
  kind: string;
  color: string | null;
  pinned: boolean;
  image_url: string | null;
  image_path: string | null;
  rotation: number | null;
  pos_x: number | null;
  pos_y: number | null;
  created_at: string;
};

type PhotoTile = {
  id: string;
  title: string;
  sub: string;
  url: string;
  kind: "trip" | "memory";
  dateStr?: string | null;
};

const PASTEL_COLORS = [
  { label: "Butter",   value: "oklch(0.95 0.07 90 / 0.85)" },
  { label: "Rose",     value: "oklch(0.94 0.06 5 / 0.85)" },
  { label: "Mint",     value: "oklch(0.94 0.06 160 / 0.85)" },
  { label: "Lavender", value: "oklch(0.93 0.06 290 / 0.85)" },
  { label: "Peach",    value: "oklch(0.94 0.07 55 / 0.85)" },
  { label: "Sky",      value: "oklch(0.94 0.05 230 / 0.85)" },
];

function getTilt(id: string): number {
  const seed = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  return ((seed % 24) - 12) * 1.35; // range roughly -16.2 to 16.2 degrees
}

function getSeededCoords(id: string) {
  const seedX = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  const seedY = id.charCodeAt(1) + id.charCodeAt(id.length - 2);
  const x = ((seedX % 7) * 0.1) + 0.1; // range 10% to 70%
  const y = ((seedY % 6) * 0.1) + 0.15; // range 15% to 65%
  return { x, y };
}

export function WallView({ relationshipId }: { relationshipId: string }) {
  const qc = useQueryClient();
  const { openSheet } = useAppStore();
  const { user } = useUser();
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), "yyyy-MM"));
  const boardRef = useRef<HTMLDivElement>(null);

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", relationshipId],
    queryFn: async () =>
      ((await supabase
        .from("notes")
        .select("id,body,kind,color,pinned,image_url,image_path,rotation,pos_x,pos_y,created_at")
        .eq("relationship_id", relationshipId)
        .order("created_at", { ascending: true }) // Newer notes are painted last (drawn on top)
      ).data ?? []) as Note[],
  });

  const { data: extras = [] } = useQuery({
    queryKey: ["wall-extras", relationshipId],
    queryFn: async (): Promise<PhotoTile[]> => {
      const [trips, mems] = await Promise.all([
        supabase.from("trips").select("id,title,location,cover_url,created_at").eq("relationship_id", relationshipId).not("cover_url", "is", null).order("created_at", { ascending: false }),
        supabase.from("memories").select("id,title,location,cover_url,memory_date").eq("relationship_id", relationshipId).not("cover_url", "is", null).order("memory_date", { ascending: false }),
      ]);
      const t: PhotoTile[] = (trips.data ?? []).map((r) => ({ id: r.id, title: r.title, sub: r.location ?? "", url: r.cover_url!, kind: "trip", dateStr: r.created_at }));
      const m: PhotoTile[] = (mems.data ?? []).map((r) => ({ id: r.id, title: r.title, sub: r.location ?? "", url: r.cover_url!, kind: "memory", dateStr: r.memory_date }));
      return [...m, ...t];
    },
  });

  // Calculate available months dynamically based on note dates
  const availableMonths = useMemo(() => {
    const list = new Set<string>();
    list.add(format(new Date(), "yyyy-MM")); // Always include current month
    notes.forEach((n) => {
      if (n.created_at) list.add(format(new Date(n.created_at), "yyyy-MM"));
    });
    extras.forEach((e) => {
      if (e.dateStr) list.add(format(new Date(e.dateStr), "yyyy-MM"));
    });
    return Array.from(list).sort((a, b) => b.localeCompare(a));
  }, [notes, extras]);

  // Filter notes and extras by selected month
  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      const dateStr = n.created_at ? format(new Date(n.created_at), "yyyy-MM") : format(new Date(), "yyyy-MM");
      return dateStr === selectedMonth;
    });
  }, [notes, selectedMonth]);

  const filteredExtras = useMemo(() => {
    return extras.filter((e) => {
      const d = e.dateStr ? new Date(e.dateStr) : new Date();
      return format(d, "yyyy-MM") === selectedMonth;
    });
  }, [extras, selectedMonth]);

  const updateColor = useMutation({
    mutationFn: async ({ id, color }: { id: string; color: string }) => {
      const { error } = await supabase.from("notes").update({ color }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { setColorPickerFor(null); qc.invalidateQueries({ queryKey: ["notes"] }); },
    onError: (e: any) => toast.error(e?.message || String(e) || "Try again"),
  });

  const updatePosition = useMutation({
    mutationFn: async ({ id, pos_x, pos_y }: { id: string; pos_x: number; pos_y: number }) => {
      const { error } = await supabase.from("notes").update({ pos_x, pos_y }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, pos_x, pos_y }) => {
      await qc.cancelQueries({ queryKey: ["notes", relationshipId] });
      const previousNotes = qc.getQueryData<Note[]>(["notes", relationshipId]);
      qc.setQueryData<Note[]>(["notes", relationshipId], (old) => {
        if (!old) return [];
        return old.map((n) => (n.id === id ? { ...n, pos_x, pos_y } : n));
      });
      return { previousNotes };
    },
    onError: (err, newPos, context) => {
      if (context?.previousNotes) {
        qc.setQueryData(["notes", relationshipId], context.previousNotes);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["notes", relationshipId] });
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (n: Note) => {
      const { error } = await supabase.from("notes").delete().eq("id", n.id);
      if (error) throw error;

      // Clean up storage file if it exists
      if (n.image_path) {
        await supabase.storage.from("wall").remove([n.image_path]);
      }
    },
    onSuccess: () => {
      toast.success("Note removed from board");
      qc.invalidateQueries({ queryKey: ["notes", relationshipId] });
    },
    onError: (e: any) => toast.error(e?.message || String(e)),
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
        pos_x: Math.random() * 0.5 + 0.1,
        pos_y: Math.random() * 0.5 + 0.1,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pinned to your board"); qc.invalidateQueries({ queryKey: ["notes"] }); },
    onError: (e: any) => toast.error(e?.message || String(e) || "Try again"),
  });

  const nothing = filteredNotes.length === 0 && filteredExtras.length === 0;

  return (
    <div
      className="min-h-screen pb-32 relative overflow-x-hidden select-none"
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

      <div className="relative mx-auto max-w-md px-4 pt-6 flex flex-col">
        {/* Board header */}
        <div className="mb-4 flex items-center justify-between px-1">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-foreground/50">Bulletin Board</div>
            <div className="display text-xl text-foreground/80">Our little wall</div>
          </div>
          <div className="text-[11px] text-muted-foreground">{filteredNotes.length + filteredExtras.length} items</div>
        </div>

        {/* Board Month Selector */}
        <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-none px-1">
          {availableMonths.map((m) => {
            const date = new Date(m + "-02T00:00:00");
            const label = format(date, "MMM yyyy");
            const active = selectedMonth === m;
            return (
              <button
                key={m}
                onClick={() => setSelectedMonth(m)}
                className={`shrink-0 rounded-full px-3.5 py-1 text-xs transition-all border
                  ${active 
                    ? "bg-foreground/15 border-foreground/30 font-semibold text-foreground shadow-sm" 
                    : "bg-white/40 border-white/20 text-muted-foreground hover:bg-white/60"}`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {nothing ? (
          <div
            className="rounded-3xl border border-dashed border-foreground/20 p-12 text-center my-6"
            style={{ background: "oklch(0.97 0.02 70 / 0.5)" }}
          >
            <div className="display text-xl text-foreground/60">This month's board is empty.</div>
            <p className="mt-2 text-sm text-muted-foreground">Drop a photo or click "New note" to begin pinning.</p>
          </div>
        ) : (
          /* Draggable absolute bulletin board space (borderless, overflow-visible to support bleeding) */
          <div
            ref={boardRef}
            className="relative w-full h-[620px] overflow-visible select-none"
          >
            {/* Background grid line just for fun */}
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)", backgroundSize: "20px 20px" }} />

            {/* Render Draggable Sticky Notes */}
            {filteredNotes.map((n) => {
              const tilt = n.rotation ?? getTilt(n.id);
              const seeded = getSeededCoords(n.id);
              const px = n.pos_x !== null ? n.pos_x : seeded.x;
              const py = n.pos_y !== null ? n.pos_y : seeded.y;

              return (
                <motion.div
                  key={n.id}
                  drag
                  dragConstraints={boardRef}
                  dragElastic={0}
                  dragMomentum={false}
                  onDragEnd={(event) => {
                    if (!boardRef.current) return;
                    const board = boardRef.current.getBoundingClientRect();
                    const el = event.target as HTMLElement;
                    const card = el.closest(".card-drag-target") as HTMLElement;
                    if (card) {
                      const rect = card.getBoundingClientRect();
                      const xPct = (rect.left - board.left) / board.width;
                      const yPct = (rect.top - board.top) / board.height;
                      // Allow notes to bleed off-screen up to 15% on each edge
                      const newX = Math.min(Math.max(xPct, -0.15), 0.85);
                      const newY = Math.min(Math.max(yPct, -0.15), 0.85);
                      updatePosition.mutate({ id: n.id, pos_x: newX, pos_y: newY });
                    }
                  }}
                  className="card-drag-target absolute cursor-grab active:cursor-grabbing touch-none select-none z-10"
                  style={{
                    left: `${px * 100}%`,
                    top: `${py * 100}%`,
                    transform: `rotate(${tilt}deg)`,
                  }}
                  whileDrag={{ scale: 1.05, zIndex: 50, rotate: 0 }}
                >
                  <StickyNote
                    note={n}
                    showColorPicker={colorPickerFor === n.id}
                    onColorClick={() => setColorPickerFor(colorPickerFor === n.id ? null : n.id)}
                    onColorSelect={(color) => updateColor.mutate({ id: n.id, color })}
                    onDelete={() => deleteNote.mutate(n)}
                    onImageClick={() => setLightbox(n.image_url)}
                  />
                </motion.div>
              );
            })}

            {/* Render Draggable Extra polaroid tiles (memories & trips) */}
            {filteredExtras.map((t, i) => {
              const tilt = getTilt(t.id);
              const seeded = getSeededCoords(t.id);
              // Shift Y coordinate down slightly so they interleave nicely
              const px = seeded.x;
              const py = Math.min(seeded.y + 0.15, 0.72);
              const borderColor = PASTEL_COLORS[(i + 2) % PASTEL_COLORS.length].value;

              return (
                <motion.div
                  key={`${t.kind}-${t.id}`}
                  drag
                  dragConstraints={boardRef}
                  dragElastic={0}
                  dragMomentum={false}
                  className="absolute cursor-grab active:cursor-grabbing touch-none select-none z-10"
                  style={{
                    left: `${px * 100}%`,
                    top: `${py * 100}%`,
                    transform: `rotate(${tilt}deg)`,
                  }}
                  whileDrag={{ scale: 1.05, zIndex: 50, rotate: 0 }}
                >
                  <PolaroidCard
                    imageUrl={t.url}
                    caption={t.title}
                    badge={t.kind}
                    borderColor={borderColor}
                    onImageClick={() => setLightbox(t.url)}
                  />
                </motion.div>
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

      {colorPickerFor && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setColorPickerFor(null)}
        />
      )}
    </div>
  );
}

// ── Standalone Polaroid Frame Component (Trips & Memories) ─────────────────────
function PolaroidCard({
  imageUrl, caption, badge, borderColor, onImageClick
}: {
  imageUrl: string;
  caption?: string;
  badge?: string;
  borderColor: string;
  onImageClick?: () => void;
}) {
  return (
    <div
      className="relative rounded-sm shadow-[0_6px_20px_-8px_rgba(0,0,0,0.3),0_2px_6px_rgba(0,0,0,0.1)] w-[110px] md:w-[120px] p-2 bg-white"
    >
      {/* Push pin */}
      <div
        className="absolute -top-1.5 left-1/2 -translate-x-1/2 z-10 w-3 h-3 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.25)] border border-white/40"
        style={{ background: borderColor }}
      />

      {/* Photo */}
      <button onClick={onImageClick} className="block w-full">
        <div className="relative overflow-hidden rounded-sm" style={{ aspectRatio: "1" }}>
          <img src={imageUrl} alt="" loading="lazy" className="w-full h-full object-cover pointer-events-none" />
          <div
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{ border: `3px solid ${borderColor}` }}
          />
        </div>
      </button>

      {/* Caption area */}
      <div className="px-1 pt-1.5 pb-0.5 text-center pointer-events-none">
        {badge && (
          <span className="text-[7px] uppercase tracking-widest text-foreground/45 block mb-0.5">{badge}</span>
        )}
        {caption && (
          <p className="text-[9px] text-foreground/75 leading-snug truncate font-[Nunito]">{caption}</p>
        )}
      </div>
    </div>
  );
}

// ── Sticky Note Component with Overlay Polaroid ────────────────────────────────
function StickyNote({
  note, showColorPicker, onColorClick, onColorSelect, onDelete, onImageClick
}: {
  note: Note;
  showColorPicker: boolean;
  onColorClick: () => void;
  onColorSelect: (c: string) => void;
  onDelete: () => void;
  onImageClick?: () => void;
}) {
  const bg = note.color ?? PASTEL_COLORS[0].value;
  // Seed a random tilt for the small overlaid polaroid
  const seed = note.id.charCodeAt(1) + note.id.charCodeAt(note.id.length - 2);
  const polaroidTilt = ((seed % 9) - 4.5) * 1.5;

  return (
    <div
      className="relative rounded-sm shadow-[0_6px_20px_-8px_rgba(0,0,0,0.3),0_2px_6px_rgba(0,0,0,0.1)] w-[140px] md:w-[155px] min-h-[145px] pb-4 flex flex-col justify-between"
      style={{ background: bg }}
    >
      {/* Folded corner effect */}
      <div
        className="absolute bottom-0 right-0 w-6 h-6 pointer-events-none"
        style={{
          background: `linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.08) 50%)`,
          borderTopLeftRadius: "4px",
        }}
      />
      {/* Push pin */}
      <div
        className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.25)] border border-white/40 z-10 pointer-events-none"
        style={{ background: bg }}
      />

      {/* Delete button (trash icon at top-right) */}
      <button
        onClick={(e) => { e.stopPropagation(); if (confirm("Delete this note?")) onDelete(); }}
        className="absolute top-1.5 right-1.5 text-foreground/35 hover:text-red-500 transition-colors p-0.5 z-20"
        title="Delete note"
      >
        <Trash2 size={12} />
      </button>

      <div className="px-3 pt-4.5 pb-2 relative flex-1 flex flex-col justify-between">
        <div>
          <div className="text-[8px] uppercase tracking-widest text-foreground/35 mb-1 select-none pointer-events-none">{note.kind}</div>
          <p className="text-xs leading-relaxed text-foreground/80 font-[Nunito] break-words line-clamp-5 overflow-hidden whitespace-pre-wrap select-none pointer-events-none">
            {note.body !== "(photo)" ? note.body : ""}
          </p>
        </div>

        {/* Small Polaroid inside/overlapping bottom-left if there is a photo */}
        {note.image_url && (
          <div 
            className="absolute -bottom-8 -left-4 w-[85px] h-[105px] bg-white rounded-sm p-1.5 shadow-[0_4px_10px_rgba(0,0,0,0.25)] border border-black/5 cursor-pointer z-10"
            style={{ transform: `rotate(${polaroidTilt}deg)` }}
            onClick={(e) => { e.stopPropagation(); onImageClick?.(); }}
          >
            <div className="w-full h-[70px] overflow-hidden bg-gray-100 rounded-sm">
              <img src={note.image_url} alt="" className="w-full h-full object-cover pointer-events-none" />
            </div>
            <div className="text-[7px] text-foreground/60 text-center mt-1 truncate font-[Nunito] select-none pointer-events-none">
              {note.body !== "(photo)" ? note.body : "Photo"}
            </div>
          </div>
        )}

        {/* Bottom controls */}
        <div className="flex items-center justify-between mt-3 pt-1">
          {/* Color picker */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); onColorClick(); }}
              className="text-foreground/30 hover:text-foreground/60 transition-colors p-0.5"
            >
              <Palette size={10} />
            </button>
            {showColorPicker && (
              <div className="absolute bottom-5 left-0 z-35 flex gap-1 rounded-2xl border border-white/60 bg-white/90 backdrop-blur-xl p-1.5 shadow-lg">
                {PASTEL_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={(e) => { e.stopPropagation(); onColorSelect(c.value); }}
                    className="h-4.5 w-4.5 rounded-full border border-white/60 shadow-sm hover:scale-110 transition-transform"
                    style={{ background: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
