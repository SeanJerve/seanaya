import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, X, Trash2, BookHeart, Eye, ArrowLeft, Heart, Image as ImageIcon, Star, StickyNote, RefreshCw, ChevronLeft, ChevronRight, RotateCw, Pencil, Upload, Search } from "lucide-react";
import { useAppStore } from "@/features/app/store";
import { Lightbox } from "@/lib/Lightbox";
import { toast } from "sonner";
import { uploadImage } from "@/lib/storage";
import { motion, AnimatePresence } from "framer-motion";

type AlbumPage = {
  id: string;
  page_index: number;
  name: string | null;
};

type AlbumItem = {
  id: string;
  page_id: string;
  item_type: string; // 'sticker' | 'polaroid' | 'picture' | 'text'
  content: string | null;
  image_url: string | null;
  color: string | null; // used as "shape:outlineColor" for pictures, background color for text text
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
  { label: "Butter",   value: "oklch(0.95 0.07 90 / 0.85)" },
  { label: "Rose",     value: "oklch(0.94 0.06 5 / 0.85)" },
  { label: "Mint",     value: "oklch(0.94 0.06 160 / 0.85)" },
  { label: "Lavender", value: "oklch(0.93 0.06 290 / 0.85)" },
  { label: "Peach",    value: "oklch(0.94 0.07 55 / 0.85)" },
  { label: "Sky",      value: "oklch(0.94 0.05 230 / 0.85)" }
];

export function MemoriesView({ relationshipId }: { relationshipId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [showPageSearch, setShowPageSearch] = useState(false);
  const [pageSearchQuery, setPageSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"stickers" | "photos" | "note" | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteColor, setNoteColor] = useState(PASTEL_COLORS[0]);
  const [photoShape, setPhotoShape] = useState<"rect" | "square" | "circle" | "heart" | "star">("rect");
  const [photoOutline, setPhotoOutline] = useState("#ffffff");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  
  // Custom Photo preview & crop states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOffsetX, setPreviewOffsetX] = useState(0);
  const [previewOffsetY, setPreviewOffsetY] = useState(0);
  const [previewScale, setPreviewScale] = useState(1.2);
  const [isDraggingPreview, setIsDraggingPreview] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Custom rename states
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameNameText, setRenameNameText] = useState("");

  const pageRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const { confirm } = useAppStore();

  // Fetch album pages
  const { data: pages = [], refetch: refetchPages, isLoading: loadingPages } = useQuery({
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
        const indexMatch = String(p.page_index + 1).includes(q);
        return nameMatch || indexMatch;
      });
  }, [pages, pageSearchQuery]);

  // Fetch album items
  const { data: items = [], refetch: refetchItems, isLoading: loadingItems } = useQuery({
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
        .select("id,image_url,created_at")
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
        .limit(30);
      return data || [];
    }
  });

  // Filter 24-hours threshold helper
  const oneDayAgo = useMemo(() => new Date(Date.now() - 24 * 60 * 60 * 1000), []);

  const recentPolaroids = useMemo(() => {
    return recentNotes.filter((n: any) => n.kind === "photo" && n.image_url && new Date(n.created_at) > oneDayAgo);
  }, [recentNotes, oneDayAgo]);

  const recentTexts = useMemo(() => {
    return recentNotes.filter((n: any) => n.kind === "note" && n.body && n.body !== "(photo)" && new Date(n.created_at) > oneDayAgo);
  }, [recentNotes, oneDayAgo]);

  const recentStickers = useMemo(() => {
    return userStickers.filter((st: any) => new Date(st.created_at) > oneDayAgo);
  }, [userStickers, oneDayAgo]);

  const olderStickers = useMemo(() => {
    return userStickers.filter((st: any) => new Date(st.created_at) <= oneDayAgo);
  }, [userStickers, oneDayAgo]);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setSelectedFile(f);
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(f);
      setPreviewOffsetX(0);
      setPreviewOffsetY(0);
      setPreviewScale(1.2);
    }
  };

  // Preview interactive drag handlers
  const handlePreviewDragStart = (clientX: number, clientY: number) => {
    setIsDraggingPreview(true);
    dragStartRef.current = { x: clientX - previewOffsetX, y: clientY - previewOffsetY };
  };

  const handlePreviewDragMove = (clientX: number, clientY: number) => {
    if (!isDraggingPreview) return;
    setPreviewOffsetX(clientX - dragStartRef.current.x);
    setPreviewOffsetY(clientY - dragStartRef.current.y);
  };

  const handlePreviewDragEnd = () => {
    setIsDraggingPreview(false);
  };

  // Canvas shapes helpers for baking photo crop
  const drawHeart = (ctx: CanvasRenderingContext2D, w: number, h: number, ox: number, oy: number) => {
    ctx.moveTo(ox + w * 0.5, oy + h * 0.9);
    ctx.bezierCurveTo(ox + w * 0.05, oy + h * 0.6, ox, oy + h * 0.45, ox, oy + h * 0.3);
    ctx.bezierCurveTo(ox, oy + h * 0.15, ox + w * 0.1, oy, ox + w * 0.25, oy);
    ctx.bezierCurveTo(ox + w * 0.35, oy, ox + w * 0.45, oy + h * 0.1, ox + w * 0.5, oy + h * 0.2);
    ctx.bezierCurveTo(ox + w * 0.55, oy + h * 0.1, ox + w * 0.65, oy, ox + w * 0.75, oy);
    ctx.bezierCurveTo(ox + w * 0.9, oy, ox + w * 1.0, oy + h * 0.15, ox + w * 1.0, oy + h * 0.3);
    ctx.bezierCurveTo(ox + w * 1.0, oy + h * 0.45, ox + w * 0.95, oy + h * 0.6, ox + w * 0.5, oy + h * 0.9);
  };

  const drawStar = (ctx: CanvasRenderingContext2D, w: number, h: number, ox: number, oy: number) => {
    ctx.moveTo(ox + w * 0.5, oy);
    ctx.lineTo(ox + w * 0.65, oy + h * 0.35);
    ctx.lineTo(ox + w, oy + h * 0.35);
    ctx.lineTo(ox + w * 0.7, oy + h * 0.6);
    ctx.lineTo(ox + w * 0.85, oy + h);
    ctx.lineTo(ox + w * 0.5, oy + h * 0.75);
    ctx.lineTo(ox + w * 0.15, oy + h);
    ctx.lineTo(ox + w * 0.3, oy + h * 0.6);
    ctx.lineTo(ox, oy + h * 0.35);
    ctx.lineTo(ox + w * 0.35, oy + h * 0.35);
    ctx.closePath();
  };

  // Mutations
  const addPage = useMutation({
    mutationFn: async () => {
      const maxIdx = pages.reduce((max, p) => p.page_index > max ? p.page_index : max, -1);
      const { error } = await (supabase as any).from("album_pages").insert({
        relationship_id: relationshipId,
        page_index: maxIdx + 1,
        name: null
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

  const renamePage = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await (supabase as any)
        .from("album_pages")
        .update({ name })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchPages();
      toast.success("Page renamed!");
    }
  });

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activePage && renameNameText.trim()) {
      renamePage.mutate({ id: activePage.id, name: renameNameText.trim() });
      setRenameModalOpen(false);
    }
  };

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

  // Upload and bake canvas crop
  const uploadBakedPhoto = useMutation({
    mutationFn: async ({ file, shape, outline, scale, offsetX, offsetY }: { 
      file: File; 
      shape: "rect" | "square" | "circle" | "heart" | "star"; 
      outline: string;
      scale: number;
      offsetX: number;
      offsetY: number;
    }) => {
      const activePage = pages[currentPageIdx];
      if (!activePage) return;

      // 1. Create a helper image element
      const img = new Image();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      img.src = dataUrl;
      await new Promise((resolve) => { img.onload = resolve; });

      // 2. Setup canvas dimensions
      const canvas = document.createElement("canvas");
      const isRect = shape === "rect";
      const w = 400;
      const h = isRect ? 560 : 400;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas support failed");

      // 3. Clear canvas & trace path
      ctx.beginPath();
      if (shape === "circle") {
        ctx.arc(w / 2, h / 2, w / 2 - 8, 0, Math.PI * 2);
      } else if (shape === "heart") {
        drawHeart(ctx, w - 16, h - 16, 8, 8);
      } else if (shape === "star") {
        drawStar(ctx, w - 16, h - 16, 8, 8);
      } else {
        (ctx as any).roundRect(8, 8, w - 16, h - 16, 32);
      }
      ctx.closePath();

      // 4. Save and clip image drawing
      ctx.save();
      ctx.clip();

      const naturalAspect = img.naturalHeight / img.naturalWidth;
      const factor = w / 140; // Scale factor from 140px preview to 400px canvas coordinates
      const drawWidth = w * scale;
      const drawHeight = drawWidth * naturalAspect;
      const drawX = w / 2 + offsetX * factor - drawWidth / 2;
      const drawY = h / 2 + offsetY * factor - drawHeight / 2;

      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      ctx.restore();

      // 5. Draw border outline
      ctx.lineWidth = 12;
      ctx.strokeStyle = outline;
      ctx.stroke();

      // 6. Convert to blob and upload
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Crop render failed");

      const itemId = crypto.randomUUID();
      const croppedFile = new File([blob], `album_cropped_${itemId}.png`, { type: "image/png" });
      const { url } = await uploadImage("wall", relationshipId, croppedFile, `album/${itemId}`);

      await addItem.mutateAsync({
        page_id: activePage.id,
        item_type: "picture",
        content: null,
        image_url: url,
        color: `${shape}:${outline}`, // Store shape:outline for future edits if needed
        pos_x: 30,
        pos_y: 30,
        scale: 1,
        rotation: 0
      });


    },
    onSuccess: () => {
      toast.success("Picture added!");
      setSelectedFile(null);
      setPreviewUrl(null);
      setActiveTab(null);
    },
    onError: (e: any) => toast.error(e?.message || "Failed to add picture")
  });

  const activePage = pages[currentPageIdx];
  const activePageItems = useMemo(() => {
    if (!activePage) return [];
    return items.filter(it => it.page_id === activePage.id);
  }, [items, activePage]);

  // Render Closed Book Cover (Takes w-full, stretches to match customize panel, aspect 1/1.4)
  const renderClosedBook = () => (
    <div className="w-full h-[calc(100vh-140px)] overflow-hidden flex items-center justify-center p-4 bg-transparent relative z-10">
      {/* watercolor dream backdrops */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[10%] -left-20 w-80 h-80 rounded-full bg-pink-200/10 blur-[80px]" />
        <div className="absolute bottom-[20%] -right-20 w-96 h-96 rounded-full bg-blue-200/15 blur-[100px]" />
      </div>

      <motion.div
        whileHover={{ scale: 1.01, rotate: 0.5 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => setIsOpen(true)}
        className="w-full max-w-md aspect-[1/1.4] rounded-[32px] bg-gradient-to-br from-primary via-primary/95 to-sky border-[5px] border-white/70 shadow-[inset_0_2px_6px_rgba(255,255,255,0.7)] flex flex-col justify-between p-10 text-center cursor-pointer relative overflow-hidden group select-none z-10"
      >
        <div className="absolute inset-0 bg-white/5 opacity-10 group-hover:opacity-20 transition-opacity" />
        <div className="absolute left-3 top-0 bottom-0 w-[6px] bg-black/15 rounded-full" />
        
        <div className="flex-1 flex flex-col items-center justify-center gap-1 mt-8">
          <h2 className="display text-[42px] text-white font-extrabold tracking-wide leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)]">Sean</h2>
          <span className="text-2xl text-white/70 font-semibold italic drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.15)]">&</span>
          <h2 className="display text-[42px] text-white font-extrabold tracking-wide leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)]">Aya</h2>
        </div>
        
        <div className="mb-4">
          <span className="text-[11px] uppercase tracking-[0.25em] text-white/60 font-bold block animate-pulse">Tap to Open</span>
        </div>
      </motion.div>
    </div>
  );

  // Render Open Book Layout
  const renderOpenBook = () => {
    return (
      <div className="mx-auto max-w-md px-4 py-4 flex flex-col items-center select-none pb-32 w-full min-h-screen overflow-y-auto">
        {/* Floating Page navigation sub-header with HORIZONTALLY SCROLLABLE numbers list */}
        <div className="w-full rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-4 flex flex-col gap-2 shrink-0 z-20 mb-3">
          <div className="flex items-center justify-between w-full gap-2.5 overflow-hidden">
            {/* Arrow icon only back button */}
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-full bg-white/40 border border-white/30 text-foreground/65 hover:text-foreground active:scale-95 transition-all shadow-sm shrink-0 flex items-center justify-center"
              title="Go Back"
            >
              <ArrowLeft size={14} />
            </button>

            {/* center Page: 1 2 3 selector (Compact layout) */}
            <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden ml-1 relative">
              {showPageSearch ? (
                <div className="flex-1 flex items-center gap-1">
                  <input
                    type="text"
                    value={pageSearchQuery}
                    onChange={(e) => setPageSearchQuery(e.target.value)}
                    placeholder="Search page..."
                    className="w-full font-sans text-[10px] rounded-full border border-white/50 bg-white/60 px-3 py-1 outline-none focus:ring-1 focus:ring-primary/40 text-foreground placeholder:text-muted-foreground/50"
                    autoFocus
                  />
                  {pageSearchQuery && (
                    <button
                      onClick={() => setPageSearchQuery("")}
                      className="p-0.5 text-muted-foreground hover:text-foreground shrink-0"
                    >
                      <X size={10} />
                    </button>
                  )}
                  {/* Floating dropdown popup for search results */}
                  <div className="absolute top-[110%] left-0 right-0 z-50 rounded-2xl border border-white/50 bg-white/95 backdrop-blur-xl shadow-lg p-2 max-h-40 overflow-y-auto space-y-1">
                    {filteredPages.length === 0 ? (
                      <div className="text-[10px] text-muted-foreground text-center py-2">No matching pages</div>
                    ) : (
                      filteredPages.map((p) => {
                        const idx = p.originalIndex;
                        return (
                          <button
                            key={p.id}
                            onClick={() => {
                              setCurrentPageIdx(idx);
                              setSelectedItemId(null);
                              setPageSearchQuery("");
                              setShowPageSearch(false);
                            }}
                            className="w-full text-left px-3 py-1.5 rounded-xl hover:bg-black/5 text-[10px] font-bold text-foreground transition-colors flex items-center justify-between"
                          >
                            <span className="truncate">{p.name || `Page ${idx + 1}`}</span>
                            <span className="text-[9px] text-muted-foreground font-normal shrink-0">Page {idx + 1}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <span className="text-[10px] font-extrabold text-foreground/45 shrink-0 uppercase tracking-wider">Page:</span>
                  <div className="flex-1 overflow-x-auto scrollbar-none flex items-center gap-1 py-0.5">
                    {pages.map((p, idx) => {
                      const active = currentPageIdx === idx;
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            setCurrentPageIdx(idx);
                            setSelectedItemId(null);
                          }}
                          className={`h-6 w-6 flex items-center justify-center text-[10px] font-extrabold rounded-full border transition-all shrink-0 active:scale-95 ${
                            active
                              ? "bg-white text-primary border-primary/20 shadow-sm"
                              : "bg-white/40 text-foreground/50 border-transparent hover:bg-white/60"
                          }`}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Plus and Trash controls side-by-side on the right */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => {
                  setShowPageSearch(!showPageSearch);
                  if (showPageSearch) setPageSearchQuery("");
                }}
                className={`p-1 rounded-full active:scale-95 transition-all ${showPageSearch ? "bg-white/60 text-primary" : "text-foreground/60 hover:text-foreground"}`}
                title="Search Page"
              >
                <Search size={14} />
              </button>

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

        {/* Page renaming row under pages bar - Styled exactly like stickers page name */}
        {activePage && (
          <div className="w-full flex justify-start px-1 mb-1 shrink-0">
            <button
              onClick={() => {
                setRenameNameText(activePage.name || `Page ${currentPageIdx + 1}`);
                setRenameModalOpen(true);
              }}
              className="flex items-center gap-1.5 bg-white/40 px-3.5 py-1 rounded-full border border-white/30 text-xs font-bold text-foreground/75 active:scale-95 transition-all shadow-sm"
            >
              <span className="uppercase tracking-wider">
                {activePage.name || `Page ${currentPageIdx + 1}`}
              </span>
              <Pencil size={11} className="text-foreground/45" />
            </button>
          </div>
        )}

        {/* Paper Page layout (Stretches to w-full, matching customize panel exactly, aspect 1/1.4) */}
        <div className="relative w-full flex flex-col items-center py-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPageIdx}
              ref={pageRef}
              initial={{ opacity: 0, scale: 0.94, rotate: -1.5, y: 15 }}
              animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, rotate: 1.5, y: -15 }}
              transition={{ type: "spring", damping: 20, stiffness: 130 }}
              className="relative w-full aspect-[1/1.4] rounded-[32px] border border-white/50 bg-[#fafafa] overflow-hidden"
              onClick={() => setSelectedItemId(null)}
            >
              {/* Grid notebook texture */}
              <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1.5px,transparent_1.5px)] [background-size:16px_16px] pointer-events-none" />

              {loadingPages || loadingItems ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center pointer-events-none animate-pulse">
                  <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-2" />
                  <div className="text-xs font-semibold text-foreground/50">Loading page...</div>
                </div>
              ) : activePageItems.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center pointer-events-none">
                  <BookHeart size={32} className="text-foreground/20 mb-2" />
                  <div className="text-xs font-semibold text-foreground/50">This page is empty</div>
                  <p className="text-[10px] text-muted-foreground mt-1">Use Customize tools below to start decorating our space!</p>
                </div>
              ) : (
                activePageItems.map((it) => {
                  const isSelected = selectedItemId === it.id;
                  
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
                        zIndex: isSelected ? 50 : 10
                      }}
                    >
                      {/* DIV holding rotate transformation ONLY on the inner item content */}
                      <div
                        className="relative p-2 cursor-grab active:cursor-grabbing"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItemId(isSelected ? null : it.id);
                        }}
                      >
                        {/* 1. Stickers / User custom stickers */}
                        {it.item_type === "sticker" && (
                          <div 
                            className="select-none pointer-events-none drop-shadow-md"
                            style={{ transform: `rotate(${it.rotation}deg)` }}
                          >
                            {it.image_url ? (
                              <img src={it.image_url} alt="" className="h-20 w-20 object-contain" />
                            ) : (
                              <div className="text-5xl">{it.content}</div>
                            )}
                          </div>
                        )}

                        {/* 2. Plain Baked Cropped Picture */}
                        {it.item_type === "picture" && it.image_url && (
                          <div
                            className="select-none pointer-events-none drop-shadow-md"
                            style={{ transform: `rotate(${it.rotation}deg)` }}
                          >
                            <img src={it.image_url} alt="" className="w-28 object-contain" />
                          </div>
                        )}

                        {/* 3. Polaroid Frame */}
                        {it.item_type === "polaroid" && it.image_url && (
                          <div 
                            className="w-24 p-1.5 pb-5 rounded bg-white shadow-lg border border-black/5 flex flex-col items-center select-none pointer-events-none"
                            style={{ transform: `rotate(${it.rotation}deg)` }}
                          >
                            <div className="w-full aspect-square overflow-hidden bg-slate-50">
                              <img src={it.image_url} alt="" className="w-full h-full object-cover" />
                            </div>
                          </div>
                        )}

                        {/* 4. Text Note card */}
                        {it.item_type === "text" && (
                          <div
                            className="max-w-[130px] p-2.5 rounded-lg shadow-md border border-white/20 select-none pointer-events-none text-left"
                            style={{ 
                              background: it.color || PASTEL_COLORS[0],
                              transform: `rotate(${it.rotation}deg)`
                            }}
                          >
                            <p className="text-[10px] text-foreground/80 font-medium leading-tight whitespace-pre-wrap break-words">
                              {it.content}
                            </p>
                          </div>
                        )}

                        {/* Selection actions panel (Eye, Rotate, Trash) - STAYS PERFECTLY UPRIGHT AND STRAIGHT */}
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
                                onClick={() => {
                                  confirm({
                                    title: "Delete item?",
                                    message: "Are you sure you want to permanently remove this item from the page?",
                                    onConfirm: () => deleteItem.mutate(it.id),
                                  });
                                }}
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
        </div>

        {/* Customize Toolbar Area (Takes exactly w-full) */}
        {activePage && (
          <div className="w-full flex flex-col gap-3 rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-4 shadow-xl mt-4">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
              <span>Customize</span>
              {activeTab && (
                <button onClick={() => {
                  setActiveTab(null);
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }} className="p-0.5 hover:bg-black/5 rounded-full text-foreground/60 hover:text-foreground transition-colors animate-in spin-in-12 duration-200">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Icons list with consistent glass layout styles */}
            <div className="flex items-center justify-between gap-1.5 mt-1">
              <button
                onClick={() => {
                  setActiveTab(activeTab === "stickers" ? null : "stickers");
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
                className={`flex-1 py-2 rounded-2xl flex flex-col items-center gap-1 text-[10px] font-bold border transition-all ${
                  activeTab === "stickers"
                    ? "bg-white/70 border-white/60 text-primary shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.85),0_4px_12px_-3px_rgba(80,110,160,0.25)] backdrop-blur-md scale-[1.01]"
                    : "bg-white/35 border-white/20 text-foreground/60 hover:bg-white/50 backdrop-blur-sm"
                }`}
              >
                <Star size={14} />
                Decorate
              </button>
              <button
                onClick={() => {
                  setActiveTab(activeTab === "photos" ? null : "photos");
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
                className={`flex-1 py-2 rounded-2xl flex flex-col items-center gap-1 text-[10px] font-bold border transition-all ${
                  activeTab === "photos"
                    ? "bg-white/70 border-white/60 text-primary shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.85),0_4px_12px_-3px_rgba(80,110,160,0.25)] backdrop-blur-md scale-[1.01]"
                    : "bg-white/35 border-white/20 text-foreground/60 hover:bg-white/50 backdrop-blur-sm"
                }`}
              >
                <ImageIcon size={14} />
                Add Photo
              </button>
              <button
                onClick={() => {
                  setActiveTab(activeTab === "note" ? null : "note");
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
                className={`flex-1 py-2 rounded-2xl flex flex-col items-center gap-1 text-[10px] font-bold border transition-all ${
                  activeTab === "note"
                    ? "bg-white/70 border-white/60 text-primary shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.85),0_4px_12px_-3px_rgba(80,110,160,0.25)] backdrop-blur-md scale-[1.01]"
                    : "bg-white/35 border-white/20 text-foreground/60 hover:bg-white/50 backdrop-blur-sm"
                }`}
              >
                <StickyNote size={14} />
                Add Text
              </button>
            </div>

            {/* Dynamic tool panels */}
            <AnimatePresence mode="wait">
              {/* DECORATE Tab - USER OWN STICKERS ONLY */}
              {activeTab === "stickers" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pt-2 space-y-3"
                >
                  {/* Recently Added Stickers (Created in the last 24 hours) - Taxonomy tag outside */}
                  {recentStickers.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground/80 font-bold px-1">Recently Added Stickers:</div>
                      <div className="flex gap-3 overflow-x-auto scrollbar-none py-1">
                        {recentStickers.map((st: any) => (
                          <div key={st.id} className="flex flex-col items-center shrink-0 gap-1">
                            <button
                              onClick={() => {
                                addItem.mutate({
                                  page_id: activePage.id,
                                  item_type: "sticker",
                                  content: null,
                                  image_url: st.image_url,
                                  color: null,
                                  pos_x: 30,
                                  pos_y: 30,
                                  scale: 1,
                                  rotation: 0
                                });
                                toast.success("Sticker added!");
                              }}
                              className="w-14 h-14 p-1.5 rounded-2xl bg-white/40 border border-white/50 shrink-0 hover:scale-105 active:scale-95 transition-all overflow-hidden flex items-center justify-center relative shadow-sm"
                            >
                              <img src={st.image_url} alt="" className="max-h-full max-w-full object-contain pointer-events-none" />
                            </button>
                            <span className="text-[7.5px] uppercase tracking-wider text-muted-foreground/85 font-extrabold select-none pointer-events-none">Sticker</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* My Stickers (Older than 24 hours) */}
                  <div className="space-y-1.5 border-t border-white/10 pt-2.5">
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground/80 font-bold px-1">My Stickers:</div>
                    <div className="grid grid-cols-4 gap-3 p-1 max-h-44 overflow-y-auto">
                      {olderStickers.length === 0 && recentStickers.length === 0 ? (
                        <div className="col-span-4 text-[10px] text-muted-foreground italic text-center p-2">
                          No stickers created on the Stickers page yet. Go create some!
                        </div>
                      ) : olderStickers.length === 0 ? (
                        <div className="col-span-4 text-[10px] text-muted-foreground italic text-center p-2">
                          All stickers are listed under Recently Added.
                        </div>
                      ) : (
                        olderStickers.map((st: any) => (
                          <button
                            key={st.id}
                            onClick={() => {
                              addItem.mutate({
                                page_id: activePage.id,
                                item_type: "sticker",
                                content: null,
                                image_url: st.image_url,
                                color: null,
                                pos_x: 30,
                                pos_y: 30,
                                scale: 1,
                                rotation: 0
                              });
                              toast.success("Sticker added!");
                            }}
                            className="aspect-square p-1.5 rounded-2xl bg-white/40 border border-white/50 hover:bg-white/60 active:scale-95 transition-all overflow-hidden flex items-center justify-center shadow-sm"
                          >
                            <img src={st.image_url} alt="" className="max-h-full max-w-full object-contain pointer-events-none select-none" />
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* PHOTO options + shape selector + recent polaroids drawer + drag cropping preview system */}
              {activeTab === "photos" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pt-2 space-y-4"
                >
                  {/* Recent Polaroids list (added in last 24 hours) - Taxonomy tag outside */}
                  {recentPolaroids.length > 0 && !previewUrl && (
                    <div className="space-y-1.5">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold px-1">Recently Added Polaroids:</div>
                      <div className="flex gap-3 overflow-x-auto scrollbar-none py-1">
                        {recentPolaroids.map((p: any) => (
                          <div key={p.id} className="flex flex-col items-center shrink-0 gap-1">
                            <button
                              onClick={() => {
                                addItem.mutate({
                                  page_id: activePage.id,
                                  item_type: "polaroid",
                                  content: null,
                                  image_url: p.image_url,
                                  color: null,
                                  pos_x: 30,
                                  pos_y: 30,
                                  scale: 1,
                                  rotation: (Math.random() - 0.5) * 8
                                });
                                toast.success("Polaroid imported!");
                              }}
                              className="w-16 aspect-[3/4] p-1 pb-3 rounded bg-white shadow border border-black/5 hover:scale-105 active:scale-95 transition-all overflow-hidden relative"
                            >
                              <img src={p.image_url} alt="" className="w-full aspect-square object-cover rounded-sm pointer-events-none" />
                            </button>
                            <span className="text-[7.5px] uppercase tracking-wider text-muted-foreground/85 font-extrabold select-none pointer-events-none">Polaroid</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* LIVE Interactive Drag & Crop Preview */}
                  {previewUrl && (
                    <div className="flex flex-col items-center justify-center p-3 border border-white/50 bg-white/40 rounded-2xl gap-3 animate-in fade-in duration-200 w-full">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Preview (Drag inside to position):</div>
                      
                      {/* Live Crop and drag container */}
                      <div
                        className="relative overflow-hidden cursor-move select-none flex items-center justify-center border border-black/5 shadow-md"
                        style={{
                          width: photoShape === "rect" ? "140px" : "140px",
                          height: photoShape === "rect" ? "196px" : "140px",
                          borderRadius: photoShape === "circle" ? "50%" : photoShape === "square" || photoShape === "rect" ? "24px" : "0px",
                          clipPath: photoShape === "heart" ? "url(#heart-mask)" : photoShape === "star" ? "url(#star-mask)" : undefined,
                          background: photoOutline,
                          padding: "6px" // thickness of outline in preview
                        }}
                        onMouseDown={(e) => handlePreviewDragStart(e.clientX, e.clientY)}
                        onMouseMove={(e) => handlePreviewDragMove(e.clientX, e.clientY)}
                        onMouseUp={handlePreviewDragEnd}
                        onMouseLeave={handlePreviewDragEnd}
                        onTouchStart={(e) => e.touches[0] && handlePreviewDragStart(e.touches[0].clientX, e.touches[0].clientY)}
                        onTouchMove={(e) => e.touches[0] && handlePreviewDragMove(e.touches[0].clientX, e.touches[0].clientY)}
                        onTouchEnd={handlePreviewDragEnd}
                      >
                        <div
                          className="w-full h-full overflow-hidden pointer-events-none"
                          style={{
                            borderRadius: photoShape === "circle" ? "50%" : photoShape === "square" || photoShape === "rect" ? "18px" : "0px",
                            clipPath: photoShape === "heart" ? "url(#heart-mask)" : photoShape === "star" ? "url(#star-mask)" : undefined
                          }}
                        >
                          <img
                            id="preview-img-target"
                            src={previewUrl}
                            alt=""
                            className="max-w-none origin-center"
                            style={{
                              width: photoShape === "rect" ? "140px" : "140px",
                              transform: `translate(${previewOffsetX}px, ${previewOffsetY}px) scale(${previewScale})`
                            }}
                          />
                        </div>
                      </div>

                      {/* Zoom Slider */}
                      <div className="w-full space-y-1 px-2">
                        <div className="flex justify-between text-[9px] text-muted-foreground font-semibold">
                          <span>Zoom scale:</span>
                          <span>{previewScale.toFixed(1)}x</span>
                        </div>
                        <input
                          type="range"
                          min="0.8"
                          max="4"
                          step="0.05"
                          value={previewScale}
                          onChange={(e) => setPreviewScale(parseFloat(e.target.value))}
                          className="w-full h-1 bg-foreground/15 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                      </div>

                      {/* Add/Cancel buttons with premium glass styles */}
                      <div className="flex gap-2 w-full font-semibold text-xs pt-1">
                        <button
                          onClick={() => {
                            if (selectedFile) {
                              uploadBakedPhoto.mutate({ 
                                file: selectedFile, 
                                shape: photoShape, 
                                outline: photoOutline,
                                scale: previewScale,
                                offsetX: previewOffsetX,
                                offsetY: previewOffsetY
                              });
                            }
                          }}
                          disabled={uploadBakedPhoto.isPending}
                          className="flex-1 py-2 rounded-full bg-white/70 hover:bg-white/80 border border-white/60 text-primary active:scale-95 transition-all shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),0_4px_12px_-4px_rgba(80,110,160,0.2)] text-center font-bold backdrop-blur-md"
                        >
                          {uploadBakedPhoto.isPending ? "Adding..." : "Add Picture"}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedFile(null);
                            setPreviewUrl(null);
                          }}
                          className="flex-1 py-2 rounded-full border border-white/60 bg-white/40 hover:bg-white/60 text-foreground/75 text-center active:scale-95 transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Frame & Shape selections with glass styling */}
                  <div className="space-y-1.5 border-t border-white/10 pt-2.5">
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold px-1">Choose Frame:</div>
                    <div className="flex gap-1 flex-wrap">
                      {(["rect", "square", "circle", "heart", "star"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setPhotoShape(s)}
                          className={`px-3 py-1 rounded-full text-[9px] font-bold border transition-all ${
                            photoShape === s
                              ? "bg-white/75 border-white/60 text-primary shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_4px_10px_-3px_rgba(80,110,160,0.2)] backdrop-blur-md"
                              : "bg-white/35 border-white/20 text-foreground/60 hover:bg-white/50 backdrop-blur-sm"
                          }`}
                        >
                          {s.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Frame Border Color Selector - pastel choices matching choose background */}
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

                  {/* Choose File Widget */}
                  {!previewUrl && (
                    <div className="space-y-2">
                      <label
                        className="flex items-center justify-center gap-1.5 w-full py-3 text-center rounded-full border border-white/50 bg-white/70 hover:bg-white/80 backdrop-blur-2xl text-xs font-semibold text-foreground cursor-pointer active:scale-95 transition-all shadow-[0_8px_20px_-10px_rgba(80,110,160,0.25)]"
                      >
                        <Upload size={14} />
                        Upload photo
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                      </label>
                    </div>
                  )}
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
                  {/* Recent Texts list (added in last 24 hours) - Taxonomy tag outside */}
                  {recentTexts.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold px-1">Recently Added Texts:</div>
                      <div className="flex gap-3 overflow-x-auto scrollbar-none py-1">
                        {recentTexts.map((t: any) => (
                          <div key={t.id} className="flex flex-col items-center shrink-0 gap-1">
                            <button
                              onClick={() => {
                                addItem.mutate({
                                  page_id: activePage.id,
                                  item_type: "text",
                                  content: t.body,
                                  image_url: null,
                                  color: t.color || PASTEL_COLORS[0],
                                  pos_x: 30,
                                  pos_y: 30,
                                  scale: 1,
                                  rotation: 0
                                });
                                toast.success("Text imported!");
                              }}
                              className="w-24 h-16 p-2 rounded-xl bg-white/40 border border-white/50 hover:scale-105 active:scale-95 transition-all overflow-hidden text-left shadow-sm flex flex-col justify-between"
                            >
                              <p className="text-[10px] text-foreground/80 line-clamp-3 leading-snug whitespace-pre-wrap break-words">{t.body}</p>
                            </button>
                            <span className="text-[7.5px] uppercase tracking-wider text-muted-foreground/85 font-extrabold select-none pointer-events-none">Love Wall</span>
                          </div>
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
                          pos_x: 30,
                          pos_y: 30,
                          scale: 1,
                          rotation: 0
                        });
                        setNoteText("");
                        setActiveTab(null);
                      }}
                      className="rounded-2xl bg-white/70 hover:bg-white/80 border border-white/60 text-primary px-4 py-2 text-xs font-bold active:scale-95 transition-all shadow-[0_2px_8px_-3px_rgba(0,0,0,0.08)] backdrop-blur-md"
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

      {/* ── Rename Page Modal (Glassmorphic, styled exactly like StickersView) ── */}
      <AnimatePresence>
        {renameModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRenameModalOpen(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-[3px]"
            />
            <motion.form
              onSubmit={handleRenameSubmit}
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 15 }}
              className="relative w-full max-w-[280px] rounded-3xl border border-white/50 bg-white/80 backdrop-blur-2xl p-5 shadow-2xl z-10 space-y-4"
            >
              <h3 className="display text-sm font-semibold text-foreground/80">Rename Page Name</h3>
              <input
                type="text"
                autoFocus
                placeholder="e.g. Summer Vacation, My Love"
                value={renameNameText}
                onChange={(e) => setRenameNameText(e.target.value)}
                className="w-full rounded-2xl border border-white/60 bg-white/40 px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary transition-all shadow-inner"
              />
              <div className="flex gap-2 text-xs font-semibold pt-1">
                <button
                  type="button"
                  onClick={() => setRenameModalOpen(false)}
                  className="flex-1 py-2.5 rounded-full border border-white/60 bg-white/40 hover:bg-white/60 text-foreground/75 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!renameNameText.trim() || renamePage.isPending}
                  className="flex-1 py-2.5 rounded-full bg-primary hover:bg-primary-hover text-white active:scale-95 transition-all shadow-md"
                >
                  Save
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

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
