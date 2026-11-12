import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus,
  X,
  Trash2,
  BookHeart,
  Eye,
  ArrowLeft,
  Heart,
  Image as ImageIcon,
  Star,
  StickyNote,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Pencil,
  Upload,
  Search,
  HelpCircle,
  Camera,
} from "lucide-react";
import { useAppStore } from "@/features/app/store";
import { useCoupleNames } from "@/hooks/useCouple";
import { Lightbox } from "@/lib/Lightbox";
import { toast } from "sonner";
import { uploadImage } from "@/lib/storage";
import { motion, AnimatePresence } from "framer-motion";
import { LongPressModal } from "@/components/ui/LongPressModal";

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
  "oklch(0.95 0.07 90 / 0.85)", // Butter
  "oklch(0.94 0.06 5 / 0.85)", // Rose
  "oklch(0.94 0.06 160 / 0.85)", // Mint
  "oklch(0.93 0.06 290 / 0.85)", // Lavender
  "oklch(0.94 0.07 55 / 0.85)", // Peach
  "oklch(0.94 0.05 230 / 0.85)", // Sky
];

const OUTLINE_COLORS = [
  { label: "White", value: "#ffffff" },
  { label: "Butter", value: "oklch(0.95 0.07 90 / 0.85)" },
  { label: "Rose", value: "oklch(0.94 0.06 5 / 0.85)" },
  { label: "Mint", value: "oklch(0.94 0.06 160 / 0.85)" },
  { label: "Lavender", value: "oklch(0.93 0.06 290 / 0.85)" },
  { label: "Peach", value: "oklch(0.94 0.07 55 / 0.85)" },
  { label: "Sky", value: "oklch(0.94 0.05 230 / 0.85)" },
];

const UNSUPPORTED_IMAGE = "unsupported-image";

export function MemoriesView({ relationshipId }: { relationshipId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [showPageSearch, setShowPageSearch] = useState(false);
  const [pageSearchQuery, setPageSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"stickers" | "photos" | "note" | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteColor, setNoteColor] = useState(PASTEL_COLORS[0]);
  const [photoShape, setPhotoShape] = useState<"rect" | "square" | "circle" | "heart" | "star">(
    "rect",
  );
  const [photoOutline, setPhotoOutline] = useState("#ffffff");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showLongPressInfo, setShowLongPressInfo] = useState(false);

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
  const { confirm, setTab } = useAppStore();
  const couple = useCoupleNames();
  const coverNames = couple.slot === "a" ? [couple.me, couple.partner] : [couple.partner, couple.me];

  // Fetch album pages
  const {
    data: pages = [],
    refetch: refetchPages,
    isLoading: loadingPages,
    isSuccess: pagesLoaded,
  } = useQuery({
    queryKey: ["album-pages", relationshipId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("album_pages")
        .select("*")
        .eq("relationship_id", relationshipId)
        .order("page_index", { ascending: true });
      if (error) throw error;
      return data as AlbumPage[];
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
        const indexMatch = String(p.page_index + 1).includes(q);
        return nameMatch || indexMatch;
      });
  }, [pages, pageSearchQuery]);

  // Fetch album items, scoped to this relationship's pages
  const pageIds = useMemo(() => pages.map((p) => p.id), [pages]);
  const itemsKey = useMemo(
    () => ["album-items", relationshipId, pageIds.join(",")] as const,
    [relationshipId, pageIds],
  );
  const {
    data: items = [],
    refetch: refetchItems,
    isLoading: loadingItems,
  } = useQuery({
    queryKey: itemsKey,
    enabled: pagesLoaded,
    // Keep showing the current items while a page add/remove changes the key
    placeholderData: (prev) => prev,
    queryFn: async () => {
      if (pageIds.length === 0) return [] as AlbumItem[];
      const { data, error } = await (supabase as any)
        .from("album_items")
        .select("*")
        .in("page_id", pageIds);
      if (error) throw error;
      return data as AlbumItem[];
    },
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
    },
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
    },
  });

  // Filter 24-hours threshold helper
  const oneDayAgo = useMemo(() => new Date(Date.now() - 24 * 60 * 60 * 1000), []);

  // Photo notes are saved as kind "note" with an image_url (captioned or not),
  // so any note carrying an image counts as a photo.
  const recentPolaroids = useMemo(() => {
    return recentNotes.filter(
      (n: any) => !!n.image_url && new Date(n.created_at) > oneDayAgo,
    );
  }, [recentNotes, oneDayAgo]);

  const recentTexts = useMemo(() => {
    return recentNotes.filter(
      (n: any) =>
        n.kind === "note" &&
        !n.image_url &&
        n.body &&
        n.body !== "(photo)" &&
        new Date(n.created_at) > oneDayAgo,
    );
  }, [recentNotes, oneDayAgo]);

  const recentStickers = useMemo(() => {
    return userStickers.filter((st: any) => new Date(st.created_at) > oneDayAgo);
  }, [userStickers, oneDayAgo]);

  const olderStickers = useMemo(() => {
    return userStickers.filter((st: any) => new Date(st.created_at) <= oneDayAgo);
  }, [userStickers, oneDayAgo]);

  // Create a default page if none exist. Only once the pages query has actually
  // succeeded (not while it is still loading the default []), and only once.
  const creatingDefaultPageRef = useRef(false);
  useEffect(() => {
    if (!isOpen || !pagesLoaded || pages.length > 0 || creatingDefaultPageRef.current) return;
    creatingDefaultPageRef.current = true;
    (async () => {
      const { error } = await (supabase as any).from("album_pages").insert({
        relationship_id: relationshipId,
        page_index: 0,
      });
      if (error) {
        toast.error(error.message || "Couldn't create the first page");
        creatingDefaultPageRef.current = false;
        return;
      }
      refetchPages();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages.length, pagesLoaded, isOpen, relationshipId]);

  // Keep the selected page in range if a page disappears (e.g. partner deleted it)
  useEffect(() => {
    if (pages.length === 0) return;
    setCurrentPageIdx((idx) => Math.max(0, Math.min(idx, pages.length - 1)));
  }, [pages.length]);

  // Real-time synchronization, scoped to this relationship
  const pageIdsRef = useRef<string[]>(pageIds);
  pageIdsRef.current = pageIds;
  useEffect(() => {
    const channel = supabase
      .channel(`album-realtime-${relationshipId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "album_pages",
          filter: `relationship_id=eq.${relationshipId}`,
        },
        () => {
          refetchPages();
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "album_items" }, (payload: any) => {
        // album_items has no relationship_id; only react to rows on our pages.
        // Deletes may only carry the primary key, so refetch when page_id is unknown.
        const pageId = payload?.new?.page_id ?? payload?.old?.page_id;
        if (pageId && !pageIdsRef.current.includes(pageId)) return;
        refetchItems();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // refetch functions are stable per observer; resubscribe only when the relationship changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationshipId]);

  useEffect(() => {
    const key = "intro-dismissed-album";
    const val = localStorage.getItem(key);
    if (!val) {
      localStorage.setItem(key, "true");
    }
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
  const drawHeart = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    ox: number,
    oy: number,
  ) => {
    ctx.moveTo(ox + w * 0.5, oy + h * 0.9);
    ctx.bezierCurveTo(ox + w * 0.05, oy + h * 0.6, ox, oy + h * 0.45, ox, oy + h * 0.3);
    ctx.bezierCurveTo(ox, oy + h * 0.15, ox + w * 0.1, oy, ox + w * 0.25, oy);
    ctx.bezierCurveTo(ox + w * 0.35, oy, ox + w * 0.45, oy + h * 0.1, ox + w * 0.5, oy + h * 0.2);
    ctx.bezierCurveTo(ox + w * 0.55, oy + h * 0.1, ox + w * 0.65, oy, ox + w * 0.75, oy);
    ctx.bezierCurveTo(ox + w * 0.9, oy, ox + w * 1.0, oy + h * 0.15, ox + w * 1.0, oy + h * 0.3);
    ctx.bezierCurveTo(
      ox + w * 1.0,
      oy + h * 0.45,
      ox + w * 0.95,
      oy + h * 0.6,
      ox + w * 0.5,
      oy + h * 0.9,
    );
  };

  const drawStar = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    ox: number,
    oy: number,
  ) => {
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
      const maxIdx = pages.reduce((max, p) => (p.page_index > max ? p.page_index : max), -1);
      const { error } = await (supabase as any).from("album_pages").insert({
        relationship_id: relationshipId,
        page_index: maxIdx + 1,
        name: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchPages();
      toast.success("Page added to album!");
    },
    onError: (e: any) => toast.error(e?.message || "Something went wrong"),
  });

  const deletePage = useMutation({
    mutationFn: async (pageId: string) => {
      const { error } = await (supabase as any).from("album_pages").delete().eq("id", pageId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchPages();
      setCurrentPageIdx((prev) => Math.max(0, prev - 1));
      toast.success("Page deleted");
    },
    onError: (e: any) => toast.error(e?.message || "Something went wrong"),
  });

  const renamePage = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await (supabase as any).from("album_pages").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchPages();
      toast.success("Page renamed!");
    },
    onError: (e: any) => toast.error(e?.message || "Something went wrong"),
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
    },
    onError: (e: any) => toast.error(e?.message || "Something went wrong"),
  });

  const updateItemPosition = useMutation({
    mutationFn: async ({ id, pos_x, pos_y }: { id: string; pos_x: number; pos_y: number }) => {
      const { error } = await (supabase as any)
        .from("album_items")
        .update({ pos_x, pos_y })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, pos_x, pos_y }) => {
      await qc.cancelQueries({ queryKey: itemsKey });
      const previous = qc.getQueryData<AlbumItem[]>(itemsKey);
      qc.setQueryData<AlbumItem[]>(itemsKey, (old) => {
        if (!old) return [];
        return old.map((it) => (it.id === id ? { ...it, pos_x, pos_y } : it));
      });
      return { previous };
    },
    onError: (e, vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(itemsKey, ctx.previous);
    },
    onSuccess: () => {
      refetchItems();
    },
  });

  const updateItemRotation = useMutation({
    mutationFn: async ({ id, rotation }: { id: string; rotation: number }) => {
      const { error } = await (supabase as any)
        .from("album_items")
        .update({ rotation })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, rotation }) => {
      await qc.cancelQueries({ queryKey: itemsKey });
      const previous = qc.getQueryData<AlbumItem[]>(itemsKey);
      qc.setQueryData<AlbumItem[]>(itemsKey, (old) => {
        if (!old) return [];
        return old.map((it) => (it.id === id ? { ...it, rotation } : it));
      });
      return { previous };
    },
    onError: (e, vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(itemsKey, ctx.previous);
    },
    onSuccess: () => {
      refetchItems();
    },
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
    },
    onError: (e: any) => toast.error(e?.message || "Something went wrong"),
  });

  // Upload and bake canvas crop
  const uploadBakedPhoto = useMutation({
    mutationFn: async ({
      file,
      shape,
      outline,
      scale,
      offsetX,
      offsetY,
    }: {
      file: File;
      shape: "rect" | "square" | "circle" | "heart" | "star";
      outline: string;
      scale: number;
      offsetX: number;
      offsetY: number;
    }) => {
      const activePage = pages[currentPageIdx];
      if (!activePage) throw new Error("Open a page first");

      // 1. Create a helper image element
      const img = new Image();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Couldn't read that file"));
        reader.readAsDataURL(file);
      });
      // Handlers go on before src so a cached/instant load or failure is never missed.
      // Unsupported formats (e.g. HEIC) fire onerror instead of hanging forever.
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(UNSUPPORTED_IMAGE));
        img.src = dataUrl;
      });

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

      // Insert directly (not via addItem) so a failure produces one toast, not two
      const { error } = await (supabase as any).from("album_items").insert({
        page_id: activePage.id,
        item_type: "picture",
        content: null,
        image_url: url,
        color: `${shape}:${outline}`, // Store shape:outline for future edits if needed
        pos_x: 30,
        pos_y: 30,
        scale: 1,
        rotation: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchItems();
      toast.success("Picture added!");
      setSelectedFile(null);
      setPreviewUrl(null);
      setActiveTab(null);
    },
    onError: (e: any) => {
      if (e?.message === UNSUPPORTED_IMAGE) {
        toast.error("That image type isn't supported");
        setSelectedFile(null);
        setPreviewUrl(null);
        return;
      }
      toast.error(e?.message || "Failed to add picture");
    },
  });

  const activePage = pages[currentPageIdx];
  const activePageItems = useMemo(() => {
    if (!activePage) return [];
    return items.filter((it) => it.page_id === activePage.id);
  }, [items, activePage]);

  // Render Closed Book Cover (Takes w-full, stretches to match customize panel, aspect 1/1.4)
  const renderClosedBook = () => (
    <div className="relative z-10 flex h-[calc(100dvh-200px)] w-full flex-col items-center justify-center overflow-hidden bg-transparent p-4">
      {/* watercolor dream backdrops */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[10%] -left-20 w-80 h-80 rounded-full bg-pink-200/10 blur-[80px]" />
        <div className="absolute bottom-[20%] -right-20 w-96 h-96 rounded-full bg-blue-200/15 blur-[100px]" />
      </div>

      <motion.div
        whileHover={{ scale: 1.01, rotate: 0.5 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => setIsOpen(true)}
        className="group relative z-10 flex aspect-[1/1.4] max-h-[calc(100dvh-280px)] w-full max-w-[400px] cursor-pointer select-none flex-col justify-between overflow-hidden rounded-[10px_28px_28px_10px] bg-[linear-gradient(160deg,#bccdf6_0%,#a3b9f0_55%,#aec2f3_100%)] p-10 text-center shadow-[0_30px_60px_-30px_rgba(50,70,150,0.7),inset_0_1px_0_rgba(255,255,255,0.6)]"
      >
        {/* cloth spine */}
        <div className="absolute inset-y-0 left-0 w-[22px] bg-[linear-gradient(90deg,rgba(31,42,92,0.18),rgba(31,42,92,0.04))]" />
        <div className="absolute inset-y-0 left-[22px] w-px bg-white/40" />
        <img
          src="/lily1.webp"
          alt=""
          aria-hidden
          className="pointer-events-none absolute -bottom-10 -right-12 w-[240px] rotate-[-14deg] opacity-95 transition-transform duration-500 group-hover:rotate-[-10deg]"
        />

        <div className="relative mt-10 flex flex-1 flex-col items-center justify-start gap-1">
          <span className="sn-hand text-[22px] text-white/85">our little album</span>
          <h2 className="mt-4 font-serif text-[48px] font-semibold leading-none text-white drop-shadow-[0_2px_6px_rgba(31,42,92,0.25)]">
            {coverNames[0]}
          </h2>
          <span className="font-serif text-[28px] italic text-white/80">&amp;</span>
          <h2 className="font-serif text-[48px] font-semibold leading-none text-white drop-shadow-[0_2px_6px_rgba(31,42,92,0.25)]">
            {coverNames[1]}
          </h2>
        </div>
      </motion.div>
      <p className="relative z-10 mt-5 text-[14.5px] text-sn-muted">Tap the album to open it</p>

    </div>
  );

  // Render Open Book Layout
  const closeTool = () => {
    setActiveTab(null);
    setSelectedFile(null);
    setPreviewUrl(null);
  };
  const toggleTool = (t: "stickers" | "photos" | "note") => {
    setActiveTab(activeTab === t ? null : t);
    setSelectedFile(null);
    setPreviewUrl(null);
  };
  const addStickerItem = (url: string) => {
    if (!activePage) return;
    addItem.mutate({
      page_id: activePage.id,
      item_type: "sticker",
      content: null,
      image_url: url,
      color: null,
      pos_x: 30,
      pos_y: 30,
      scale: 1,
      rotation: 0,
    }, { onSuccess: () => toast.success("Sticker added") });
  };
  const SHAPE_LABEL: Record<string, string> = {
    rect: "Portrait",
    square: "Square",
    circle: "Circle",
    heart: "Heart",
    star: "Star",
  };
  const stickerTile =
    "grid aspect-square place-items-center overflow-hidden rounded-[16px] border border-white bg-white/70 p-1.5 transition hover:bg-white active:scale-95";

  const renderOpenBook = () => {
    return (
      <div className="mx-auto w-full max-w-[640px] select-none px-4 pb-[210px] pt-2 sm:px-6 lg:max-w-[900px]">
        {/* ── Page bar: back, page numbers, page actions ── */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close the album"
            title="Close the album"
            className="sn-pill sn-icon-btn h-11 w-11"
          >
            <ArrowLeft size={18} strokeWidth={2} />
          </button>
          <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1">
            {filteredPages.length === 0 ? (
              <span className="px-1 text-[14px] text-sn-muted">No pages match</span>
            ) : (
              filteredPages.map((p) => {
                const idx = p.originalIndex;
                const active = currentPageIdx === idx;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setCurrentPageIdx(idx);
                      setSelectedItemId(null);
                    }}
                    aria-current={active ? "page" : undefined}
                    className={`sn-pill h-10 shrink-0 px-4 text-[14px] ${active ? "sn-active" : ""}`}
                  >
                    {p.name || idx + 1}
                  </button>
                );
              })
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => {
                setShowPageSearch(!showPageSearch);
                if (showPageSearch) setPageSearchQuery("");
              }}
              aria-label="Find a page"
              title="Find a page"
              aria-pressed={showPageSearch}
              className={`sn-pill sn-icon-btn h-10 w-10 ${showPageSearch ? "sn-active" : ""}`}
            >
              <Search size={17} strokeWidth={1.9} />
            </button>
            <button
              onClick={() => addPage.mutate()}
              aria-label="Add a page"
              title="Add a page"
              className="sn-pill sn-icon-btn h-10 w-10"
            >
              <Plus size={18} strokeWidth={2} />
            </button>
            {pages.length > 1 && (
              <button
                onClick={() =>
                  confirm({
                    title: "Delete this page?",
                    message: "Everything placed on this page will be removed too.",
                    onConfirm: () => {
                      if (activePage) deletePage.mutate(activePage.id);
                    },
                  })
                }
                aria-label="Delete this page"
                title="Delete this page"
                className="sn-pill sn-icon-btn hidden h-10 w-10 sm:inline-grid"
              >
                <Trash2 size={16} strokeWidth={1.9} className="!text-[#c2416c]" />
              </button>
            )}
          </div>
        </div>

        {showPageSearch && (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={pageSearchQuery}
              onChange={(e) => setPageSearchQuery(e.target.value)}
              placeholder="Page name or number"
              autoFocus
              className="h-11 w-full rounded-full border border-white/80 bg-white/75 px-4 text-[15px] text-sn-navy outline-none placeholder:text-sn-faint focus:border-sn-periwinkle"
            />
            {pageSearchQuery && (
              <button
                onClick={() => setPageSearchQuery("")}
                aria-label="Clear search"
                className="sn-ghost sn-icon-btn h-11 w-11"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-col items-center">
          {/* ── The page ── */}
          <div className="flex min-w-0 flex-col items-center">
            {activePage && (
              <div className="mb-3 flex w-full max-w-[min(100%,calc((100dvh-230px)/1.4))] items-center justify-between gap-3 lg:max-w-[min(100%,calc((100dvh-250px)/1.4))]">
                <button
                  onClick={() => {
                    setRenameNameText(activePage.name || `Page ${currentPageIdx + 1}`);
                    setRenameModalOpen(true);
                  }}
                  title="Rename this page"
                  className="group flex min-w-0 items-center gap-2 text-left"
                >
                  <span className="truncate font-serif text-[22px] font-semibold text-sn-navy">
                    {activePage.name || `Page ${currentPageIdx + 1}`}
                  </span>
                  <Pencil
                    size={14}
                    strokeWidth={2}
                    className="shrink-0 text-sn-muted transition-colors group-hover:text-sn-navy"
                  />
                </button>
                <span className="shrink-0 text-[14px] text-sn-muted tabular-nums">
                  {currentPageIdx + 1} / {pages.length}
                </span>
              </div>
            )}

            <div className="relative w-full max-w-[min(100%,calc((100dvh-320px)/1.4))]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentPageIdx}
                  ref={pageRef}
                  initial={{ opacity: 0, x: 18, rotate: 0.6 }}
                  animate={{ opacity: 1, x: 0, rotate: 0 }}
                  exit={{ opacity: 0, x: -18, rotate: -0.6 }}
                  transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }}
                  className="relative aspect-[1/1.4] w-full overflow-hidden rounded-[8px_26px_26px_8px] bg-[#fdfbf7] shadow-[0_30px_60px_-30px_rgba(50,70,150,0.65),0_2px_6px_rgba(80,98,172,0.1)]"
                  onClick={() => setSelectedItemId(null)}
                >
                  {/* paper: grain, dot grid and a soft gutter shadow */}
                  <div className="pointer-events-none absolute inset-0 bg-[url('/art/paper-grain.png')] [background-size:220px_220px]" />
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#e6e3ef_1.4px,transparent_1.4px)] [background-size:18px_18px]" />
                  <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-[linear-gradient(90deg,rgba(31,42,92,0.09),transparent)]" />

                  {loadingPages || loadingItems ? (
                    <div className="pointer-events-none absolute inset-0 grid place-items-center">
                      <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#c9d5f7] border-t-sn-periwinkle" />
                    </div>
                  ) : activePageItems.length === 0 ? (
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                      <img src="/lily1.webp" alt="" aria-hidden className="w-[110px] -rotate-6 opacity-90" />
                      <div className="mt-2 font-serif text-[20px] font-semibold text-sn-navy">
                        An empty page
                      </div>
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
                              xPct = Math.max(0, Math.min(68, xPct));
                              yPct = Math.max(0, Math.min(80, yPct));
                              updateItemPosition.mutate({ id: it.id, pos_x: xPct, pos_y: yPct });
                            }
                          }}
                          onDragStart={() => setSelectedItemId(null)}
                          whileDrag={{ scale: 1.05, zIndex: 100 }}
                          className="album-item-drag-target absolute touch-none select-none"
                          style={{ left: `${it.pos_x}%`, top: `${it.pos_y}%`, zIndex: isSelected ? 50 : 10 }}
                        >
                          <div
                            className="relative cursor-grab p-2 active:cursor-grabbing"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedItemId(isSelected ? null : it.id);
                            }}
                          >
                            {it.item_type === "sticker" && (
                              <div
                                className="pointer-events-none select-none drop-shadow-md"
                                style={{ transform: `rotate(${it.rotation}deg)` }}
                              >
                                {it.image_url ? (
                                  <img src={it.image_url} alt="" className="h-20 w-20 object-contain" />
                                ) : it.content?.trim() ? (
                                  // Legacy sticker stored as an emoji/text string: keep it, but as a small quiet tag
                                  <div className="max-w-[96px] truncate rounded-full border border-white bg-white/80 px-2.5 py-1 text-[14px] leading-none text-sn-muted">
                                    {it.content}
                                  </div>
                                ) : null}
                              </div>
                            )}

                            {it.item_type === "picture" && it.image_url && (
                              <div
                                className="pointer-events-none select-none drop-shadow-md"
                                style={{ transform: `rotate(${it.rotation}deg)` }}
                              >
                                <img src={it.image_url} alt="" className="w-28 object-contain" />
                              </div>
                            )}

                            {it.item_type === "polaroid" && it.image_url && (
                              <div
                                className="pointer-events-none flex w-24 select-none flex-col items-center rounded-[3px] bg-white p-1.5 pb-5 shadow-[0_10px_20px_-10px_rgba(50,70,150,0.6)] ring-1 ring-[#ebe8f6]"
                                style={{ transform: `rotate(${it.rotation}deg)` }}
                              >
                                <div className="aspect-square w-full overflow-hidden bg-[#eef1fb]">
                                  <img src={it.image_url} alt="" className="h-full w-full object-cover" />
                                </div>
                              </div>
                            )}

                            {it.item_type === "text" && (
                              <div
                                className="pointer-events-none max-w-[140px] select-none rounded-[6px] p-3 text-left shadow-[0_8px_16px_-10px_rgba(50,70,150,0.55)]"
                                style={{
                                  background: it.color || PASTEL_COLORS[0],
                                  transform: `rotate(${it.rotation}deg)`,
                                }}
                              >
                                <p className="sn-hand whitespace-pre-wrap break-words text-[17px] leading-tight text-sn-navy">
                                  {it.content}
                                </p>
                              </div>
                            )}

                            {/* Item actions stay upright */}
                            <AnimatePresence>
                              {isSelected && (
                                <motion.div
                                  initial={{ opacity: 0, y: 4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 4 }}
                                  transition={{ duration: 0.16 }}
                                  className="pointer-events-auto absolute bottom-full left-1/2 z-50 mb-1 flex -translate-x-1/2 items-center gap-1.5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {(it.item_type === "polaroid" ||
                                    it.item_type === "picture" ||
                                    (it.item_type === "sticker" && it.image_url)) &&
                                    it.image_url && (
                                      <button
                                        onClick={() => {
                                          setLightbox(it.image_url);
                                          setSelectedItemId(null);
                                        }}
                                        aria-label="View"
                                        title="View"
                                        className="sn-pill sn-icon-btn h-9 w-9"
                                      >
                                        <Eye size={15} />
                                      </button>
                                    )}
                                  <button
                                    onClick={() =>
                                      updateItemRotation.mutate({ id: it.id, rotation: (it.rotation + 15) % 360 })
                                    }
                                    aria-label="Rotate"
                                    title="Rotate"
                                    className="sn-pill sn-icon-btn h-9 w-9"
                                  >
                                    <RotateCw size={15} />
                                  </button>
                                  <button
                                    onClick={() =>
                                      confirm({
                                        title: "Remove this from the page?",
                                        message: "It will be deleted from the album.",
                                        onConfirm: () => deleteItem.mutate(it.id),
                                      })
                                    }
                                    aria-label="Delete"
                                    title="Delete"
                                    className="sn-pill sn-icon-btn h-9 w-9"
                                  >
                                    <Trash2 size={15} className="!text-[#c2416c]" />
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

            {pages.length > 1 && activePage && (
              <button
                onClick={() =>
                  confirm({
                    title: "Delete this page?",
                    message: "Everything placed on this page will be removed too.",
                    onConfirm: () => deletePage.mutate(activePage.id),
                  })
                }
                className="sn-ghost mt-3 h-10 px-4 text-[14px] sm:hidden"
              >
                <Trash2 size={15} className="text-[#c2416c]" />
                Delete page
              </button>
            )}
          </div>

          {/* ── Tools: a floating bar centred above the dock ── */}
          {activePage && (
            <div className="fixed inset-x-3 bottom-[calc(max(0.875rem,env(safe-area-inset-bottom))+80px)] z-30 mx-auto max-w-[520px]">
              <AnimatePresence initial={false}>
                {activeTab && (
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
                    className="sn-card mb-3 max-h-[46dvh] overflow-y-auto p-5"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-serif text-[20px] font-semibold text-sn-navy">
                        {activeTab === "stickers" ? "Stickers" : activeTab === "photos" ? "Photo" : "Note"}
                      </h3>
                      <button onClick={closeTool} aria-label="Close" className="sn-ghost sn-icon-btn h-9 w-9">
                        <X size={16} />
                      </button>
                    </div>

                    {/* Stickers */}
                    {activeTab === "stickers" && (
                      <div className="space-y-5">
                        {recentStickers.length > 0 && (
                          <div>
                            <h4 className="sn-label">New</h4>
                            <div className="mt-2.5 grid grid-cols-5 gap-2.5 lg:grid-cols-4">
                              {recentStickers.map((st: any) => (
                                <button
                                  key={st.id}
                                  onClick={() => addStickerItem(st.image_url)}
                                  className={stickerTile}
                                  aria-label="Add sticker"
                                >
                                  <img src={st.image_url} alt="" className="pointer-events-none max-h-full max-w-full object-contain" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <div>
                          {recentStickers.length > 0 && <h4 className="sn-label">All stickers</h4>}
                          {olderStickers.length === 0 && recentStickers.length === 0 ? (
                            <p className="text-[14.5px] text-sn-muted">Make stickers on the Stickers page first.</p>
                          ) : (
                            <div className="mt-2.5 grid grid-cols-5 gap-2.5 lg:grid-cols-4">
                              {olderStickers.map((st: any) => (
                                <button
                                  key={st.id}
                                  onClick={() => addStickerItem(st.image_url)}
                                  className={stickerTile}
                                  aria-label="Add sticker"
                                >
                                  <img src={st.image_url} alt="" className="pointer-events-none max-h-full max-w-full object-contain" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Photo */}
                    {activeTab === "photos" && (
                      <div className="space-y-5">
                        {recentPolaroids.length > 0 && !previewUrl && (
                          <div>
                            <h4 className="sn-label">From the love wall</h4>
                            <div className="no-scrollbar mt-2.5 flex gap-3 overflow-x-auto pb-1">
                              {recentPolaroids.map((p: any) => (
                                <button
                                  key={p.id}
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
                                      rotation: (Math.random() - 0.5) * 8,
                                    }, { onSuccess: () => toast.success("Polaroid added") });
                                  }}
                                  aria-label="Add this polaroid"
                                  className="w-16 shrink-0 rounded-[3px] bg-white p-1 pb-3 shadow-[0_8px_14px_-8px_rgba(50,70,150,0.55)] transition active:scale-95"
                                >
                                  <img src={p.image_url} alt="" className="pointer-events-none aspect-square w-full object-cover" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {previewUrl && (
                          <div className="flex flex-col items-center gap-4">
                            <div
                              className="relative flex cursor-move select-none items-center justify-center overflow-hidden shadow-[0_12px_24px_-12px_rgba(50,70,150,0.55)]"
                              style={{
                                width: "140px",
                                height: photoShape === "rect" ? "196px" : "140px",
                                borderRadius:
                                  photoShape === "circle" ? "50%" : photoShape === "square" || photoShape === "rect" ? "24px" : "0px",
                                clipPath:
                                  photoShape === "heart" ? "url(#heart-mask)" : photoShape === "star" ? "url(#star-mask)" : undefined,
                                background: photoOutline,
                                padding: "6px",
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
                                className="pointer-events-none h-full w-full overflow-hidden"
                                style={{
                                  borderRadius:
                                    photoShape === "circle" ? "50%" : photoShape === "square" || photoShape === "rect" ? "18px" : "0px",
                                  clipPath:
                                    photoShape === "heart" ? "url(#heart-mask)" : photoShape === "star" ? "url(#star-mask)" : undefined,
                                }}
                              >
                                <img
                                  id="preview-img-target"
                                  src={previewUrl}
                                  alt=""
                                  onError={() => {
                                    toast.error("That image type isn't supported");
                                    setSelectedFile(null);
                                    setPreviewUrl(null);
                                  }}
                                  className="max-w-none origin-center"
                                  style={{
                                    width: "140px",
                                    transform: `translate(${previewOffsetX}px, ${previewOffsetY}px) scale(${previewScale})`,
                                  }}
                                />
                              </div>
                            </div>
                            <label className="w-full">
                              <span className="flex justify-between text-[13px] font-semibold text-sn-ink">
                                Zoom <span className="tabular-nums text-sn-muted">{previewScale.toFixed(1)}×</span>
                              </span>
                              <input
                                type="range"
                                min="0.8"
                                max="4"
                                step="0.05"
                                value={previewScale}
                                onChange={(e) => setPreviewScale(parseFloat(e.target.value))}
                                className="mt-2 w-full accent-[#8faaf0]"
                              />
                            </label>
                            <div className="flex w-full gap-2">
                              <button
                                onClick={() => {
                                  setSelectedFile(null);
                                  setPreviewUrl(null);
                                }}
                                className="sn-ghost h-11 flex-1 text-[14.5px]"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => {
                                  if (selectedFile) {
                                    uploadBakedPhoto.mutate({
                                      file: selectedFile,
                                      shape: photoShape,
                                      outline: photoOutline,
                                      scale: previewScale,
                                      offsetX: previewOffsetX,
                                      offsetY: previewOffsetY,
                                    });
                                  }
                                }}
                                disabled={uploadBakedPhoto.isPending}
                                className="sn-pill h-11 flex-1 text-[14.5px]"
                              >
                                {uploadBakedPhoto.isPending ? "Adding…" : "Add to page"}
                              </button>
                            </div>
                          </div>
                        )}

                        <div>
                          <h4 className="sn-label">Shape</h4>
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            {(["rect", "square", "circle", "heart", "star"] as const).map((s) => (
                              <button
                                key={s}
                                onClick={() => setPhotoShape(s)}
                                className={`sn-pill h-9 px-4 text-[13.5px] ${photoShape === s ? "sn-active" : ""}`}
                              >
                                {SHAPE_LABEL[s]}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="sn-label">Border</h4>
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            {OUTLINE_COLORS.map((oc) => (
                              <button
                                key={oc.value}
                                onClick={() => setPhotoOutline(oc.value)}
                                aria-label={oc.label}
                                title={oc.label}
                                className={`h-9 w-9 rounded-full border-2 transition active:scale-95 ${
                                  photoOutline === oc.value ? "border-[#94b2f6] ring-2 ring-white" : "border-white"
                                }`}
                                style={{ background: oc.value }}
                              />
                            ))}
                          </div>
                        </div>

                        {!previewUrl && (
                          <label className="sn-pill h-11 w-full cursor-pointer text-[14.5px]">
                            <Upload size={16} strokeWidth={1.9} />
                            Choose a photo
                            <input type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />
                          </label>
                        )}
                      </div>
                    )}

                    {/* Note */}
                    {activeTab === "note" && (
                      <div className="space-y-5">
                        {recentTexts.length > 0 && (
                          <div>
                            <h4 className="sn-label">From the love wall</h4>
                            <div className="no-scrollbar mt-2.5 flex gap-2.5 overflow-x-auto pb-1">
                              {recentTexts.map((t: any) => (
                                <button
                                  key={t.id}
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
                                      rotation: 0,
                                    }, { onSuccess: () => toast.success("Note added") });
                                  }}
                                  className="h-20 w-28 shrink-0 overflow-hidden rounded-[8px] p-2.5 text-left shadow-[0_8px_14px_-10px_rgba(50,70,150,0.55)] transition active:scale-95"
                                  style={{ background: t.color || PASTEL_COLORS[0] }}
                                >
                                  <p className="line-clamp-3 break-words text-[13px] leading-snug text-sn-navy">{t.body}</p>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <div>
                          <h4 className="sn-label">Paper</h4>
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            {PASTEL_COLORS.map((col) => (
                              <button
                                key={col}
                                onClick={() => setNoteColor(col)}
                                aria-label="Paper colour"
                                className={`h-9 w-9 rounded-full border-2 transition active:scale-95 ${
                                  noteColor === col ? "border-[#94b2f6] ring-2 ring-white" : "border-white"
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
                            placeholder="Write something"
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            className="h-11 min-w-0 flex-1 rounded-full border border-[#e1e4f5] bg-white/85 px-4 text-[15px] text-sn-navy outline-none placeholder:text-sn-faint focus:border-sn-periwinkle"
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
                                rotation: 0,
                              });
                              setNoteText("");
                              setActiveTab(null);
                            }}
                            disabled={!noteText.trim()}
                            className="sn-pill h-11 shrink-0 px-5 text-[14.5px]"
                          >
                            Pin
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Tool switcher */}
              <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-white/80 bg-white/45 p-1.5 shadow-[0_14px_30px_-16px_rgba(70,88,168,0.55)] backdrop-blur-xl">
                {(
                  [
                    ["stickers", "Stickers", Star],
                    ["photos", "Photo", ImageIcon],
                    ["note", "Note", StickyNote],
                  ] as const
                ).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    onClick={() => toggleTool(key)}
                    aria-pressed={activeTab === key}
                    className={`sn-pill h-11 px-4 text-[14px] ${activeTab === key ? "sn-active" : ""}`}
                  >
                    <Icon size={17} strokeWidth={1.8} />
                    {label}
                  </button>
                ))}
                <button
                  onClick={() => setShowLongPressInfo(true)}
                  aria-label="How the album works"
                  title="How the album works"
                  className="sn-pill sn-icon-btn h-11 w-11"
                >
                  <HelpCircle size={17} strokeWidth={1.8} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-32 relative select-none overflow-x-hidden">
      {!isOpen ? renderClosedBook() : renderOpenBook()}
      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
      <LongPressModal
        isOpen={showLongPressInfo}
        onClose={() => setShowLongPressInfo(false)}
        title="Memory Album"
        description="Welcome to our shared memory album! Here, we can add pictures, write notes, save special moments, and decorate the pages using the custom stickers we created together."
      />

      {/* ── Rename Page Modal (Glassmorphic, styled exactly like StickersView) ── */}
      <AnimatePresence>
        {renameModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRenameModalOpen(false)}
              className="absolute inset-0 bg-[#1f2a5c]/20 backdrop-blur-[3px]"
            />
            <motion.form
              onSubmit={handleRenameSubmit}
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 15 }}
              className="sn-card relative z-10 w-full max-w-[340px] space-y-4 p-6"
            >
              <h3 className="font-serif text-[22px] font-semibold text-sn-navy">Rename page</h3>
              <input
                type="text"
                autoFocus
                placeholder="Page name"
                value={renameNameText}
                onChange={(e) => setRenameNameText(e.target.value)}
                className="w-full rounded-[16px] border border-[#e1e4f5] bg-white/85 px-4 py-3 text-[15px] text-sn-navy placeholder:text-sn-faint outline-none focus:border-sn-periwinkle"
              />
              <div className="flex gap-2 text-xs font-semibold pt-1">
                <button
                  type="button"
                  onClick={() => setRenameModalOpen(false)}
                  className="sn-ghost flex-1 h-11 text-[14.5px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!renameNameText.trim() || renamePage.isPending}
                  className="sn-pill flex-1 h-11 text-[14.5px]"
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
