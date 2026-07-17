import { useRef, useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/features/app/store";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, LayoutGrid, Eye, PlusCircle, Trash, Search, X } from "lucide-react";
import { Lightbox } from "@/lib/Lightbox";
import { useLongPress } from "@/hooks/useLongPress";
import { LongPressModal } from "@/components/ui/LongPressModal";

type StickerPage = {
  id: string;
  name: string;
  bg_theme: string;
  created_at: string;
};

type Sticker = {
  id: string;
  image_url: string;
  image_path: string;
  pos_x: number | null;
  pos_y: number | null;
  rotation: number | null;
  page_id: string | null;
  created_at: string;
};

const PAD_BACKGROUNDS = [
  {
    key: "white",
    label: "White",
    bgClass: "bg-[#ffffff] bg-[radial-gradient(#e5e7eb_1.5px,transparent_1.5px)] [background-size:16px_16px]",
    btnStyle: "bg-white border-slate-300",
  },
  {
    key: "blue",
    label: "Pastel Blue",
    bgClass: "bg-[#f0f7fc] bg-[radial-gradient(#d0e2f3_1.5px,transparent_1.5px)] [background-size:16px_16px]",
    btnStyle: "bg-[#f0f7fc] border-sky-300",
  },
  {
    key: "black",
    label: "Pastel Black",
    bgClass: "bg-[#181a1b] bg-[radial-gradient(#2d3134_1.5px,transparent_1.5px)] [background-size:16px_16px] text-white/90",
    btnStyle: "bg-[#181a1b] border-slate-700",
  },
  {
    key: "beige",
    label: "Pastel Beige",
    bgClass: "bg-[#faf6eb] bg-[radial-gradient(#e6dbca_1.5px,transparent_1.5px)] [background-size:16px_16px]",
    btnStyle: "bg-[#faf6eb] border-amber-200",
  },
];

export function StickersView({ relationshipId }: { relationshipId: string }) {
  const qc = useQueryClient();
  const { openSheet, confirm, setActiveStickerPageId, activeStickerPageId } = useAppStore();
  const boardRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [newPageOpen, setNewPageOpen] = useState(false);
  const [newPageName, setNewPageName] = useState("");
  const [showLongPressInfo, setShowLongPressInfo] = useState(false);
  const [showPageSearch, setShowPageSearch] = useState(false);
  const [pageSearchQuery, setPageSearchQuery] = useState("");
  const longPressProps = useLongPress({
    onLongPress: () => setShowLongPressInfo(true),
    onClick: () => openSheet("add-sticker")
  });

  useEffect(() => {
    const key = "intro-dismissed-stickers";
    const val = localStorage.getItem(key);
    if (!val) {
      setShowLongPressInfo(true);
      localStorage.setItem(key, "true");
    }
  }, []);

  // Fetch sticker book pages
  const { data: pages = [], refetch: refetchPages, isFetched, isLoading: loadingPages } = useQuery({
    queryKey: ["sticker-pages", relationshipId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sticker_pages")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as StickerPage[];
    },
  });

  // Fetch all stickers
  const { data: allStickers = [], isLoading: loadingStickers } = useQuery({
    queryKey: ["stickers", relationshipId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stickers")
        .select("id,image_url,image_path,pos_x,pos_y,rotation,page_id,created_at")
        .eq("relationship_id", relationshipId);
      if (error) throw error;
      return data as Sticker[];
    },
  });
  // Filter pages based on search query
  const filteredPages = useMemo(() => {
    if (!pageSearchQuery.trim()) {
      return pages.map((p, idx) => ({ ...p, originalIndex: idx }));
    }
    const q = pageSearchQuery.toLowerCase().trim();
    return pages
      .map((p, idx) => ({ ...p, originalIndex: idx }))
      .filter((p) => {
        const nameMatch = p.name ? p.name.toLowerCase().includes(q) : false;
        const indexMatch = String(idx + 1).includes(q);
        return nameMatch || indexMatch;
      });
  }, [pages, pageSearchQuery]);
  // Create a default page if none exist
  const createPage = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("sticker_pages").insert({
        relationship_id: relationshipId,
        name,
        bg_theme: "white",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchPages();
      toast.success("Page added to sticker book!");
      setNewPageName("");
      setNewPageOpen(false);
    },
    onError: (e: any) => toast.error(e?.message || "Failed to create page"),
  });

  const activePage = pages.find((p) => p.id === activePageId) || pages[0];
  const activeBg = PAD_BACKGROUNDS.find((b) => b.key === activePage?.bg_theme) || PAD_BACKGROUNDS[0];

  useEffect(() => {
    if (isFetched && pages.length === 0 && !createPage.isPending) {
      createPage.mutate("Main Page");
    }
  }, [pages, isFetched]);

  useEffect(() => {
    if (activePage?.id && activePage.id !== activeStickerPageId) {
      setActiveStickerPageId(activePage.id);
    }
  }, [activePage?.id, activeStickerPageId]);

  useEffect(() => {
    return () => {
      setActiveStickerPageId(null);
    };
  }, []);

  // Filter stickers belonging to the active page (fallback legacy stickers without page_id to first page)
  const pageStickers = allStickers.filter(
    (s) => s.page_id === activePage?.id || (!s.page_id && activePage?.id === pages[0]?.id)
  );

  // Update page background theme
  const updatePageBg = useMutation({
    mutationFn: async (bgKey: string) => {
      if (!activePage) return;
      const { error } = await supabase
        .from("sticker_pages")
        .update({ bg_theme: bgKey })
        .eq("id", activePage.id);
      if (error) throw error;
    },
    onSuccess: (_, bgKey) => {
      refetchPages();
      toast.success(`Page theme set to ${bgKey}`);
    },
    onError: (e: any) => toast.error("Failed to update page theme"),
  });

  // Update sticker coordinates
  const updatePosition = useMutation({
    mutationFn: async ({ id, pos_x, pos_y }: { id: string; pos_x: number; pos_y: number }) => {
      const { error } = await supabase.from("stickers").update({ pos_x, pos_y }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, pos_x, pos_y }) => {
      await qc.cancelQueries({ queryKey: ["stickers", relationshipId] });
      const previous = qc.getQueryData<Sticker[]>(["stickers", relationshipId]);
      qc.setQueryData<Sticker[]>(["stickers", relationshipId], (old) => {
        if (!old) return [];
        return old.map((s) => (s.id === id ? { ...s, pos_x, pos_y } : s));
      });
      return { previous };
    },
    onError: (e: any, vars, context) => {
      if (context?.previous) {
        qc.setQueryData(["stickers", relationshipId], context.previous);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stickers", relationshipId] });
    },
  });

  // Delete page
  const deletePage = useMutation({
    mutationFn: async (pageId: string) => {
      const { error } = await supabase.from("sticker_pages").delete().eq("id", pageId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Page removed from sticker book");
      setActivePageId(null);
      refetchPages();
      qc.invalidateQueries({ queryKey: ["stickers", relationshipId] });
    },
    onError: (e: any) => toast.error("Failed to delete page"),
  });

  // Delete sticker
  const deleteSticker = useMutation({
    mutationFn: async (s: Sticker) => {
      const { error } = await supabase.from("stickers").delete().eq("id", s.id);
      if (error) throw error;
      await supabase.storage.from("stickers").remove([s.image_path]);
    },
    onSuccess: () => {
      toast.success("Sticker removed");
      setSelectedStickerId(null);
      qc.invalidateQueries({ queryKey: ["stickers", relationshipId] });
    },
    onError: (e: any) => toast.error("Failed to delete sticker"),
  });

  const handleAddPageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPageName.trim()) {
      createPage.mutate(newPageName.trim());
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-140px)] w-full overflow-hidden flex flex-col select-none mx-auto max-w-md px-4 pt-6">
      
      {/* ── Sticker Book Pages Navigation (Floating Glass Pill Layout) ── */}
      <div className="rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-4 flex flex-col gap-2 shrink-0 z-20 relative">
        {showPageSearch && (
          <div className="flex items-center gap-1 border-b border-white/20 pb-2">
            <input
              type="text"
              value={pageSearchQuery}
              onChange={(e) => setPageSearchQuery(e.target.value)}
              placeholder="Search pages by name or number..."
              className="w-full font-sans text-[10px] rounded-full border border-white/50 bg-white/60 px-3 py-1.5 outline-none focus:ring-1 focus:ring-primary/40 text-foreground placeholder:text-muted-foreground/50"
              autoFocus
            />
            {pageSearchQuery && (
              <button
                onClick={() => setPageSearchQuery("")}
                className="p-1 text-muted-foreground hover:text-foreground shrink-0"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {/* Row 1: Tabs List */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 flex-1">
            {filteredPages.length === 0 ? (
              <span className="text-[10px] text-muted-foreground/60 italic px-1">No pages match search</span>
            ) : (
              filteredPages.map((p) => {
                const idx = p.originalIndex;
                const active = activePage?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActivePageId(p.id);
                      setSelectedStickerId(null);
                    }}
                    className={`relative px-3.5 py-1.5 text-[11px] font-semibold rounded-full border transition-all shrink-0 active:scale-95 ${
                      active
                        ? "bg-white text-primary border-white shadow-[0_2px_8px_-3px_rgba(0,0,0,0.1)] font-bold scale-105"
                        : "bg-white/40 text-foreground/60 border-transparent hover:bg-white/60 hover:text-foreground"
                    }`}
                  >
                    {p.name ? `${p.name} (${idx + 1})` : idx + 1}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Row 2: Page Tools */}
        {activePage && (
          <div className="flex items-center justify-between border-t border-white/10 pt-2 text-[10px]">
            <div className="flex items-center gap-2 text-foreground/55 font-medium">
              <span>Pad Color:</span>
              <div className="flex items-center gap-1.5">
                {PAD_BACKGROUNDS.map((b) => (
                  <button
                    key={b.key}
                    onClick={() => updatePageBg.mutate(b.key)}
                    className={`h-5 w-5 rounded-full border shadow-sm transition-all hover:scale-110 active:scale-95 ${
                      activePage.bg_theme === b.key
                        ? "ring-2 ring-primary ring-offset-1 scale-110"
                        : "border-white/50"
                    } ${b.btnStyle}`}
                    title={`Pad: ${b.label}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setShowPageSearch(!showPageSearch);
                  if (showPageSearch) setPageSearchQuery("");
                }}
                className={`p-1.5 rounded-full active:scale-95 transition-all ${showPageSearch ? "bg-white/60 text-primary" : "text-foreground/50 hover:text-foreground"}`}
                title="Search Page"
              >
                <Search size={14} />
              </button>
              <button
                onClick={() => setNewPageOpen(true)}
                className="p-1.5 rounded-full hover:bg-white/40 text-foreground/50 hover:text-foreground active:scale-95 transition-all"
                title="New Page"
              >
                <PlusCircle size={14} />
              </button>
              {pages.length > 1 && (
                <button
                  onClick={() => {
                    confirm({
                      title: "Delete page?",
                      message: `Are you sure you want to delete "${activePage.name}" and all stickers inside it?`,
                      onConfirm: () => deletePage.mutate(activePage.id),
                    });
                  }}
                  className="p-1.5 rounded-full hover:bg-red-50/50 text-red-500/80 hover:text-red-600 active:scale-95 transition-all"
                  title="Delete Page"
                >
                  <Trash size={13} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Center Sticker Sheet Container ── */}
      <div className="relative flex-1 w-full flex items-center justify-center py-4 bg-transparent select-none min-h-[500px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activePage?.id || "empty"}
            ref={sheetRef}
            initial={{ opacity: 0, scale: 0.94, rotate: -2, y: 15 }}
            animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, rotate: 2, y: -15 }}
            transition={{ type: "spring", damping: 20, stiffness: 130 }}
            className={`relative w-full aspect-[1/1.4] rounded-[32px] border border-white/60 overflow-hidden flex flex-col justify-between ${activeBg.bgClass}`}
            onClick={() => setSelectedStickerId(null)}
          >
            {loadingPages || loadingStickers ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center pointer-events-none animate-pulse">
                <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-2" />
                <div className="text-xs font-semibold text-foreground/50">Loading board...</div>
              </div>
            ) : pageStickers.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
                <div className="text-sm font-medium text-foreground/60">This page is empty.</div>
                <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                  Click the float button below to create and place a sticker!
                </p>
              </div>
            ) : (
              pageStickers.map((s) => {
                const px = s.pos_x ?? 50;
                const py = s.pos_y ?? 40;
                const rot = s.rotation ?? 0;
                const isSelected = selectedStickerId === s.id;

                return (
                  <motion.div
                    key={`${s.id}-${px.toFixed(3)}-${py.toFixed(3)}`}
                    drag
                    dragConstraints={sheetRef}
                    dragMomentum={false}
                    dragElastic={0}
                    onDragEnd={(event) => {
                      if (!sheetRef.current) return;
                      const sheet = sheetRef.current.getBoundingClientRect();
                      const el = event.target as HTMLElement;
                      const card = el.closest(".sticker-drag-target") as HTMLElement;
                      if (card) {
                        const rect = card.getBoundingClientRect();
                        let xPct = ((rect.left - sheet.left) / sheet.width) * 100;
                        let yPct = ((rect.top - sheet.top) / sheet.height) * 100;
                        
                        xPct = Math.max(0, Math.min(70, xPct));
                        yPct = Math.max(0, Math.min(80, yPct));
                        
                        updatePosition.mutate({ id: s.id, pos_x: xPct, pos_y: yPct });
                      }
                    }}
                    onDragStart={() => setSelectedStickerId(null)}
                    whileHover={{ scale: 1.03 }}
                    whileDrag={{ scale: 1.03, zIndex: 100 }}
                    className="sticker-drag-target absolute touch-none select-none"
                    style={{
                      left: `${px}%`,
                      top: `${py}%`,
                      zIndex: isSelected ? 50 : 10,
                    }}
                  >
                    <div 
                      className="relative p-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStickerId(isSelected ? null : s.id);
                      }}
                    >
                      {/* Sticker drawing */}
                      <img
                        src={s.image_url}
                        alt="Sticker"
                        className="h-24 w-24 object-contain drop-shadow-[0_5px_8px_rgba(0,0,0,0.18)] select-none pointer-events-none"
                        style={{ transform: `rotate(${rot}deg)` }}
                      />

                      {/* ── Selection Quick Actions Overlay (Tap Menu) ── */}
                      <AnimatePresence>
                        {isSelected && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: 10 }}
                            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 flex items-center gap-1.5 rounded-full border border-white/50 bg-white/80 backdrop-blur-md p-1 shadow-lg z-50 pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                setLightbox(s.image_url);
                                setSelectedStickerId(null);
                              }}
                              className="p-1.5 rounded-full hover:bg-white text-foreground/75 hover:text-foreground transition-all"
                              title="View large"
                            >
                              <Eye size={12} />
                            </button>
                            <button
                              onClick={() => {
                                confirm({
                                  title: "Delete sticker?",
                                  message: "Are you sure you want to permanently remove this sticker from your pad?",
                                  onConfirm: () => deleteSticker.mutate(s),
                                });
                              }}
                              className="p-1.5 rounded-full hover:bg-red-50 text-red-500 transition-all"
                              title="Delete sticker"
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
      </div>

      {/* ── Floating Add Sticker Button ── */}
      {activePage && (
        <>
          <button
            {...longPressProps}
            className="fixed bottom-24 right-5 z-40 flex items-center gap-2 rounded-full border border-white/50 bg-white/70 backdrop-blur-2xl px-5 py-3 text-sm shadow-[0_10px_30px_-10px_rgba(80,110,160,0.4)] hover:bg-white/80 active:scale-95 transition-all"
          >
            <Plus size={16} /> Add sticker
          </button>

          <LongPressModal
            isOpen={showLongPressInfo}
            onClose={() => setShowLongPressInfo(false)}
            title="Add Sticker"
            description="Tap to open our sticker drawer. You can select from dozens of cute emoji-like stickers and place them on your current sticker pad to decorate it."
          />
        </>
      )}

      {/* ── Add Page Modal (Glassmorphic) ── */}
      <AnimatePresence>
        {newPageOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNewPageOpen(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-[3px]"
            />
            <motion.form
              onSubmit={handleAddPageSubmit}
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 15 }}
              className="relative w-full max-w-[280px] rounded-3xl border border-white/50 bg-white/80 backdrop-blur-2xl p-5 shadow-2xl z-10 space-y-4"
            >
              <h3 className="display text-sm font-semibold text-foreground/80">New Sticker Sheet Name</h3>
              <input
                type="text"
                autoFocus
                placeholder="e.g. Doodles, Cute Cats"
                value={newPageName}
                onChange={(e) => setNewPageName(e.target.value)}
                className="w-full rounded-2xl border border-white/60 bg-white/40 px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary transition-all shadow-inner"
              />
              <div className="flex gap-2 text-xs font-semibold pt-1">
                <button
                  type="button"
                  onClick={() => setNewPageOpen(false)}
                  className="flex-1 py-2.5 rounded-full border border-white/60 bg-white/40 hover:bg-white/60 text-foreground/75 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newPageName.trim() || createPage.isPending}
                  className="flex-1 py-2.5 rounded-full bg-primary hover:bg-primary-hover text-white active:scale-95 transition-all shadow-md"
                >
                  Create
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
