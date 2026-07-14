import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/features/app/store";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Plus, Trash2, LayoutGrid } from "lucide-react";

type Sticker = {
  id: string;
  image_url: string;
  image_path: string;
  pos_x: number | null;
  pos_y: number | null;
  rotation: number | null;
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
  const { openSheet, confirm } = useAppStore();
  const boardRef = useRef<HTMLDivElement>(null);
  const [hoveredSticker, setHoveredSticker] = useState<string | null>(null);

  // Fetch stickers
  const { data: stickers = [] } = useQuery({
    queryKey: ["stickers", relationshipId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stickers")
        .select("id,image_url,image_path,pos_x,pos_y,rotation,created_at")
        .eq("relationship_id", relationshipId);
      if (error) throw error;
      return data as Sticker[];
    },
  });

  // Fetch relationship background preference
  const { data: rel } = useQuery({
    queryKey: ["relationship", relationshipId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("relationships")
        .select("sticker_pad_bg")
        .eq("id", relationshipId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const activeBg = PAD_BACKGROUNDS.find((b) => b.key === rel?.sticker_pad_bg) || PAD_BACKGROUNDS[0];

  // Update background preference
  const updateBg = useMutation({
    mutationFn: async (bgKey: string) => {
      const { error } = await supabase
        .from("relationships")
        .update({ sticker_pad_bg: bgKey })
        .eq("id", relationshipId);
      if (error) throw error;
    },
    onSuccess: (_, bgKey) => {
      qc.invalidateQueries({ queryKey: ["relationship", relationshipId] });
      toast.success(`Sticker pad style set to ${bgKey}`);
    },
    onError: (e: any) => toast.error(e?.message || "Failed to update background"),
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
      toast.error("Could not move sticker");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stickers", relationshipId] });
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
    onError: (e: any) => toast.error("Failed to delete sticker"),
  });

  return (
    <div className="relative min-h-[calc(100vh-140px)] w-full overflow-hidden flex flex-col">
      {/* Pad Header / Controls bar */}
      <div className="px-5 py-3 flex items-center justify-between border-b border-white/30 bg-white/20 backdrop-blur-xl z-20 shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/70">
          <LayoutGrid size={14} /> Drag & arrange your stickers
        </div>

        {/* Background selectors */}
        <div className="flex items-center gap-1.5">
          {PAD_BACKGROUNDS.map((b) => (
            <button
              key={b.key}
              onClick={() => updateBg.mutate(b.key)}
              className={`h-5 w-5 rounded-full border shadow-sm transition-all hover:scale-110 active:scale-95 ${
                rel?.sticker_pad_bg === b.key
                  ? "ring-2 ring-primary ring-offset-1 scale-110"
                  : "border-white/50"
              } ${b.btnStyle}`}
              title={`Pad: ${b.label}`}
            />
          ))}
        </div>
      </div>

      {/* Draggable Board Pad Area */}
      <div
        ref={boardRef}
        className={`flex-1 relative w-full overflow-hidden select-none cursor-default transition-colors duration-500 min-h-[480px] pb-32 ${activeBg.bgClass}`}
        onDragOver={(e) => e.preventDefault()}
      >
        {stickers.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center pointer-events-none">
            <div className="text-sm font-medium text-foreground/60">Your Sticker Pad is empty.</div>
            <p className="mt-1 text-xs text-muted-foreground max-w-xs">
              Upload doodle screenshots or images to extract and trace them!
            </p>
          </div>
        ) : (
          stickers.map((s) => {
            const px = s.pos_x ?? 50;
            const py = s.pos_y ?? 40;
            const rot = s.rotation ?? 0;

            return (
              <motion.div
                key={`${s.id}-${px.toFixed(2)}-${py.toFixed(2)}`}
                drag
                dragMomentum={false}
                dragElastic={0}
                onDragEnd={(e, info) => {
                  const rect = boardRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  
                  // Calculate absolute percentage bounds inside the canvas board
                  let x = ((info.point.x - rect.left) / rect.width) * 100;
                  let y = ((info.point.y - rect.top) / rect.height) * 100;
                  
                  // Keep within bounds
                  x = Math.max(5, Math.min(95, x));
                  y = Math.max(5, Math.min(85, y));
                  
                  updatePosition.mutate({ id: s.id, pos_x: x, pos_y: y });
                }}
                className="absolute touch-none select-none"
                style={{
                  left: `${px}%`,
                  top: `${py}%`,
                  x: "-50%",
                  y: "-50%",
                  rotate: rot,
                  zIndex: hoveredSticker === s.id ? 40 : 10,
                }}
                onMouseEnter={() => setHoveredSticker(s.id)}
                onMouseLeave={() => setHoveredSticker(null)}
              >
                {/* Sticker frame wrapper */}
                <div className="relative group p-2">
                  <img
                    src={s.image_url}
                    alt="Sticker"
                    className="h-24 w-24 object-contain drop-shadow-[0_5px_8px_rgba(0,0,0,0.18)] select-none pointer-events-none hover:scale-[1.04] transition-all"
                  />

                  {/* Absolute Trash Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      confirm({
                        title: "Delete sticker?",
                        message: "Are you sure you want to permanently remove this sticker from your pad?",
                        onConfirm: () => deleteSticker.mutate(s),
                      });
                    }}
                    className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 transition-all scale-75 group-hover:scale-100"
                    title="Delete sticker"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Floating Add Sticker Button */}
      <button
        onClick={() => openSheet("add-sticker")}
        className="fixed bottom-24 right-5 z-20 flex items-center gap-2 rounded-full border border-white/50 bg-white/70 backdrop-blur-2xl px-5 py-3 text-sm shadow-[0_10px_30px_-10px_rgba(80,110,160,0.4)]"
      >
        <Plus size={16} /> Add sticker
      </button>
    </div>
  );
}
