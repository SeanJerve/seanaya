import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { uploadImage } from "@/lib/storage";
import { removeBackgroundImage } from "@/lib/background-remover";
import { PrimaryButton } from "./form-ui";
import { Sparkles, Trash2, Upload, Sliders, Eye } from "lucide-react";
import { Lightbox } from "@/lib/Lightbox";
import { useAppStore } from "@/features/app/store";

type Sticker = {
  id: string;
  image_url: string;
  image_path: string;
  created_at: string;
};

const OUTLINE_COLORS = [
  { value: "#ffffff", label: "White" },
  { value: "#F8BBD0", label: "Pink" },
  { value: "#B3E5FC", label: "Blue" },
  { value: "#FFF9C4", label: "Yellow" },
  { value: "#D1C4E9", label: "Purple" },
  { value: "#C8E6C9", label: "Green" },
];

export function StickersSheet({ relationshipId }: { relationshipId: string }) {
  const { user } = useUser();
  const qc = useQueryClient();
  const { confirm } = useAppStore();

  const [file, setFile] = useState<File | null>(null);
  const [tolerance, setTolerance] = useState(42);
  const [outlineColor, setOutlineColor] = useState("#ffffff");
  const [outlineSize, setOutlineSize] = useState(10);
  const [processing, setProcessing] = useState(false);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Fetch stickers
  const { data: stickers = [], isLoading } = useQuery({
    queryKey: ["stickers", relationshipId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stickers")
        .select("id,image_url,image_path,created_at")
        .eq("relationship_id", relationshipId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Sticker[];
    },
  });

  // Re-run background removal and outline tracing when settings change
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

  // Upload processed sticker
  const uploadSticker = useMutation({
    mutationFn: async () => {
      if (!user || !processedBlob) return;
      const stickerId = crypto.randomUUID();

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
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sticker saved to pad! ✨");
      qc.invalidateQueries({ queryKey: ["stickers", relationshipId] });
      setFile(null);
    },
    onError: (e: any) => {
      toast.error(e?.message || "Failed to save sticker");
    },
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
      qc.invalidateQueries({ queryKey: ["stickers", relationshipId] });
    },
    onError: (e: any) => {
      toast.error("Failed to delete sticker");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  return (
    <div className="space-y-6">
      {/* ── STICKER CREATOR / UPLOADER ── */}
      <section className="rounded-3xl border border-white/40 bg-white/40 backdrop-blur-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-yellow-500 animate-spin duration-1000" />
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
            <div className="space-y-3.5 pt-2">
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
      </section>

      {/* ── STICKER COLLECTION PAD ── */}
      <section className="rounded-3xl border border-white/40 bg-white/40 backdrop-blur-xl p-5 space-y-4">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
          Your Sticker Pad ({stickers.length})
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-xs text-muted-foreground">Loading stickers...</div>
        ) : stickers.length === 0 ? (
          <div className="text-center py-10 text-xs text-muted-foreground italic bg-white/20 border border-dashed border-white/40 rounded-2xl">
            Sticker pad is empty. Make your first sticker above!
          </div>
        ) : (
          /* Notebook/Binder grid look */
          <div className="grid grid-cols-3 gap-3.5 p-3.5 bg-yellow-50/10 border border-white/30 rounded-2xl shadow-inner min-h-[220px] bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:12px_12px]">
            {stickers.map((s) => (
              <div
                key={s.id}
                className="group relative aspect-square rounded-2xl bg-white/10 hover:bg-white/30 transition-all flex items-center justify-center p-2 cursor-pointer border border-white/20 hover:scale-[1.05]"
                onClick={() => setLightbox(s.image_url)}
              >
                <img
                  src={s.image_url}
                  alt="Sticker"
                  loading="lazy"
                  className="max-h-full max-w-full object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.1)] group-hover:scale-105 transition-transform"
                />

                {/* View / Delete absolute overlays */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/10 backdrop-blur-[0.5px] rounded-2xl flex items-center justify-center gap-2 transition-all">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightbox(s.image_url);
                    }}
                    className="p-1.5 rounded-full bg-white/95 hover:bg-white text-foreground/75 hover:text-foreground shadow-sm transition-all"
                    title="View large"
                  >
                    <Eye size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      confirm({
                        title: "Delete sticker?",
                        message: "Are you sure you want to permanently remove this sticker from your pad?",
                        onConfirm: () => deleteSticker.mutate(s),
                      });
                    }}
                    className="p-1.5 rounded-full bg-white/95 hover:bg-red-500 hover:text-white text-foreground/75 shadow-sm transition-all"
                    title="Delete sticker"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
