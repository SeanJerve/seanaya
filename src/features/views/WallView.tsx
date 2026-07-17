import { useMemo, useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Palette, Trash2, Eye, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useAppStore } from "@/features/app/store";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { uploadImage } from "@/lib/storage";
import { Lightbox } from "@/lib/Lightbox";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { useLongPress } from "@/hooks/useLongPress";
import { LongPressModal } from "@/components/ui/LongPressModal";
 
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
  author_id: string | null;
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
  const { openSheet, confirm } = useAppStore();
  const { user } = useUser();
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), "yyyy-MM"));
  const boardRef = useRef<HTMLDivElement>(null);
  const [lastViewedNotes, setLastViewedNotes] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [enlargedNote, setEnlargedNote] = useState<Note | null>(null);
  const [showLongPressInfo, setShowLongPressInfo] = useState(false);
  const longPressProps = useLongPress({
    onLongPress: () => setShowLongPressInfo(true),
    onClick: () => openSheet("add-note")
  });

  useEffect(() => {
    const val = localStorage.getItem("last_viewed_notes");
    if (!val) {
      const nowStr = new Date().toISOString();
      localStorage.setItem("last_viewed_notes", nowStr);
      setLastViewedNotes(nowStr);
    } else {
      setLastViewedNotes(val);
    }

    return () => {
      localStorage.setItem("last_viewed_notes", new Date().toISOString());
    };
  }, []);

  useEffect(() => {
    const key = "intro-dismissed-wall";
    const val = localStorage.getItem(key);
    if (!val) {
      setShowLongPressInfo(true);
      localStorage.setItem(key, "true");
    }
  }, []);

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", relationshipId],
    queryFn: async () =>
      ((await supabase
        .from("notes")
        .select("id,body,kind,color,pinned,image_url,image_path,rotation,pos_x,pos_y,created_at,author_id")
        .eq("relationship_id", relationshipId)
        .order("created_at", { ascending: true }) // Newer notes are painted last (drawn on top)
      ).data ?? []) as Note[],
  });

  // Calculate available months dynamically based on note dates
  const availableMonths = useMemo(() => {
    const list = new Set<string>();
    list.add(format(new Date(), "yyyy-MM")); // Always include current month
    notes.forEach((n) => {
      if (n.created_at) list.add(format(new Date(n.created_at), "yyyy-MM"));
    });
    return Array.from(list).sort((a, b) => b.localeCompare(a));
  }, [notes]);

  // Filter notes by selected month
  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      const dateStr = n.created_at ? format(new Date(n.created_at), "yyyy-MM") : format(new Date(), "yyyy-MM");
      return dateStr === selectedMonth;
    });
  }, [notes, selectedMonth]);



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

  const nothing = filteredNotes.length === 0;

  return (
    <div
      className="min-h-screen pb-32 relative overflow-x-hidden select-none"
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
        {/* Board header with Chevron Month Switcher */}
        {(() => {
          const idx = availableMonths.indexOf(selectedMonth);
          const canPrev = idx < availableMonths.length - 1;
          const canNext = idx > 0;
          const date = new Date(selectedMonth + "-02T00:00:00");
          const monthLabel = format(date, "MMMM yyyy");

          return (
            <div className="mb-6 flex items-center justify-between px-1">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={!canPrev}
                  onClick={() => setSelectedMonth(availableMonths[idx + 1])}
                  className={`p-1.5 rounded-full border border-white/60 bg-white/45 backdrop-blur-md shadow-sm transition-all active:scale-95 ${
                    canPrev ? "text-foreground hover:bg-white/60 cursor-pointer" : "text-muted-foreground/40 opacity-40 cursor-not-allowed"
                  }`}
                  title="Previous month"
                >
                  <ChevronLeft size={16} />
                </button>
                <h1 className="display text-3xl font-semibold text-foreground/90 capitalize leading-none pt-1">
                  {monthLabel}
                </h1>
                <button
                  type="button"
                  disabled={!canNext}
                  onClick={() => setSelectedMonth(availableMonths[idx - 1])}
                  className={`p-1.5 rounded-full border border-white/60 bg-white/45 backdrop-blur-md shadow-sm transition-all active:scale-95 ${
                    canNext ? "text-foreground hover:bg-white/60 cursor-pointer" : "text-muted-foreground/40 opacity-40 cursor-not-allowed"
                  }`}
                  title="Next month"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="text-[11px] font-semibold text-muted-foreground">{filteredNotes.length} items</div>
            </div>
          );
        })()}

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

            {/* Render Draggable Sticky Notes / Polaroid Cards */}
            {filteredNotes.map((n) => {
              const tilt = n.rotation ?? getTilt(n.id);
              const seeded = getSeededCoords(n.id);
              const px = n.pos_x !== null ? n.pos_x : seeded.x;
              const py = n.pos_y !== null ? n.pos_y : seeded.y;
              const isSelected = selectedNoteId === n.id;

              return (
                <motion.div
                  // Force React to remount this element on position coordinate updates,
                  // clearing Framer Motion's internal drag offset transform instantly!
                  key={`${n.id}-${px.toFixed(3)}-${py.toFixed(3)}`}
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
                  <div 
                    className="relative"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNoteId(isSelected ? null : n.id);
                    }}
                  >
                    {n.image_url ? (
                      <PolaroidCard
                        note={n}
                        isNew={lastViewedNotes ? (new Date(n.created_at) > new Date(lastViewedNotes) && n.author_id !== user?.id) : false}
                        onImageClick={() => setSelectedNoteId(n.id)}
                      />
                    ) : (
                      <StickyNote
                        note={n}
                        isNew={lastViewedNotes ? (new Date(n.created_at) > new Date(lastViewedNotes) && n.author_id !== user?.id) : false}
                      />
                    )}

                    {/* Popover Action Menu */}
                    <AnimatePresence>
                      {isSelected && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.8, y: 10 }}
                          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex items-center gap-1.5 rounded-full border border-white/50 bg-white/80 backdrop-blur-md p-1 shadow-lg z-50 pointer-events-auto"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              setEnlargedNote(n);
                              setSelectedNoteId(null);
                            }}
                            className="p-1.5 rounded-full hover:bg-white text-foreground/75 hover:text-foreground transition-all"
                            title="Enlarge note"
                          >
                            <Eye size={12} />
                          </button>
                          <button
                            onClick={() => {
                              confirm({
                                title: "Delete note?",
                                message: "Are you sure you want to permanently delete this note from the board?",
                                onConfirm: () => deleteNote.mutate(n),
                              });
                              setSelectedNoteId(null);
                            }}
                            className="p-1.5 rounded-full bg-red-50 border border-red-200/50 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                            title="Delete note"
                          >
                            <Trash2 size={12} />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        {...longPressProps}
        className="fixed bottom-24 right-5 z-40 flex items-center gap-2 rounded-full border border-white/50 bg-white/70 backdrop-blur-2xl px-5 py-3 text-sm shadow-[0_10px_30px_-10px_rgba(80,110,160,0.4)] hover:bg-white/80 active:scale-95 transition-all"
      >
        <Plus size={16} /> New note
      </button>

      <LongPressModal
        isOpen={showLongPressInfo}
        onClose={() => setShowLongPressInfo(false)}
        title="New Note / Polaroid"
        description="Tap to pin a new message or polaroid photo on our board. You can write a message, pick a pastel theme color, or upload a photo that will stay glowing on your partner's board until they check it."
      />

      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />

      {/* Enlarged Note Modal */}
      <AnimatePresence>
        {enlargedNote && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/20 backdrop-blur-[4px]"
            onClick={() => setEnlargedNote(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setEnlargedNote(null)}
                className="absolute -top-3 -right-3 rounded-full bg-white border border-white/50 p-1 text-foreground/60 shadow-lg hover:text-foreground transition-all z-50"
              >
                <X size={14} />
              </button>

              {enlargedNote.image_url ? (
                /* Enlarged Polaroid Card */
                <div className="rounded-md shadow-2xl w-[260px] p-4 bg-white pb-6 flex flex-col justify-between select-text">
                  <div className="relative overflow-hidden rounded-sm mb-3" style={{ aspectRatio: "1" }}>
                    <img src={enlargedNote.image_url} alt="" className="w-full h-full object-cover" />
                  </div>
                  {enlargedNote.body && enlargedNote.body !== "(photo)" && (
                    <div className="text-center px-1">
                      <p className="text-xs text-foreground/80 leading-relaxed font-[Nunito] break-words whitespace-pre-wrap select-text selection:bg-primary/20">
                        {enlargedNote.body}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* Enlarged Sticky Note */
                <div 
                  className="rounded-md shadow-2xl w-[240px] min-h-[220px] p-5 pb-6 flex flex-col justify-between select-text"
                  style={{ background: enlargedNote.color ?? "oklch(0.95 0.07 90 / 0.85)" }}
                >
                  <div>
                    <p className="text-sm leading-relaxed text-foreground/85 font-[Nunito] break-words whitespace-pre-wrap select-text selection:bg-black/10">
                      {enlargedNote.body}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Standalone Polaroid Frame Component (Used for Photo Notes) ─────────────────────
function PolaroidCard({
  note, isNew, onImageClick
}: {
  note: Note;
  isNew: boolean;
  onImageClick?: () => void;
}) {
  const bg = note.color ?? PASTEL_COLORS[0].value;
  return (
    <div
      className={`relative rounded-sm shadow-[0_6px_20px_-8px_rgba(0,0,0,0.3),0_2px_6px_rgba(0,0,0,0.1)] w-[115px] md:w-[130px] p-2 bg-white pb-3 flex flex-col justify-between transition-all duration-500
        ${isNew ? "ring-2 ring-pink-400 dark:ring-pink-500 shadow-[0_0_15px_rgba(244,143,177,0.8)] scale-[1.025] animate-pulse" : ""}`}
    >
      {/* Push pin */}
      <div
        className="absolute -top-1.5 left-1/2 -translate-x-1/2 z-10 w-3 h-3 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.25)] border border-white/40"
        style={{ background: bg }}
      />

      {/* Photo */}
      <button onClick={onImageClick} className="block w-full">
        <div className="relative overflow-hidden rounded-sm" style={{ aspectRatio: "1" }}>
          <img src={note.image_url!} alt="" loading="lazy" className="w-full h-full object-cover pointer-events-none" />
        </div>
      </button>

      {/* Caption area */}
      <div className="px-0.5 pt-2 pb-0.5 text-center pointer-events-none min-w-0">
        <p className="text-[10px] text-foreground/75 leading-snug truncate font-[Nunito]">{note.body !== "(photo)" ? note.body : ""}</p>
      </div>
    </div>
  );
}

// ── Sticky Note Component (Only text, no overlaid polaroid anymore!) ────────────────────────────────
function StickyNote({
  note, isNew
}: {
  note: Note;
  isNew: boolean;
}) {
  const bg = note.color ?? PASTEL_COLORS[0].value;

  return (
    <div
      className={`relative rounded-sm shadow-[0_6px_20px_-8px_rgba(0,0,0,0.3),0_2px_6px_rgba(0,0,0,0.1)] w-[140px] md:w-[155px] min-h-[145px] pb-4 flex flex-col justify-between transition-all duration-500
        ${isNew ? "ring-2 ring-pink-400 dark:ring-pink-500 shadow-[0_0_15px_rgba(244,143,177,0.8)] scale-[1.025] animate-pulse" : ""}`}
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

      <div className="px-3 pt-4.5 pb-2 relative flex-1 flex flex-col justify-between">
        <div>
          <p className="text-xs leading-relaxed text-foreground/80 font-[Nunito] break-words line-clamp-5 overflow-hidden whitespace-pre-wrap select-none pointer-events-none">
            {note.body}
          </p>
        </div>
      </div>
    </div>
  );
}
