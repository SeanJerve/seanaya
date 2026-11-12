import {
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  type ReactNode,
  type RefObject,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/features/app/store";
import { toast } from "sonner";
import { motion, AnimatePresence, useMotionValue } from "framer-motion";
import { Plus, Trash2, LayoutGrid, Eye, PlusCircle, Trash, Search, X } from "lucide-react";
import { Lightbox } from "@/lib/Lightbox";
import { useLongPress } from "@/hooks/useLongPress";
import { LongPressModal } from "@/components/ui/LongPressModal";
import { useUser } from "@/hooks/useUser";

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
    bgClass:
      "bg-[#ffffff] bg-[radial-gradient(#e5e7eb_1.5px,transparent_1.5px)] [background-size:16px_16px]",
    btnStyle: "bg-white border-slate-300",
  },
  {
    key: "blue",
    label: "Pastel Blue",
    bgClass:
      "bg-[#f0f7fc] bg-[radial-gradient(#d0e2f3_1.5px,transparent_1.5px)] [background-size:16px_16px]",
    btnStyle: "bg-[#f0f7fc] border-sky-300",
  },
  {
    key: "black",
    label: "Pastel Black",
    bgClass:
      "bg-[#181a1b] bg-[radial-gradient(#2d3134_1.5px,transparent_1.5px)] [background-size:16px_16px] text-white/90",
    btnStyle: "bg-[#181a1b] border-slate-700",
  },
  {
    key: "beige",
    label: "Pastel Beige",
    bgClass:
      "bg-[#faf6eb] bg-[radial-gradient(#e6dbca_1.5px,transparent_1.5px)] [background-size:16px_16px]",
    btnStyle: "bg-[#faf6eb] border-amber-200",
  },
];

// Rendered sticker box: h-24 w-24 image plus p-2 padding.
const STICKER_BOX = 112;

function DraggableSticker({
  px,
  py,
  isSelected,
  sheetRef,
  onDragStart,
  onMove,
  children,
}: {
  px: number;
  py: number;
  isSelected: boolean;
  sheetRef: RefObject<HTMLDivElement | null>;
  onDragStart: () => void;
  onMove: (x: number, y: number) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Once the new left/top has rendered, drop framer's leftover drag translate (before paint)
  // so the sticker doesn't move a second time.
  useLayoutEffect(() => {
    x.jump(0);
    y.jump(0);
  }, [px, py, x, y]);

  return (
    <motion.div
      ref={ref}
      drag
      dragConstraints={sheetRef}
      dragMomentum={false}
      dragElastic={0.1}
      onDragStart={onDragStart}
      onDragEnd={() => {
        const sheet = sheetRef.current;
        const el = ref.current;
        if (!sheet || !el) return;
        const sw = sheet.clientWidth;
        const sh = sheet.clientHeight;
        if (!sw || !sh) return;
        // offsetLeft/Top are the laid-out position (unaffected by scale transforms).
        const maxLeft = Math.max(0, sw - el.offsetWidth);
        const maxTop = Math.max(0, sh - el.offsetHeight);
        const left = Math.min(Math.max(el.offsetLeft + x.get(), 0), maxLeft);
        const top = Math.min(Math.max(el.offsetTop + y.get(), 0), maxTop);
        const xPct = (left / sw) * 100;
        const yPct = (top / sh) * 100;
        if (Math.abs(xPct - px) < 0.01 && Math.abs(yPct - py) < 0.01) {
          x.jump(0);
          y.jump(0);
          return;
        }
        onMove(xPct, yPct);
      }}
      whileHover={{ scale: 1.03 }}
      whileDrag={{ scale: 1.03, zIndex: 100 }}
      className="sticker-drag-target absolute touch-none select-none"
      style={{
        x,
        y,
        // Clamp so the whole sticker stays on the pad, however narrow the screen.
        left: `clamp(0px, ${px}%, calc(100% - ${STICKER_BOX}px))`,
        top: `clamp(0px, ${py}%, calc(100% - ${STICKER_BOX}px))`,
        zIndex: isSelected ? 50 : 10,
      }}
    >
      {children}
    </motion.div>
  );
}

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
    onClick: () => openSheet("add-sticker"),
  });

  useEffect(() => {
    const key = "intro-dismissed-stickers";
    const val = localStorage.getItem(key);
    if (!val) {
      localStorage.setItem(key, "true");
    }
  }, []);

  // Fetch sticker book pages
  const {
    data: pages = [],
    refetch: refetchPages,
    isFetched,
    isLoading: loadingPages,
  } = useQuery({
    queryKey: ["sticker-pages", relationshipId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sticker_pages")
        .select("*")
        .eq("relationship_id", relationshipId)
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
  const filteredPages = useMemo(() => {
    if (!pageSearchQuery.trim()) {
      return pages.map((p, idx) => ({ ...p, originalIndex: idx }));
    }
    const q = pageSearchQuery.toLowerCase().trim();
    return pages
      .map((p, idx) => ({ ...p, originalIndex: idx }))
      .filter((p) => {
        const nameMatch = p.name ? p.name.toLowerCase().includes(q) : false;
        const indexMatch = String(p.originalIndex + 1).includes(q);
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
  const activeBg =
    PAD_BACKGROUNDS.find((b) => b.key === activePage?.bg_theme) || PAD_BACKGROUNDS[0];

  // First visit: make one starting page. Only once, only when signed in, and quietly —
  // retrying on every render used to spam row-level-security errors.
  const { user } = useUser();
  const autoCreated = useRef(false);
  useEffect(() => {
    if (!isFetched || pages.length > 0 || autoCreated.current || !user || !relationshipId) return;
    autoCreated.current = true;
    supabase
      .from("sticker_pages")
      .insert({ relationship_id: relationshipId, name: "Main Page", bg_theme: "white" })
      .then(({ error }) => {
        if (!error) refetchPages();
        else console.warn("[stickers] could not create first page:", error.message);
      });
  }, [isFetched, pages.length, user, relationshipId, refetchPages]);

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
    (s) => s.page_id === activePage?.id || (!s.page_id && activePage?.id === pages[0]?.id),
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
    <div className="relative mx-auto flex min-h-[calc(100vh-140px)] w-full max-w-[640px] flex-col overflow-x-clip select-none px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+9rem)] sm:px-6 lg:max-w-[1186px] lg:flex-row lg:items-start lg:gap-8">
      {/* ── Sticker Book Pages Navigation (Floating Glass Pill Layout) ── */}
      <div className="sn-card relative z-20 flex shrink-0 flex-col gap-3 p-4 lg:w-[400px]">
        {showPageSearch && (
          <div className="flex items-center gap-2 border-b border-white/20 pb-3">
            <input
              type="text"
              value={pageSearchQuery}
              onChange={(e) => setPageSearchQuery(e.target.value)}
              placeholder="Search pages by name or number"
              aria-label="Search pages"
              className="h-10 w-full rounded-full border border-white/50 bg-white/60 px-4 font-sans text-[16px] text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-primary/40"
              autoFocus
            />
            {pageSearchQuery && (
              <button
                type="button"
                onClick={() => setPageSearchQuery("")}
                className="sn-pill sn-icon-btn h-10 w-10"
                title="Clear search"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {/* Row 1: Tabs List */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-1 items-center gap-2 overflow-x-auto scrollbar-none py-1">
            {filteredPages.length === 0 ? (
              <span className="px-1 text-[13px] italic text-muted-foreground">
                {pageSearchQuery.trim() ? "No pages match that" : "No pages yet"}
              </span>
            ) : (
              filteredPages.map((p) => {
                const idx = p.originalIndex;
                const active = activePage?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setActivePageId(p.id);
                      setSelectedStickerId(null);
                    }}
                    aria-pressed={active}
                    className={`sn-pill h-9 shrink-0 px-4 text-[13.5px] ${active ? "sn-active" : ""}`}
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
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-[13px]">
            <div className="flex items-center gap-2 font-medium text-foreground/60">
              <span>Pad colour</span>
              <div className="flex items-center gap-1.5">
                {PAD_BACKGROUNDS.map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => updatePageBg.mutate(b.key)}
                    className={`h-9 w-9 shrink-0 rounded-full border shadow-2xs transition-all active:scale-90 touch-manipulation ${
                      activePage.bg_theme === b.key
                        ? "ring-2 ring-primary ring-offset-1"
                        : "border-white/50"
                    } ${b.btnStyle}`}
                    title={`Pad: ${b.label}`}
                    aria-label={`Pad: ${b.label}`}
                    aria-pressed={activePage.bg_theme === b.key}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setShowPageSearch(!showPageSearch);
                  if (showPageSearch) setPageSearchQuery("");
                }}
                className={`sn-pill sn-icon-btn h-10 w-10 ${showPageSearch ? "sn-active" : ""}`}
                title="Search pages"
                aria-label="Search pages"
                aria-pressed={showPageSearch}
              >
                <Search size={16} />
              </button>
              <button
                type="button"
                onClick={() => setNewPageOpen(true)}
                className="sn-pill sn-icon-btn h-10 w-10"
                title="New page"
                aria-label="New page"
              >
                <PlusCircle size={16} />
              </button>
              {pages.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    confirm({
                      title: "Delete page?",
                      message: `Are you sure you want to delete "${activePage.name}" and all stickers inside it?`,
                      onConfirm: () => deletePage.mutate(activePage.id),
                    });
                  }}
                  className="sn-pill sn-icon-btn h-10 w-10"
                  title="Delete page"
                  aria-label="Delete page"
                >
                  <Trash size={16} className="!text-[#c2416c]" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Center Sticker Sheet Container ── */}
      <div className="relative flex min-h-[500px] w-full flex-1 select-none items-center justify-center bg-transparent py-4 lg:py-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activePage?.id || "empty"}
            ref={sheetRef}
            initial={{ opacity: 0, scale: 0.94, rotate: -2, y: 15 }}
            animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, rotate: 2, y: -15 }}
            transition={{ type: "spring", damping: 20, stiffness: 130 }}
            className={`relative w-full max-w-[520px] aspect-[1/1.4] rounded-[32px] border border-white/60 overflow-hidden flex flex-col justify-between ${activeBg.bgClass}`}
            onClick={() => setSelectedStickerId(null)}
          >
            {loadingPages || loadingStickers ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center pointer-events-none animate-pulse">
                <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-2" />
                <div className="text-xs font-semibold text-foreground/50">Loading board...</div>
              </div>
            ) : pageStickers.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
                <div className="font-serif text-[19px] font-semibold text-sn-navy">An empty page</div>
                <p className="mt-1 max-w-xs text-[14px] text-sn-ink">
                  {activePage ? "Add a sticker and drag it anywhere." : "It fills up as you add stickers."}
                </p>
              </div>
            ) : (
              pageStickers.map((s) => {
                const px = s.pos_x ?? 50;
                const py = s.pos_y ?? 40;
                const rot = s.rotation ?? 0;
                const isSelected = selectedStickerId === s.id;

                return (
                  <DraggableSticker
                    key={s.id}
                    px={px}
                    py={py}
                    isSelected={isSelected}
                    sheetRef={sheetRef}
                    onDragStart={() => setSelectedStickerId(null)}
                    onMove={(pos_x, pos_y) => updatePosition.mutate({ id: s.id, pos_x, pos_y })}
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
                              className="sn-pill sn-icon-btn h-10 w-10"
                              title="View large"
                              aria-label="View large"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => {
                                confirm({
                                  title: "Delete sticker?",
                                  message:
                                    "Are you sure you want to permanently remove this sticker from your pad?",
                                  onConfirm: () => deleteSticker.mutate(s),
                                });
                              }}
                              className="sn-pill sn-icon-btn h-10 w-10"
                              title="Delete sticker"
                              aria-label="Delete sticker"
                            >
                              <Trash2 size={16} className="!text-[#c2416c]" />
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </DraggableSticker>
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
            className="sn-fab-dock sn-pill h-12 px-5 text-[15px]"
          >
            <Plus size={16} /> Add sticker
          </button>

          <LongPressModal
            isOpen={showLongPressInfo}
            onClose={() => setShowLongPressInfo(false)}
            title="Add Sticker"
            description="Tap to open our sticker drawer. You can select from the custom stickers we've created and place them on your current sticker pad to decorate it."
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
              className="relative w-full max-w-[340px] sn-card p-5 shadow-2xl z-10 space-y-4"
            >
              <h3 className="font-serif text-[22px] font-semibold text-sn-navy">
                New sticker sheet
              </h3>
              <input
                type="text"
                autoFocus
                placeholder="e.g. Doodles, Cute Cats"
                value={newPageName}
                onChange={(e) => setNewPageName(e.target.value)}
                aria-label="Sticker sheet name"
                className="w-full rounded-[16px] border border-[#e1e4f5] bg-white/85 px-4 py-3 text-[16px] text-sn-navy placeholder:text-sn-faint outline-none focus:border-sn-periwinkle"
              />
              <div className="flex gap-2 text-xs font-semibold pt-1">
                <button
                  type="button"
                  onClick={() => setNewPageOpen(false)}
                  className="sn-ghost flex-1 h-11 text-[14.5px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newPageName.trim() || createPage.isPending}
                  className="sn-pill flex-1 h-11 text-[14.5px]"
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
