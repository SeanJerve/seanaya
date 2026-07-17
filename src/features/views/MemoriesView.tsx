import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, X, Trash2, BookHeart, Eye, ArrowLeft, Heart, Image as ImageIcon, Star, StickyNote, RefreshCw, ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
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
  color: string | null; // used as "shape:outlineColor" for pictures, background color for text notes
  pos_x: number;
  pos_y: number;
  scale: number;
  rotation: number;
};

const PASTEL_COLORS = [
  "oklch(0.95 0.07 90 / 0.85)",  // Butter
  "oklch(0.94 0.06 5 / 0.85)",   // Rose
  "oklch(0.94 0.06 160 / 0.85)", // Mint
  "oklch(0.93 0.06 290 / 0.85)", // Lavender
  "oklch(0.94 0.07 55 / 0.85)",  // Peach
  "oklch(0.94 0.05 230 / 0.85)", // Sky
];

const OUTLINE_COLORS = [
  { label: "White",    value: "#ffffff" },
  { label: "Rose",     value: "oklch(0.68 0.15 15)" },
  { label: "Gold",     value: "oklch(0.78 0.15 85)" },
  { label: "Mint",     value: "oklch(0.78 0.14 165)" },
  { label: "Lavender", value: "oklch(0.72 0.13 295)" },
  { label: "Dark",     value: "oklch(0.2 0.02 20)" }
];

export function MemoriesView({ relationshipId }: { relationshipId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<"stickers" | "photos" | "note" | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteColor, setNoteColor] = useState(PASTEL_COLORS[0]);
  const [photoShape, setPhotoShape] = useState<"rect" | "square" | "circle" | "heart" | "star">("rect");
  const [photoOutline, setPhotoOutline] = useState("#ffffff");
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

  // Fetch user created stickers from stickers board
  const { data: userStickers = [] } = useQuery({
    queryKey: ["album-user-stickers", relationshipId],
    queryFn: async () => {
      const { data } = await supabase
        .from("stickers")
        .select("id,image_url")
        .eq("relationship_id", relationshipId)
        .order("created_at", { ascending: false });
      return data || [];
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
        .limit(20);
      return data || [];
    }
  });

  // Filter recent polaroids and recent texts from Love Wall notes list
  const recentPolaroids = useMemo(() => {
    return recentNotes.filter((n: any) => n.kind === "photo" && n.image_url);
  }, [recentNotes]);

  const recentTexts = useMemo(() => {
    return recentNotes.filter((n: any) => n.kind === "note" && n.body && n.body !== "(photo)");
  }, [recentNotes]);

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

  const updateItemRotation = useMutation({
    mutationFn: async ({ id, rotation }: { id: string; rotation: number }) => {
      const { error } = await (supabase as any).from("album_items").update({ rotation }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, rotation }) => {
      await qc.cancelQueries({ queryKey: ["album-items", relationshipId] });
      const previous = qc.getQueryData<AlbumItem[]>(["album-items", relationshipId]);
      qc.setQueryData<AlbumItem[]>(["album-items", relationshipId], (old) => {
        if (!old) return [];
        return old.map((it) => (it.id === id ? { ...it, rotation } : it));
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
    mutationFn: async ({ file, shape, outline }: { file: File; shape: "rect" | "square" | "circle" | "heart" | "star"; outline: string }) => {
      const itemId = crypto.randomUUID();
      const { url } = await uploadImage("wall", relationshipId, file, `album/${itemId}`);
      const activePage = pages[currentPageIdx];
      if (!activePage) return;

      await addItem.mutateAsync({
        page_id: activePage.id,
        item_type: "picture",
        content: null,
        image_url: url,
        color: `${shape}:${outline}`, // Save shape and outline color separated by colon
        pos_x: 35,
        pos_y: 35,
        scale: 1,
        rotation: 0
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

  // Render Closed Book Cover (Bigger aspect, fits full width of navbar, no scroll, stacked name letters)
  const renderClosedBook = () => (
    <div className="w-full h-[calc(100vh-140px)] overflow-hidden flex flex-col items-center justify-center p-4 bg-transparent relative z-10">
      {/* watercolor dream backdrops */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[10%] -left-20 w-80 h-80 rounded-full bg-pink-200/10 blur-[80px]" />
        <div className="absolute bottom-[20%] -right-20 w-96 h-96 rounded-full bg-blue-200/15 blur-[100px]" />
      </div>

      <motion.div
        whileHover={{ scale: 1.01, rotate: 0.5 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => setIsOpen(true)}
        className="w-full max-w-[340px] h-[520px] rounded-[36px] bg-gradient-to-br from-primary via-primary/95 to-sky border-[5px] border-white/70 shadow-[0_30px_70px_-15px_rgba(80,110,160,0.6),inset_0_2px_6px_rgba(255,255,255,0.7)] flex flex-col justify-between p-10 text-center cursor-pointer relative overflow-hidden group select-none z-10"
      >
        <div className="absolute inset-0 bg-white/5 opacity-10 group-hover:opacity-20 transition-opacity" />
        <div className="absolute left-3 top-0 bottom-0 w-[6px] bg-black/15 rounded-full" />
        
        <div className="flex-1 flex flex-col items-center justify-center gap-1 mt-8">
          <h2 className="display text-[44px] text-white font-extrabold tracking-wide leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)]">Sean</h2>
          <span className="text-3xl text-white/70 font-semibold italic drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.15)]">&</span>
          <h2 className="display text-[44px] text-white font-extrabold tracking-wide leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)]">Aya</h2>
        </div>
        
        <div className="mb-4">
          <span className="text-[11px] uppercase tracking-[0.25em] text-white/60 font-bold block animate-pulse">Tap to Open</span>
        </div>
      </motion.div>
    </div>
  );

  // Helper classes for picture item shapes
  const getPictureShapeStyles = (shape: string | null) => {
    if (shape === "heart") {
      return { clipPath: "url(#heart-mask)" };
    }
    if (shape === "star") {
      return { clipPath: "url(#star-mask)" };
    }
    return {};
  };

  const getBorderRadiusClass = (shape: string | null) => {
    if (shape === "circle") return "rounded-full";
    if (shape === "square" || shape === "rect") return "rounded-2xl";
    return "";
  };

  // Render Open Book Layout
  const renderOpenBook = () => {
    return (
      <div className="mx-auto max-w-md px-4 py-4 flex flex-col items-center select-none pb-32 w-full">
        {/* Floating Page navigation sub-header under main app header */}
        <div className="w-full rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-4 shadow-md flex flex-col gap-2 shrink-0 z-20 mb-5">
          <div className="flex items-center justify-between gap-2.5">
            <button
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-1 text-[11px] text-foreground/60 hover:text-foreground font-bold shrink-0"
            >
              <ArrowLeft size={13} /> Close
            </button>

            {/* horizontal page list */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1 flex-1 max-w-[190px]">
              {pages.map((p, idx) => {
                const active = currentPageIdx === idx;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setCurrentPageIdx(idx);
                      setSelectedItemId(null);
                    }}
                    className={`px-3 py-1.5 text-[10px] font-extrabold rounded-full border transition-all shrink-0 active:scale-95 ${
                      active
                        ? "bg-white text-primary border-primary/20 shadow-sm"
                        : "bg-white/40 text-foreground/50 border-transparent hover:bg-white/60"
                    }`}
                  >
                    Page {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Plus and Trash controls side-by-side */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => addPage.mutate()}
                className="p-1 rounded-full hover:bg-white/60 text-foreground/60 hover:text-foreground active:scale-95 transition-all"
                title="Add Page"
              >
                <Plus size={14} />
              </button>

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
                  className="p-1 rounded-full hover:bg-red-50 text-red-500 active:scale-95 transition-all"
                  title="Delete Page"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Paper Page layout (Full width, matching customize panel width) */}
        <div className="relative w-full flex flex-col items-center p-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPageIdx}
              ref={pageRef}
              initial={{ opacity: 0, scale: 0.94, rotate: -1.5, y: 15 }}
              animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, rotate: 1.5, y: -15 }}
              transition={{ type: "spring", damping: 20, stiffness: 130 }}
              className="relative w-full aspect-[1/1.25] rounded-3xl border border-white/50 bg-[#fafafa] shadow-2xl overflow-hidden"
              onClick={() => setSelectedItemId(null)}
            >
              {/* Grid notebook texture */}
              <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1.5px,transparent_1.5px)] [background-size:16px_16px] pointer-events-none" />

              {activePageItems.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center pointer-events-none">
                  <BookHeart size={32} className="text-foreground/20 mb-2" />
                  <div className="text-xs font-semibold text-foreground/50">This page is empty</div>
                  <p className="text-[10px] text-muted-foreground mt-1">Use Customize tools below to start decorating our space!</p>
                </div>
              ) : (
                activePageItems.map((it) => {
                  const isSelected = selectedItemId === it.id;
                  const [shape, outlineColor] = (it.color || "rect:#ffffff").split(":");
                  
                  return (
                    <motion.div
                      key={`${it.id}-${it.pos_x.toFixed(3)}-${it.pos_y.toFixed(3)}`}
                      drag
                      dragConstraints={pageRef}
                      dragMomentum={false}
                      dragElastic={0}
                      onDragEnd={(event) => {
                        if (!pageRef.current) return;
                        const page = pageRef.current.getBoundingClientRect();
                        const el = event.target as HTMLElement;
                        const card = el.closest(".album-item-drag-target") as HTMLElement;
                        if (card) {
                          const rect = card.getBoundingClientRect();
                          let xPct = ((rect.left - page.left) / page.width) * 100;
                          let yPct = ((rect.top - page.top) / page.height) * 100;
                          
                          // constrain bounds so items stay within book sheet
                          xPct = Math.max(0, Math.min(68, xPct));
                          yPct = Math.max(0, Math.min(80, yPct));
                          updateItemPosition.mutate({
                            id: it.id,
                            pos_x: xPct,
                            pos_y: yPct
                          });
                        }
                      }}
                      onDragStart={() => setSelectedItemId(null)}
                      whileDrag={{ scale: 1.05, zIndex: 100 }}
                      className="album-item-drag-target absolute touch-none select-none"
                      style={{
                        left: `${it.pos_x}%`,
                        top: `${it.pos_y}%`,
                        rotate: it.rotation,
                        zIndex: isSelected ? 50 : 10
                      }}
                    >
                      <div
                        className="relative p-2 cursor-grab active:cursor-grabbing"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItemId(isSelected ? null : it.id);
                        }}
                      >
                        {/* 1. Stickers / Preset & User custom stickers */}
                        {it.item_type === "sticker" && (
                          <div className="select-none pointer-events-none drop-shadow-md">
                            {it.image_url ? (
                              <img src={it.image_url} alt="" className="h-20 w-20 object-contain" />
                            ) : (
                              <div className="text-5xl">{it.content}</div>
                            )}
                          </div>
                        )}

                        {/* 2. Plain Picture (cropped shapes support + thin outlines) */}
                        {it.item_type === "picture" && it.image_url && (
                          <div
                            className={`flex items-center justify-center overflow-hidden border border-black/5 shadow-md select-none pointer-events-none ${getBorderRadiusClass(shape)}`}
                            style={{
                              width: shape === "rect" ? "114px" : "100px",
                              height: "100px",
                              ...getPictureShapeStyles(shape),
                              background: outlineColor || "#ffffff"
                            }}
                          >
                            <div
                              className={`overflow-hidden ${getBorderRadiusClass(shape)}`}
                              style={{
                                width: shape === "rect" ? "110px" : "96px",
                                height: "96px",
                                ...getPictureShapeStyles(shape),
                              }}
                            >
                              <img src={it.image_url} alt="" className="w-full h-full object-cover" />
                            </div>
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

                        {/* Selection actions panel (Eye, Rotate, Trash) */}
                        <AnimatePresence>
                          {isSelected && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 flex items-center gap-1.5 bg-white/95 border border-white/40 rounded-full shadow-lg p-1 z-50 pointer-events-auto"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {(it.item_type === "polaroid" || it.item_type === "picture" || (it.item_type === "sticker" && it.image_url)) && it.image_url && (
                                <button
                                  onClick={() => {
                                    setLightbox(it.image_url);
                                    setSelectedItemId(null);
                                  }}
                                  className="p-1 rounded-full hover:bg-black/5 text-foreground/70"
                                  title="View Photo"
                                >
                                  <Eye size={12} />
                                </button>
                              )}
                              
                              {/* Rotate adjust button */}
                              <button
                                onClick={() => {
                                  const nextRot = (it.rotation + 15) % 360;
                                  updateItemRotation.mutate({ id: it.id, rotation: nextRot });
                                }}
                                className="p-1 rounded-full hover:bg-black/5 text-foreground/70"
                                title="Rotate"
                              >
                                <RotateCw size={12} />
                              </button>

                              <button
                                onClick={() => deleteItem.mutate(it.id)}
                                className="p-1 rounded-full hover:bg-red-50 text-red-500"
                                title="Delete"
                              >
                                <Trash2 size={12} />
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

          {/* Page Counter Navigation (glass layout at bottom right) */}
          <div className="w-full flex justify-end mt-2 mb-4 px-1">
            <div className="flex items-center gap-1 bg-white/40 border border-white/50 backdrop-blur-md rounded-full px-2 py-0.5 text-[10px] font-bold text-foreground/80 shadow-sm shrink-0 select-none">
              <button
                onClick={() => {
                  setCurrentPageIdx(p => Math.max(0, p - 1));
                  setSelectedItemId(null);
                }}
                disabled={currentPageIdx === 0}
                className="p-1 hover:bg-black/5 rounded-full disabled:opacity-30"
              >
                <ChevronLeft size={10} />
              </button>
              <span className="px-1.5">page {currentPageIdx + 1}</span>
              <button
                onClick={() => {
                  setCurrentPageIdx(p => Math.min(pages.length - 1, p + 1));
                  setSelectedItemId(null);
                }}
                disabled={currentPageIdx >= pages.length - 1}
                className="p-1 hover:bg-black/5 rounded-full disabled:opacity-30"
              >
                <ChevronRight size={10} />
              </button>
            </div>
          </div>
        </div>

        {/* Customize Toolbar Area */}
        {activePage && (
          <div className="w-full flex flex-col gap-3 rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-4 shadow-xl">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
              <span>Customize</span>
              {activeTab && (
                <button onClick={() => setActiveTab(null)} className="p-0.5 hover:bg-black/5 rounded-full text-foreground/60 hover:text-foreground transition-colors">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Icons list (Star for decorate, Add Text note changes) */}
            <div className="flex items-center justify-between gap-1.5 mt-1">
              <button
                onClick={() => setActiveTab(activeTab === "stickers" ? null : "stickers")}
                className={`flex-1 py-2 rounded-2xl flex flex-col items-center gap-1 text-[10px] font-bold border transition-all ${
                  activeTab === "stickers" ? "bg-primary border-primary text-white" : "bg-white/40 border-white/20 text-foreground/60 hover:bg-white/60"
                }`}
              >
                <Star size={14} />
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
                Add Text
              </button>
            </div>

            {/* Dynamic tool panels (recently added items displayed inside at the first section) */}
            <AnimatePresence mode="wait">
              {/* DECORATE Tab */}
              {activeTab === "stickers" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pt-2 space-y-3"
                >
                  {/* Recently Pinned custom user stickers */}
                  {userStickers.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground/80 font-bold px-1">Recently Pinned Stickers:</div>
                      <div className="flex gap-2 overflow-x-auto scrollbar-none py-1">
                        {userStickers.slice(0, 8).map((st: any) => (
                          <button
                            key={st.id}
                            onClick={() => {
                              addItem.mutate({
                                page_id: activePage.id,
                                item_type: "sticker",
                                content: null,
                                image_url: st.image_url,
                                color: null,
                                pos_x: 35,
                                pos_y: 35,
                                scale: 1,
                                rotation: 0
                              });
                              toast.success("Sticker added!");
                            }}
                            className="w-14 h-14 p-1.5 rounded-2xl bg-white/40 border border-white/50 shrink-0 hover:scale-105 active:scale-95 transition-all overflow-hidden flex items-center justify-center relative shadow-sm"
                          >
                            <img src={st.image_url} alt="" className="max-h-full max-w-full object-contain pointer-events-none" />
                            <span className="absolute bottom-0.5 right-0.5 text-[5px] bg-sky/60 px-1 rounded text-foreground/80 font-extrabold select-none pointer-events-none">Sticker</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Standard Sticker presets */}
                  <div className="space-y-1.5 border-t border-white/10 pt-2.5">
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground/80 font-bold px-1">Sticker Presets:</div>
                    <div className="grid grid-cols-8 gap-2.5 p-1 max-h-24 overflow-y-auto">
                      {["💝", "💖", "💕", "🌸", "🌷", "🐱", "🐾", "✨", "🧸", "🎈", "🍫", "🍩", "💌", "🏡", "⭐", "🎉"].map((st) => (
                        <button
                          key={st}
                          onClick={() => {
                            addItem.mutate({
                              page_id: activePage.id,
                              item_type: "sticker",
                              content: st,
                              image_url: null,
                              color: null,
                              pos_x: 35,
                              pos_y: 35,
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
                  </div>
                </motion.div>
              )}

              {/* PHOTO upload options + shape selector + recent polaroids drawer */}
              {activeTab === "photos" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pt-2 space-y-4"
                >
                  {/* Recent Polaroids selector displayed at the very top */}
                  {recentPolaroids.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold px-1">Recently Added Polaroids:</div>
                      <div className="flex gap-2 overflow-x-auto scrollbar-none py-1">
                        {recentPolaroids.slice(0, 8).map((p: any) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              addItem.mutate({
                                page_id: activePage.id,
                                item_type: "polaroid",
                                content: null,
                                image_url: p.image_url,
                                color: null,
                                pos_x: 35,
                                pos_y: 35,
                                scale: 1,
                                rotation: (Math.random() - 0.5) * 8
                              });
                              toast.success("Polaroid imported!");
                            }}
                            className="w-16 aspect-[3/4] p-1 pb-3 rounded bg-white shadow border border-black/5 shrink-0 hover:scale-105 active:scale-95 transition-all overflow-hidden relative"
                          >
                            <img src={p.image_url} alt="" className="w-full aspect-square object-cover rounded-sm pointer-events-none" />
                            <span className="absolute bottom-0.5 right-0.5 text-[5px] bg-rose/60 px-1 rounded text-foreground/80 font-extrabold select-none pointer-events-none">Polaroid</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Frame Selector */}
                  <div className="space-y-1.5 border-t border-white/10 pt-2.5">
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold px-1">Choose Frame:</div>
                    <div className="flex gap-1 flex-wrap">
                      {(["rect", "square", "circle", "heart", "star"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setPhotoShape(s)}
                          className={`px-3 py-1 rounded-full text-[9px] font-bold border transition-all ${
                            photoShape === s
                              ? "bg-primary border-primary text-white"
                              : "bg-white/50 border-white/30 text-foreground/60 hover:bg-white/70"
                          }`}
                        >
                          {s.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Frame Border Color Selector */}
                  <div className="space-y-1.5">
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold px-1">Frame Outline Color:</div>
                    <div className="flex gap-1.5">
                      {OUTLINE_COLORS.map((oc) => (
                        <button
                          key={oc.value}
                          onClick={() => setPhotoOutline(oc.value)}
                          className={`h-5 w-5 rounded-full border transition-all hover:scale-110 active:scale-95 ${
                            photoOutline === oc.value ? "ring-2 ring-primary ring-offset-1 scale-110" : "border-white/50"
                          }`}
                          style={{ background: oc.value }}
                          title={oc.label}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Upload Actions */}
                  <div className="space-y-2">
                    <label className="block w-full py-2.5 text-center rounded-2xl border border-white/60 bg-white/40 hover:bg-white/60 text-[11px] font-bold cursor-pointer active:scale-95 transition-all shadow-sm">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadPhoto.mutate({ file: f, shape: photoShape, outline: photoOutline });
                        }}
                      />
                      Upload & Add Picture
                    </label>
                  </div>
                </motion.div>
              )}

              {/* TEXT Composer Panel */}
              {activeTab === "note" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pt-2 space-y-4"
                >
                  {/* Recent Texts list displayed at the very top */}
                  {recentTexts.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold px-1">Recently Added Texts:</div>
                      <div className="flex gap-2 overflow-x-auto scrollbar-none py-1">
                        {recentTexts.slice(0, 8).map((t: any) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              addItem.mutate({
                                page_id: activePage.id,
                                item_type: "text",
                                content: t.body,
                                image_url: null,
                                color: t.color || PASTEL_COLORS[0],
                                pos_x: 35,
                                pos_y: 35,
                                scale: 1,
                                rotation: 0
                              });
                              toast.success("Text imported!");
                            }}
                            className="w-24 p-2 rounded-xl bg-white/40 border border-white/50 shrink-0 hover:scale-105 active:scale-95 transition-all overflow-hidden relative text-left"
                          >
                            <p className="text-[8px] text-foreground/80 line-clamp-3 leading-tight">{t.body}</p>
                            <span className="absolute bottom-0.5 right-0.5 text-[5px] bg-mint/60 px-1 rounded text-foreground/80 font-extrabold select-none pointer-events-none">Love Wall</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pastel Colors picker */}
                  <div className="space-y-1.5 border-t border-white/10 pt-2.5">
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold px-1">Choose Background:</div>
                    <div className="flex items-center gap-1.5">
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
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={100}
                      placeholder="Write text note... (max 100 words)"
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
                          pos_x: 35,
                          pos_y: 35,
                          scale: 1,
                          rotation: 0
                        });
                        setNoteText("");
                        setActiveTab(null);
                      }}
                      className="rounded-2xl bg-primary text-white px-4 py-2 text-xs font-bold active:scale-95 transition-all"
                    >
                      Pin Text
                    </button>
                  </div>
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

      {/* SVG Masks for heart/star crop picture masks */}
      <svg className="absolute w-0 h-0 pointer-events-none">
        <defs>
          <clipPath id="heart-mask" clipPathUnits="objectBoundingBox">
            <path d="M 0.5 0.9 C 0.05 0.6, 0 0.45, 0 0.3 C 0 0.15, 0.1 0, 0.25 0 C 0.35 0, 0.45 0.1, 0.5 0.2 C 0.55 0.1, 0.65 0, 0.75 0 C 0.9 0, 1 0.15, 1 0.3 C 1 0.45, 0.95 0.6, 0.5 0.9 Z" />
          </clipPath>
          <clipPath id="star-mask" clipPathUnits="objectBoundingBox">
            <path d="M 0.5 0 L 0.65 0.35 L 1 0.35 L 0.7 0.6 L 0.85 1 L 0.5 0.75 L 0.15 1 L 0.3 0.6 L 0 0.35 L 0.35 0.35 Z" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}
