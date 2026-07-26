import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { uploadImage } from "@/lib/storage";
import {
  processImageDataBG,
  floodFillPointRemove,
  applyStickerOutline,
  type BGRemovalMode,
} from "@/lib/background-remover";
import { PrimaryButton } from "./form-ui";
import { Upload, Sliders, Wand2, Paintbrush, Eraser, Undo2, Check, Eye } from "lucide-react";
import { useAppStore } from "@/features/app/store";

const OUTLINE_COLORS = [
  { value: "#ffffff", label: "White" },
  { value: "#F8BBD0", label: "Pink" },
  { value: "#B3E5FC", label: "Blue" },
  { value: "#FFF9C4", label: "Yellow" },
  { value: "#D1C4E9", label: "Purple" },
  { value: "#C8E6C9", label: "Green" },
];

type Tool = "wand" | "restore" | "erase";

export function AddStickerSheet({
  relationshipId,
  pageId,
}: {
  relationshipId: string;
  pageId?: string;
}) {
  const { user } = useUser();
  const qc = useQueryClient();
  const { closeSheet } = useAppStore();

  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<BGRemovalMode>("exterior");
  const [tolerance, setTolerance] = useState(42);
  const [outlineColor, setOutlineColor] = useState("#ffffff");
  const [outlineSize, setOutlineSize] = useState(10);
  const [activeTool, setActiveTool] = useState<Tool>("wand");
  const [brushSize, setBrushSize] = useState(16);

  const [rawImage, setRawImage] = useState<HTMLImageElement | null>(null);
  const [processing, setProcessing] = useState(false);

  // Undo history stack of ImageData
  const [history, setHistory] = useState<ImageData[]>([]);

  const workingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  // Load raw image when file changes
  useEffect(() => {
    if (!file) {
      setRawImage(null);
      setHistory([]);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    const url = URL.createObjectURL(file);
    img.src = url;

    img.onload = () => {
      setRawImage(img);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      toast.error("Could not load selected image");
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // Re-run background processing when rawImage, mode, or tolerance changes
  const reprocessBG = useCallback(() => {
    if (!rawImage) return;

    setProcessing(true);

    const w = rawImage.naturalWidth;
    const h = rawImage.naturalHeight;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(rawImage, 0, 0);
    const imgData = ctx.getImageData(0, 0, w, h);

    // Apply background removal
    processImageDataBG(imgData, tolerance, mode);
    ctx.putImageData(imgData, 0, 0);

    workingCanvasRef.current = canvas;
    setHistory([ctx.getImageData(0, 0, w, h)]);

    setProcessing(false);
  }, [rawImage, mode, tolerance]);

  useEffect(() => {
    reprocessBG();
  }, [reprocessBG]);

  // Update preview canvas with outline whenever workingCanvas or outline settings change
  const renderPreview = useCallback(() => {
    const workingCanvas = workingCanvasRef.current;
    const previewCanvas = previewCanvasRef.current;
    if (!workingCanvas || !previewCanvas) return;

    let finalCanvas = workingCanvas;
    if (outlineSize > 0 && outlineColor) {
      finalCanvas = applyStickerOutline(workingCanvas, outlineColor, outlineSize);
    }

    previewCanvas.width = finalCanvas.width;
    previewCanvas.height = finalCanvas.height;
    const pCtx = previewCanvas.getContext("2d");
    if (!pCtx) return;

    pCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    pCtx.drawImage(finalCanvas, 0, 0);
  }, [outlineColor, outlineSize]);

  useEffect(() => {
    renderPreview();
  }, [renderPreview, history]);

  // Save current working canvas state to undo history
  const pushHistory = () => {
    const canvas = workingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => [...prev.slice(-10), data]);
  };

  const handleUndo = () => {
    if (history.length <= 1) return;
    const newHist = history.slice(0, -1);
    const lastState = newHist[newHist.length - 1];

    const canvas = workingCanvasRef.current;
    if (canvas && lastState) {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.putImageData(lastState, 0, 0);
        setHistory(newHist);
        renderPreview();
      }
    }
  };

  // Canvas touch & mouse interaction (Magic Wand, Restore Brush, Eraser Brush)
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const previewCanvas = previewCanvasRef.current;
    const workingCanvas = workingCanvasRef.current;
    if (!previewCanvas || !workingCanvas) return null;

    const rect = previewCanvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const scaleX = previewCanvas.width / rect.width;
    const scaleY = previewCanvas.height / rect.height;

    // Convert screen touch coords to working canvas coords
    const previewX = (clientX - rect.left) * scaleX;
    const previewY = (clientY - rect.top) * scaleY;

    const padding = outlineSize > 0 ? outlineSize * 2 : 0;
    const workX = Math.round(previewX - padding);
    const workY = Math.round(previewY - padding);

    return { workX, workY };
  };

  const handleCanvasInteractionStart = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    const coords = getCanvasCoords(e);
    if (!coords || !workingCanvasRef.current) return;

    const { workX, workY } = coords;
    const canvas = workingCanvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    if (activeTool === "wand") {
      // Magic Wand: Tap to flood fill remove color at point
      pushHistory();
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      floodFillPointRemove(imgData, workX, workY, tolerance);
      ctx.putImageData(imgData, 0, 0);
      renderPreview();
      toast.success("Area cleared", { duration: 1000 });
    } else {
      // Brush modes
      isDrawingRef.current = true;
      pushHistory();
      paintBrushStroke(workX, workY);
    }
  };

  const handleCanvasInteractionMove = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    if (!isDrawingRef.current || activeTool === "wand") return;
    const coords = getCanvasCoords(e);
    if (!coords) return;

    paintBrushStroke(coords.workX, coords.workY);
  };

  const handleCanvasInteractionEnd = () => {
    isDrawingRef.current = false;
  };

  const paintBrushStroke = (x: number, y: number) => {
    const canvas = workingCanvasRef.current;
    if (!canvas || !rawImage) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    if (activeTool === "erase") {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (activeTool === "restore") {
      // Paint original pixels from rawImage back onto canvas
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(rawImage, 0, 0);
      ctx.restore();
    }

    renderPreview();
  };

  // Upload processed blob
  const uploadSticker = useMutation({
    mutationFn: async () => {
      if (!user || !workingCanvasRef.current) return;

      const workingCanvas = workingCanvasRef.current;
      let finalCanvas = workingCanvas;
      if (outlineSize > 0 && outlineColor) {
        finalCanvas = applyStickerOutline(workingCanvas, outlineColor, outlineSize);
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        finalCanvas.toBlob((b) => resolve(b), "image/png"),
      );

      if (!blob) throw new Error("Failed to render sticker blob");

      const stickerId = crypto.randomUUID();
      const x = 30 + Math.random() * 40;
      const y = 30 + Math.random() * 30;
      const rot = (Math.random() - 0.5) * 20;

      const { path, url } = await uploadImage(
        "stickers",
        relationshipId,
        blob,
        `sticker_${stickerId}`,
      );

      const { error } = await supabase.from("stickers").insert({
        relationship_id: relationshipId,
        created_by: user.id,
        image_url: url,
        image_path: path,
        pos_x: x,
        pos_y: y,
        rotation: rot,
        page_id: pageId || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sticker saved!");
      qc.invalidateQueries({ queryKey: ["stickers", relationshipId] });
      setFile(null);
      closeSheet();
    },
    onError: (e: any) => {
      toast.error(e?.message || "Failed to save sticker");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  return (
    <div className="space-y-4">
      {!file ? (
        <label className="relative flex flex-col items-center justify-center border border-dashed border-foreground/25 bg-white/40 hover:bg-white/50 transition-all rounded-2xl p-8 cursor-pointer text-center group overflow-hidden">
          <Upload
            size={22}
            className="text-foreground/45 mb-2 group-hover:scale-110 transition-transform"
          />
          <span className="text-xs font-semibold text-foreground/75">Upload photo for sticker</span>
          <span className="text-[10px] text-muted-foreground mt-1">
            Smart background removal & custom touch-up tools
          </span>
          {/* Use sr-only instead of hidden for iOS Safari mobile compatibility */}
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="sr-only"
          />
        </label>
      ) : (
        <div className="space-y-4">
          {/* Mode Selector */}
          <div className="flex items-center justify-between bg-white/40 p-1.5 rounded-2xl border border-white/50 text-xs">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider pl-2">
              Cut Mode:
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setMode("exterior")}
                className={`px-3 py-1 rounded-xl font-semibold transition-all text-[11px] ${
                  mode === "exterior"
                    ? "bg-white shadow-sm text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Smart Outer (Protects Inner)
              </button>
              <button
                onClick={() => setMode("global")}
                className={`px-3 py-1 rounded-xl font-semibold transition-all text-[11px] ${
                  mode === "global"
                    ? "bg-white shadow-sm text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All Colors
              </button>
            </div>
          </div>

          {/* Canvas Interactive Studio */}
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-white/40 bg-[radial-gradient(#e5e7eb_1.5px,transparent_1.5px)] [background-size:16px_16px] bg-slate-50 flex items-center justify-center p-2 touch-none">
            {processing && (
              <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-xs flex flex-col items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Processing sticker silhouette...
              </div>
            )}
            <canvas
              ref={previewCanvasRef}
              onMouseDown={handleCanvasInteractionStart}
              onMouseMove={handleCanvasInteractionMove}
              onMouseUp={handleCanvasInteractionEnd}
              onTouchStart={handleCanvasInteractionStart}
              onTouchMove={handleCanvasInteractionMove}
              onTouchEnd={handleCanvasInteractionEnd}
              className="max-h-full max-w-full object-contain cursor-crosshair drop-shadow-[0_6px_12px_rgba(0,0,0,0.15)]"
            />
          </div>

          {/* Interactive Touch Tools Bar */}
          <div className="flex items-center justify-between gap-1.5 bg-white/50 backdrop-blur-md p-1.5 rounded-2xl border border-white/60 shadow-sm">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTool("wand")}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all ${
                  activeTool === "wand"
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted-foreground hover:bg-white/60"
                }`}
                title="Tap any background spot to erase it"
              >
                <Wand2 size={12} /> Magic Tap
              </button>
              <button
                type="button"
                onClick={() => setActiveTool("restore")}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all ${
                  activeTool === "restore"
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted-foreground hover:bg-white/60"
                }`}
                title="Draw over broken areas to restore original photo"
              >
                <Paintbrush size={12} /> Restore
              </button>
              <button
                type="button"
                onClick={() => setActiveTool("erase")}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all ${
                  activeTool === "erase"
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted-foreground hover:bg-white/60"
                }`}
                title="Draw manually to erase background"
              >
                <Eraser size={12} /> Eraser
              </button>
            </div>

            <button
              type="button"
              disabled={history.length <= 1}
              onClick={handleUndo}
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-[11px] font-semibold text-foreground/70 hover:bg-white/60 disabled:opacity-30 transition-all"
              title="Undo last touch-up"
            >
              <Undo2 size={12} /> Undo
            </button>
          </div>

          {/* Adjusters & Sliders */}
          <div className="space-y-3 pt-1">
            {/* Brush Size for Restore/Eraser */}
            {activeTool !== "wand" && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <span>Brush Size</span>
                  <span>{brushSize}px</span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="48"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-full h-1.5 bg-white/40 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
            )}

            {/* Tolerance Adjuster */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                <span className="flex items-center gap-1">
                  <Sliders size={10} /> Cut Sensitivity
                </span>
                <span>{tolerance}</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={tolerance}
                onChange={(e) => setTolerance(Number(e.target.value))}
                className="w-full h-1.5 bg-white/40 rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>

            {/* Border Thickness */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                <span className="flex items-center gap-1">
                  <Sliders size={10} /> Border Thickness
                </span>
                <span>{outlineSize}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="24"
                value={outlineSize}
                onChange={(e) => setOutlineSize(Number(e.target.value))}
                className="w-full h-1.5 bg-white/40 rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>

            {/* Outline Color Palette Selection */}
            {outlineSize > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Border Color
                </div>
                <div className="flex gap-2">
                  {OUTLINE_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setOutlineColor(c.value)}
                      className={`h-7 w-7 rounded-full border-2 shadow-sm transition-all flex items-center justify-center ${
                        outlineColor === c.value ? "border-primary scale-110" : "border-white/60"
                      }`}
                      style={{ background: c.value }}
                      title={c.label}
                    >
                      {outlineColor === c.value && <Check size={12} className="text-foreground/80" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setFile(null)}
              className="flex-1 py-2.5 rounded-full border border-white/60 bg-white/40 hover:bg-white/60 text-xs font-semibold text-foreground/70 transition-all active:scale-95"
            >
              Clear
            </button>
            <PrimaryButton
              disabled={uploadSticker.isPending || processing}
              onClick={() => uploadSticker.mutate()}
            >
              Save Sticker
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  );
}
