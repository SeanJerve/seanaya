import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { uploadImage } from "@/lib/storage";
import { removeBackgroundImage } from "@/lib/background-remover";
import { PrimaryButton } from "./form-ui";
import { Sparkles, Upload, Sliders } from "lucide-react";
import { useAppStore } from "@/features/app/store";

const OUTLINE_COLORS = [
  { value: "#ffffff", label: "White" },
  { value: "#F8BBD0", label: "Pink" },
  { value: "#B3E5FC", label: "Blue" },
  { value: "#FFF9C4", label: "Yellow" },
  { value: "#D1C4E9", label: "Purple" },
  { value: "#C8E6C9", label: "Green" },
];

export function AddStickerSheet({ relationshipId, pageId }: { relationshipId: string; pageId?: string }) {
  const { user } = useUser();
  const qc = useQueryClient();
  const { closeSheet } = useAppStore();

  const [file, setFile] = useState<File | null>(null);
  const [tolerance, setTolerance] = useState(42);
  const [outlineColor, setOutlineColor] = useState("#ffffff");
  const [outlineSize, setOutlineSize] = useState(10);
  const [processing, setProcessing] = useState(false);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);

  // Re-run background removal when parameters change
  useEffect(() => {
    if (!file) {
      setProcessedBlob(null);
      setProcessedUrl(null);
      return;
    }

    let active = true;
    setProcessing(true);

    removeBackgroundImage(file, tolerance, outlineColor, outlineSize)
      .then((blob) => {
        if (!active) return;
        setProcessedBlob(blob);
        if (processedUrl) URL.revokeObjectURL(processedUrl);
        setProcessedUrl(URL.createObjectURL(blob));
        setProcessing(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error("BG removal & outline error:", err);
        toast.error("Failed to process drawing");
        setProcessing(false);
      });

    return () => {
      active = false;
    };
  }, [file, tolerance, outlineColor, outlineSize]);

  // Upload sticker mutation
  const uploadSticker = useMutation({
    mutationFn: async () => {
      if (!user || !processedBlob) return;
      const stickerId = crypto.randomUUID();

      // Start the sticker placement in the center of the board with a slight random rotation
      const x = 30 + Math.random() * 40;
      const y = 30 + Math.random() * 30;
      const rot = (Math.random() - 0.5) * 20;

      // Upload processed transparent PNG blob with die-cut border outline
      const { path, url } = await uploadImage(
        "stickers",
        relationshipId,
        processedBlob,
        `sticker_${stickerId}`
      );

      // Insert sticker record
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
      toast.success("Sticker saved to pad!");
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
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-yellow-500 animate-pulse" />
        <h4 className="text-sm font-semibold text-foreground/80">Die-Cut Sticker Maker</h4>
      </div>

      {!file ? (
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/60 bg-white/20 hover:bg-white/30 transition-all rounded-2xl p-6 cursor-pointer text-center group">
          <Upload size={24} className="text-foreground/45 mb-2 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-semibold text-foreground/70">Upload Doodle / Screenshot</span>
          <span className="text-[9px] text-muted-foreground mt-0.5">We'll automatically extract and trace it</span>
          <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        </label>
      ) : (
        <div className="space-y-4">
          {/* Live Preview Pad */}
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-white/40 bg-[radial-gradient(#e5e7eb_1.5px,transparent_1.5px)] [background-size:16px_16px] bg-slate-50 flex items-center justify-center p-4">
            {processing ? (
              <div className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Creating custom outline...
              </div>
            ) : processedUrl ? (
              <img
                src={processedUrl}
                alt="Sticker Preview"
                className="max-h-full max-w-full object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.15)] animate-in fade-in zoom-in-95 duration-200"
              />
            ) : null}
          </div>

          {/* Adjuster controls */}
          <div className="space-y-3.5 pt-1">
            {/* Tolerance Adjuster */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                <span className="flex items-center gap-1"><Sliders size={10} /> Background Cut Tolerance</span>
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

            {/* Outline Size Adjuster */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                <span className="flex items-center gap-1"><Sliders size={10} /> Sticker Border Thickness</span>
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
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Sticker Border Color
                </div>
                <div className="flex gap-2">
                  {OUTLINE_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setOutlineColor(c.value)}
                      className={`h-7 w-7 rounded-full border-2 shadow-sm transition-all hover:scale-110 active:scale-95 ${
                        outlineColor === c.value ? "border-primary scale-110" : "border-white/60"
                      }`}
                      style={{ background: c.value }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setFile(null)}
              className="flex-1 py-2.5 rounded-full border border-white/60 bg-white/40 hover:bg-white/60 text-xs font-semibold text-foreground/70 transition-all active:scale-95"
            >
              Clear
            </button>
            <PrimaryButton
              disabled={uploadSticker.isPending || processing || !processedBlob}
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
