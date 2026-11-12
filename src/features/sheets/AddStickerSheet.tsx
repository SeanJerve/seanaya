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
import { FormStack, Group, PrimaryButton } from "./form-ui";
import { ImagePlus, Wand2, Paintbrush, Eraser, Undo2, Check } from "lucide-react";
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
  const getCanvasCoords = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
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

  const slider =
    "h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#dfe3f5] accent-[#7f9ef0]";
  const tools = [
    { id: "wand" as const, label: "Magic tap", icon: <Wand2 size={16} strokeWidth={1.8} /> },
    { id: "restore" as const, label: "Restore", icon: <Paintbrush size={16} strokeWidth={1.8} /> },
    { id: "erase" as const, label: "Erase", icon: <Eraser size={16} strokeWidth={1.8} /> },
  ];

  return (
    <FormStack>
      {!file ? (
        <label className="flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-[18px] border border-dashed border-[#c9cfee] bg-white/45 text-[14px] font-semibold text-sn-ink transition hover:bg-white/70">
          <ImagePlus size={24} strokeWidth={1.6} className="text-[#5b6aa6]" />
          Choose a photo
          {/* sr-only rather than hidden, for iOS Safari */}
          <input type="file" accept="image/*" onChange={handleFileChange} className="sr-only" />
        </label>
      ) : (
        <>
          <Group label="Cut">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMode("exterior")}
                aria-pressed={mode === "exterior"}
                className={`sn-pill h-10 px-4 text-[14px] ${mode === "exterior" ? "sn-active" : ""}`}
              >
                Outline only
              </button>
              <button
                type="button"
                onClick={() => setMode("global")}
                aria-pressed={mode === "global"}
                className={`sn-pill h-10 px-4 text-[14px] ${mode === "global" ? "sn-active" : ""}`}
              >
                Every matching colour
              </button>
            </div>
          </Group>

          <div className="relative flex aspect-video w-full touch-none items-center justify-center overflow-hidden rounded-[18px] bg-[#f4f6fe] bg-[radial-gradient(#dfe3f5_1.5px,transparent_1.5px)] [background-size:16px_16px] p-2">
            {processing && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/70 text-[14px] text-sn-ink backdrop-blur-xs">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#c9d8fd] border-t-[#7f9ef0]" />
                Cutting out…
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
              className="max-h-full max-w-full cursor-crosshair object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.15)]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {tools.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTool(t.id)}
                aria-pressed={activeTool === t.id}
                className={`sn-pill h-10 px-3.5 text-[14px] ${activeTool === t.id ? "sn-active" : ""}`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
            <button
              type="button"
              disabled={history.length <= 1}
              onClick={handleUndo}
              className="sn-ghost ml-auto h-10 px-3.5 text-[14px] disabled:opacity-40"
            >
              <Undo2 size={16} strokeWidth={1.8} /> Undo
            </button>
          </div>

          {activeTool !== "wand" && (
            <Group label={`Brush · ${brushSize}px`}>
              <input type="range" min="6" max="48" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className={slider} />
            </Group>
          )}
          <Group label={`Sensitivity · ${tolerance}`}>
            <input type="range" min="10" max="100" value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))} className={slider} />
          </Group>
          <Group label={`Border · ${outlineSize}px`}>
            <input type="range" min="0" max="24" value={outlineSize} onChange={(e) => setOutlineSize(Number(e.target.value))} className={slider} />
          </Group>

          {outlineSize > 0 && (
            <Group label="Border colour">
              <div className="flex flex-wrap gap-2.5">
                {OUTLINE_COLORS.map((c) => {
                  const on = outlineColor === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setOutlineColor(c.value)}
                      aria-label={c.label}
                      aria-pressed={on}
                      title={c.label}
                      className={`grid h-10 w-10 place-items-center rounded-full border-2 transition ${on ? "border-[#94b2f6] ring-2 ring-white" : "border-white"}`}
                      style={{ background: c.value }}
                    >
                      {on && <Check size={16} strokeWidth={2.4} className="text-sn-navy" />}
                    </button>
                  );
                })}
              </div>
            </Group>
          )}

          <div className="flex gap-2.5">
            <button type="button" onClick={() => setFile(null)} className="sn-ghost h-12 px-6 text-[15px]">
              Start over
            </button>
            <PrimaryButton disabled={uploadSticker.isPending || processing} onClick={() => uploadSticker.mutate()} className="flex-1">
              Save sticker
            </PrimaryButton>
          </div>
        </>
      )}
    </FormStack>
  );
}
