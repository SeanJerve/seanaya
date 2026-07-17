import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, X, Trash2, BookHeart, Eye, ArrowLeft, Heart, Image as ImageIcon, Sparkles, StickyNote, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { useAppStore } from "@/features/app/store";
import { Lightbox } from "@/lib/Lightbox";
import { toast } from "sonner";
import { uploadImage } from "@/lib/storage";
import { motion, AnimatePresence } from "framer-motion";

type AlbumPage = {
  id: string;
  page_index: number;
};

type AlbumItem = {
  id: string;
  page_id: string;
  item_type: string; // 'sticker' | 'polaroid' | 'picture' | 'text'
  content: string | null;
  image_url: string | null;
  color: string | null;
  pos_x: number;
  pos_y: number;
  scale: number;
  rotation: number;
};

const STICKER_PRESETS = [
  "💝", "💖", "💕", "🌸", "🌷", "🐱", "🐾", "✨", "🧸", "🎈", "🍫", "🍩", "💌", "🏡", "⭐", "🎉"
];

const PASTEL_COLORS = [
  "oklch(0.95 0.07 90 / 0.85)",  // Butter
  "oklch(0.94 0.06 5 / 0.85)",   // Rose
  "oklch(0.94 0.06 160 / 0.85)", // Mint
  "oklch(0.93 0.06 290 / 0.85)", // Lavender
  "oklch(0.94 0.07 55 / 0.85)",  // Peach
  "oklch(0.94 0.05 230 / 0.85)", // Sky
];

export function MemoriesView({ relationshipId }: { relationshipId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<"stickers" | "photos" | "note" | "recent" | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteColor, setNoteColor] = useState(PASTEL_COLORS[0]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const pageRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const { confirm } = useAppStore();

  // Fetch album pages
  const { data: pages = [], refetch: refetchPages } = useQuery({
    queryKey: ["album-pages", relationshipId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("album_pages")
        .select("*")
        .eq("relationship_id", relationshipId)
        .order("page_index", { ascending: true });
      if (error) throw error;
      return data as AlbumPage[];
    }
  });

  // Fetch album items
  const { data: items = [], refetch: refetchItems } = useQuery({
    queryKey: ["album-items", relationshipId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("album_items")
        .select("*");
      if (error) throw error;
      return data as AlbumItem[];
    }
  });

  // Fetch recent bulletin board notes/photos for import
  const { data: recentNotes = [] } = useQuery({
    queryKey: ["recent-notes", relationshipId],
    queryFn: async () => {
      const { data } = await supabase
        .from("notes")
        .select("*")
        .eq("relationship_id", relationshipId)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    }
  });

  // Fetch recent stickers for import
  const { data: recentStickers = [] } = useQuery({
    queryKey: ["recent-stickers", relationshipId],
    queryFn: async () => {
      const { data } = await supabase
        .from("stickers")
        .select("*")
        .eq("relationship_id", relationshipId)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    }
  });

  // Create a default page if none exist
  useEffect(() => {
    if (pages.length === 0 && isOpen) {
      (async () => {
        await (supabase as any).from("album_pages").insert({
          relationship_id: relationshipId,
          page_index: 0
        });
        refetchPages();
      })();
    }
  }, [pages, isOpen]);

  // Real-time synchronization
  useEffect(() => {
    const channel = supabase
      .channel("album-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "album_pages" }, () => {
        refetchPages();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "album_items" }, () => {
        refetchItems();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Mutations
  const addPage = useMutation({
    mutationFn: async () => {
      const maxIdx = pages.reduce((max, p) => p.page_index > max ? p.page_index : max, -1);
      const { error } = await (supabase as any).from("album_pages").insert({
        relationship_id: relationshipId,
        page_index: maxIdx + 1
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchPages();
      toast.success("Page added to album!");
    }
  });

  const deletePage = useMutation({
    mutationFn: async (pageId: string) => {
      const { error } = await (supabase as any).from("album_pages").delete().eq("id", pageId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchPages();
      setCurrentPageIdx(prev => Math.max(0, prev - 1));
      toast.success("Page deleted");
    }
  });

  const addItem = useMutation({
    mutationFn: async (item: Omit<AlbumItem, "id">) => {
      const { error } = await (supabase as any).from("album_items").insert(item);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchItems();
    }
  });

  const updateItemPosition = useMutation({
    mutationFn: async ({ id, pos_x, pos_y }: { id: string; pos_x: number; pos_y: number }) => {
      const { error } = await (supabase as any).from("album_items").update({ pos_x, pos_y }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, pos_x, pos_y }) => {
      await qc.cancelQueries({ queryKey: ["album-items", relationshipId] });
      const previous = qc.getQueryData<AlbumItem[]>(["album-items", relationshipId]);
      qc.setQueryData<AlbumItem[]>(["album-items", relationshipId], (old) => {
        if (!old) return [];
        return old.map((it) => (it.id === id ? { ...it, pos_x, pos_y } : it));
      });
      return { previous };
    },
    onError: (e, vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["album-items", relationshipId], ctx.previous);
    },
    onSuccess: () => {
      refetchItems();
    }
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("album_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchItems();
      setSelectedItemId(null);
      toast.success("Item removed");
    }
  });

  const uploadPhoto = useMutation({
    mutationFn: async ({ file, isPolaroid }: { file: File; isPolaroid: boolean }) => {
      const itemId = crypto.randomUUID();
      const { url } = await uploadImage("wall", relationshipId, file, `album/${itemId}`);
      const activePage = pages[currentPageIdx];
      if (!activePage) return;

      await addItem.mutateAsync({
        page_id: activePage.id,
        item_type: isPolaroid ? "polaroid" : "picture",
        content: null,
        image_url: url,
        color: null,
        pos_x: 50,
        pos_y: 45,
        scale: 1,
        rotation: (Math.random() - 0.5) * 8
      });
    },
    onSuccess: () => {
      toast.success("Photo added to page!");
      setActiveTab(null);
    },
    onError: (e: any) => toast.error(e?.message || "Failed to upload photo")
  });

  const activePage = pages[currentPageIdx];
  const activePageItems = useMemo(() => {
    if (!activePage) return [];
    return items.filter(it => it.page_id === activePage.id);
  }, [items, activePage]);

  // Render Closed Book Cover
  const renderClosedBook = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-6 relative min-h-[calc(100vh-140px)]">
      {/* Dreamy watercolor blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[10%] -left-20 w-80 h-80 rounded-full bg-pink-200/10 blur-[80px]" />
        <div className="absolute bottom-[20%] -right-20 w-96 h-96 rounded-full bg-blue-200/15 blur-[100px]" />
      </div>

      <motion.div
        whileHover={{ scale: 1.02, rotate: 1 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(true)}
        className="w-[260px] h-[340px] rounded-3xl bg-gradient-to-br from-primary via-primary/90 to-sky border-4 border-white/60 shadow-[0_30px_70px_-15px_rgba(80,110,160,0.5),inset_0_2px_4px_rgba(255,255,255,0.8)] flex flex-col justify-between p-8 text-center cursor-pointer relative overflow-hidden group select-none z-10"
      >
        <div className="absolute inset-0 bg-white/5 opacity-10 group-hover:opacity-20 transition-opacity" />
        <div className="absolute left-2.5 top-0 bottom-0 w-[5px] bg-black/10 rounded-full" />
        
        <div className="mt-8 flex flex-col items-center">
          <BookHeart size={44} className="text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.4)]" />
          <h2 className="display text-3xl text-white font-bold tracking-tight mt-5 drop-shadow-sm">Our Album</h2>
          <div className="mt-2 h-px w-24 bg-white/40" />
        </div>
        
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.25em] text-white/90 font-bold drop-shadow-sm">Sean & Aya</p>
          <span className="text-[10px] text-white/50 block mt-4 animate-pulse">Tap to Open</span>
        </div>
      </motion.div>
    </div>
  );

  // Render Open Book Layout
  const renderOpenBook = () => {
    return (
      <div className="mx-auto max-w-md px-4 py-4 flex flex-col items-center select-none pb-32">
        {/* Book Header Toolbar */}
        <div className="w-full flex items-center justify-between mb-4 px-1 text-xs">
          <button
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-1 text-foreground/60 hover:text-foreground font-semibold"
          >
            <ArrowLeft size={14} /> Close Album
          </button>
          
          <div className="flex items-center gap-2">
            <span className="font-semibold text-muted-foreground">
              Page {pages.length === 0 ? 0 : currentPageIdx + 1} of {pages.length}
            </span>
            
            {pages.length > 1 && (
              <button
                onClick={() => {
                  confirm({
                    title: "Delete this page?",
                    message: "Are you sure you want to delete this page and all items decorated inside it?",
                    onConfirm: () => {
                      if (activePage) deletePage.mutate(activePage.id);
                    }
                  });
                }}
                className="p-1 rounded-full text-red-500 hover:bg-red-50"
                title="Delete current page"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Paper Page layout */}
        <div className="relative w-full flex items-center justify-center p-2 min-h-[420px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPageIdx}
              ref={pageRef}
              initial={{ opacity: 0, scale: 0.94, rotate: -2, y: 15 }}
              animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, rotate: 2, y: -15 }}
              transition={{ type: "spring", damping: 20, stiffness: 130 }}
              className="relative w-full max-w-[320px] aspect-[1/1.3] rounded-3xl border border-white/50 bg-[#fafafa] shadow-2xl overflow-hidden"
              onClick={() => setSelectedItemId(null)}
            >
              {/* Grid notebook texture */}
              <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1.5px,transparent_1.5px)] [background-size:16px_16px] pointer-events-none" />

              {activePageItems.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center pointer-events-none">
                  <BookHeart size={32} className="text-foreground/20 mb-2" />
                  <div className="text-xs font-semibold text-foreground/50">This page is empty</div>
                  <p className="text-[10px] text-muted-foreground mt-1">Use the tools below to start decorating our space!</p>
                </div>
              ) : (
                activePageItems.map((it) => {
                  const isSelected = selectedItemId === it.id;
                  
                  return (
                    <motion.div
                      key={it.id}
                      drag
                      dragConstraints={pageRef}
                      dragMomentum={false}
                      dragElastic={0.05}
                      onDragEnd={(e, info) => {
                        const rect = pageRef.current?.getBoundingClientRect();
                        if (!rect) return;
                        const x = ((info.point.x - rect.left) / rect.width) * 100;
                        const y = ((info.point.y - rect.top) / rect.height) * 100;
                        updateItemPosition.mutate({
                          id: it.id,
                          pos_x: Math.max(5, Math.min(95, x)),
                          pos_y: Math.max(5, Math.min(95, y))
                        });
                      }}
                      onDragStart={() => setSelectedItemId(null)}
                      whileDrag={{ scale: 1.05, zIndex: 100 }}
                      className="absolute touch-none select-none cursor-grab active:cursor-grabbing"
                      style={{
                        left: `${it.pos_x}%`,
                        top: `${it.pos_y}%`,
                        x: "-50%",
                        y: "-50%",
                        rotate: it.rotation,
                        zIndex: isSelected ? 50 : 10
                      }}
                    >
                      <div
                        className="relative p-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItemId(isSelected ? null : it.id);
                        }}
                      >
                        {/* 1. Emojis / Sticker Presets */}
                        {it.item_type === "sticker" && (
                          <div className="text-5xl drop-shadow-md select-none pointer-events-none">
                            {it.content}
                          </div>
                        )}

                        {/* 2. Plain Picture */}
                        {it.item_type === "picture" && it.image_url && (
                          <div className="w-24 h-24 rounded-lg overflow-hidden border border-white/80 shadow-md bg-white select-none pointer-events-none">
                            <img src={it.image_url} alt="" className="w-full h-full object-cover" />
                          </div>
                        )}

                        {/* 3. Polaroid Frame */}
                        {it.item_type === "polaroid" && it.image_url && (
                          <div className="w-24 p-1.5 pb-5 rounded bg-white shadow-lg border border-black/5 flex flex-col items-center select-none pointer-events-none">
                            <div className="w-full aspect-square overflow-hidden bg-slate-50">
                              <img src={it.image_url} alt="" className="w-full h-full object-cover" />
                            </div>
                          </div>
                        )}

                        {/* 4. Text Note card */}
                        {it.item_type === "text" && (
                          <div
                            className="max-w-[130px] p-2.5 rounded-lg shadow-md border border-white/20 select-none pointer-events-none text-left"
                            style={{ background: it.color || PASTEL_COLORS[0] }}
                          >
                            <p className="text-[10px] text-foreground/80 font-medium leading-tight whitespace-pre-wrap break-words">
                              {it.content}
                            </p>
                          </div>
                        )}

                        {/* Selection actions panel */}
                        <AnimatePresence>
                          {isSelected && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 flex items-center gap-1 bg-white/95 border border-white/40 rounded-full shadow-lg p-0.5 z-50 pointer-events-auto"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {(it.item_type === "polaroid" || it.item_type === "picture") && it.image_url && (
                                <button
                                  onClick={() => {
                                    setLightbox(it.image_url);
                                    setSelectedItemId(null);
                                  }}
                                  className="p-1 rounded-full hover:bg-black/5 text-foreground/70"
                                >
                                  <Eye size={11} />
                                </button>
                              )}
                              <button
                                onClick={() => deleteItem.mutate(it.id)}
                                className="p-1 rounded-full hover:bg-red-50 text-red-500"
                              >
                                <Trash2 size={11} />
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Book Navigation controls */}
        <div className="w-full flex items-center justify-center gap-4 mt-2 mb-6">
          <button
            onClick={() => {
              setCurrentPageIdx(p => Math.max(0, p - 1));
              setSelectedItemId(null);
            }}
            disabled={currentPageIdx === 0}
            className="p-2 rounded-full border border-white/50 bg-white/40 backdrop-blur-md shadow-sm disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          
          <button
            onClick={() => addPage.mutate()}
            className="flex items-center gap-1 rounded-full border border-white/50 bg-white/45 backdrop-blur-md px-3.5 py-1.5 text-[10px] font-semibold text-foreground/80 shadow-sm"
          >
            <Plus size={12} /> Add Page
          </button>

          <button
            onClick={() => {
              setCurrentPageIdx(p => Math.min(pages.length - 1, p + 1));
              setSelectedItemId(null);
            }}
            disabled={currentPageIdx >= pages.length - 1}
            className="p-2 rounded-full border border-white/50 bg-white/40 backdrop-blur-md shadow-sm disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Decoration Tools Action Bar */}
        {activePage && (
          <div className="w-full flex flex-col gap-3 rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-4 shadow-xl">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
              <span>Decorating Tools</span>
              {activeTab && (
                <button onClick={() => setActiveTab(null)} className="text-primary hover:underline lowercase font-normal">
                  close panel
                </button>
              )}
            </div>

            {/* Icons list */}
            <div className="flex items-center justify-between gap-1 mt-1">
              <button
                onClick={() => setActiveTab(activeTab === "stickers" ? null : "stickers")}
                className={`flex-1 py-2 rounded-2xl flex flex-col items-center gap-1 text-[10px] font-bold border transition-all ${
                  activeTab === "stickers" ? "bg-primary border-primary text-white" : "bg-white/40 border-white/20 text-foreground/60 hover:bg-white/60"
                }`}
              >
                <Sparkles size={14} />
                Decorate
              </button>
              <button
                onClick={() => setActiveTab(activeTab === "photos" ? null : "photos")}
                className={`flex-1 py-2 rounded-2xl flex flex-col items-center gap-1 text-[10px] font-bold border transition-all ${
                  activeTab === "photos" ? "bg-primary border-primary text-white" : "bg-white/40 border-white/20 text-foreground/60 hover:bg-white/60"
                }`}
              >
                <ImageIcon size={14} />
                Add Photo
              </button>
              <button
                onClick={() => setActiveTab(activeTab === "note" ? null : "note")}
                className={`flex-1 py-2 rounded-2xl flex flex-col items-center gap-1 text-[10px] font-bold border transition-all ${
                  activeTab === "note" ? "bg-primary border-primary text-white" : "bg-white/40 border-white/20 text-foreground/60 hover:bg-white/60"
                }`}
              >
                <StickyNote size={14} />
                Add Note
              </button>
              <button
                onClick={() => setActiveTab(activeTab === "recent" ? null : "recent")}
                className={`flex-1 py-2 rounded-2xl flex flex-col items-center gap-1 text-[10px] font-bold border transition-all ${
                  activeTab === "recent" ? "bg-primary border-primary text-white" : "bg-white/40 border-white/20 text-foreground/60 hover:bg-white/60"
                }`}
              >
                <RefreshCw size={14} />
                Recently Added
              </button>
            </div>

            {/* Dynamic tool panels */}
            <AnimatePresence mode="wait">
              {/* STICKERS Preset panel */}
              {activeTab === "stickers" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pt-2"
                >
                  <div className="grid grid-cols-8 gap-2.5 p-1 max-h-24 overflow-y-auto">
                    {STICKER_PRESETS.map((st) => (
                      <button
                        key={st}
                        onClick={() => {
                          addItem.mutate({
                            page_id: activePage.id,
                            item_type: "sticker",
                            content: st,
                            image_url: null,
                            color: null,
                            pos_x: 50,
                            pos_y: 45,
                            scale: 1,
                            rotation: 0
                          });
                        }}
                        className="text-2xl hover:scale-110 active:scale-95 transition-transform"
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* PHOTO upload options */}
              {activeTab === "photos" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pt-2 space-y-3"
                >
                  <div className="flex gap-2 font-semibold">
                    <label className="flex-1 py-2.5 text-center rounded-2xl border border-white/60 bg-white/40 hover:bg-white/60 text-[11px] cursor-pointer active:scale-95 transition-all">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadPhoto.mutate({ file: f, isPolaroid: false });
                        }}
                      />
                      Add Plain Picture
                    </label>
                    <label className="flex-1 py-2.5 text-center rounded-2xl border border-white/60 bg-white/40 hover:bg-white/60 text-[11px] cursor-pointer active:scale-95 transition-all">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadPhoto.mutate({ file: f, isPolaroid: true });
                        }}
                      />
                      Add Polaroid Photo
                    </label>
                  </div>
                </motion.div>
              )}

              {/* NOTE composer panel */}
              {activeTab === "note" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pt-2 space-y-3"
                >
                  <div className="flex items-center gap-1.5 justify-center">
                    {PASTEL_COLORS.map((col) => (
                      <button
                        key={col}
                        onClick={() => setNoteColor(col)}
                        className={`h-5 w-5 rounded-full border transition-all ${
                          noteColor === col ? "ring-2 ring-primary ring-offset-1 scale-110" : "border-white/50"
                        }`}
                        style={{ background: col }}
                      />
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={100}
                      placeholder="Write message... (max 100 words)"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      className="flex-1 rounded-2xl border border-white/60 bg-white/40 px-4 py-2.5 text-xs text-foreground outline-none focus:border-primary transition-all"
                    />
                    <button
                      onClick={() => {
                        if (!noteText.trim()) return;
                        addItem.mutate({
                          page_id: activePage.id,
                          item_type: "text",
                          content: noteText.trim(),
                          image_url: null,
                          color: noteColor,
                          pos_x: 50,
                          pos_y: 45,
                          scale: 1,
                          rotation: 0
                        });
                        setNoteText("");
                        setActiveTab(null);
                      }}
                      className="rounded-2xl bg-primary text-white px-4 py-2 text-xs font-bold active:scale-95 transition-all"
                    >
                      Pin Note
                    </button>
                  </div>
                </motion.div>
              )}

              {/* RECENTLY added selector tray */}
              {activeTab === "recent" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pt-2 space-y-2.5 max-h-40 overflow-y-auto pr-1"
                >
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground/80 font-bold px-1">Recent Activities</div>
                  
                  {/* Notes / Photos */}
                  {recentNotes.length === 0 && recentStickers.length === 0 && (
                    <div className="text-[10px] text-muted-foreground italic p-2 text-center">No recent entries to import yet.</div>
                  )}

                  {recentNotes.map((note: any) => (
                    <button
                      key={note.id}
                      onClick={() => {
                        addItem.mutate({
                          page_id: activePage.id,
                          item_type: note.kind === "photo" ? "polaroid" : "text",
                          content: note.kind === "photo" ? null : note.body,
                          image_url: note.image_url,
                          color: note.color,
                          pos_x: 50,
                          pos_y: 45,
                          scale: 1,
                          rotation: note.rotation || 0
                        });
                        toast.success("Imported bulletin note!");
                      }}
                      className="w-full flex items-center justify-between gap-3 p-2 bg-white/40 hover:bg-white/60 border border-white/10 rounded-xl text-left text-xs transition-colors"
                    >
                      <div className="min-w-0 flex-1 truncate font-medium text-foreground/75">
                        {note.kind === "photo" ? "Polaroid photo note" : note.body}
                      </div>
                      <span className="shrink-0 text-[8px] bg-sky/50 px-2 py-0.5 rounded-full text-foreground/60 font-semibold uppercase">Import</span>
                    </button>
                  ))}

                  {/* Sticker board uploads */}
                  {recentStickers.map((st: any) => (
                    <button
                      key={st.id}
                      onClick={() => {
                        addItem.mutate({
                          page_id: activePage.id,
                          item_type: "picture",
                          content: null,
                          image_url: st.image_url,
                          color: null,
                          pos_x: 50,
                          pos_y: 45,
                          scale: 1,
                          rotation: st.rotation || 0
                        });
                        toast.success("Imported stickers upload!");
                      }}
                      className="w-full flex items-center justify-between gap-3 p-2 bg-white/40 hover:bg-white/60 border border-white/10 rounded-xl text-left text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <img src={st.image_url} alt="" className="h-6 w-6 object-contain rounded" />
                        <span className="truncate font-medium text-foreground/75">Stickers board upload</span>
                      </div>
                      <span className="shrink-0 text-[8px] bg-sky/50 px-2 py-0.5 rounded-full text-foreground/60 font-semibold uppercase">Import</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-32 relative select-none overflow-x-hidden">
      {!isOpen ? renderClosedBook() : renderOpenBook()}
      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
