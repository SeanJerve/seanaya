import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { uploadImage } from "@/lib/storage";
import {
  canvasToBlob,
  clearRegion,
  cutout,
  finishSticker,
  loadToCanvas,
  type CutMode,
  type StickerEffect,
} from "@/lib/sticker-maker";
import { FormStack, Group, PrimaryButton } from "./form-ui";
import { Check, Eraser, ImagePlus, Paintbrush, Plus, Undo2, Wand2, X } from "lucide-react";
import { useAppStore } from "@/features/app/store";

const OUTLINE_COLORS = [
  { value: "#ffffff", label: "White" },
  { value: "#F8BBD0", label: "Pink" },
  { value: "#B3E5FC", label: "Blue" },
  { value: "#FFF9C4", label: "Yellow" },
  { value: "#D1C4E9", label: "Purple" },
  { value: "#C8E6C9", label: "Green" },
];
const BORDERS = [
  { label: "None", size: 0 },
  { label: "Thin", size: 6 },
  { label: "Classic", size: 10 },
  { label: "Thick", size: 15 },
];
const EFFECTS: { id: StickerEffect; label: string }[] = [
  { id: "clean", label: "Clean" },
  { id: "shadow", label: "Shadow" },
  { id: "glow", label: "Glow" },
];
const MAX_BATCH = 20;

type Tool = "wand" | "restore" | "erase";
type Item = {
  id: string;
  raw: HTMLCanvasElement;
  work: HTMLCanvasElement;
  mode: CutMode;
  tolerance: number;
  thumb: string | null;
};

const uid = () => Math.random().toString(36).slice(2, 10);
const tick = () => new Promise((r) => setTimeout(r, 0));

/**
 * Sticker maker. Pick one or many photos: each is cut out automatically, then one shared
 * look (border, colour, effect) is applied to all. Any single one can be touched up.
 */
export function AddStickerSheet({
  relationshipId,
  pageId,
}: {
  relationshipId: string;
  pageId?: string;
}) {
  const { user } = useUser();
  const qc = useQueryClient();
  const { closeSheet, activeStickerPageId } = useAppStore();
  const targetPageId = pageId ?? activeStickerPageId;

  const [items, setItems] = useState<Item[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(0); // photos still being cut
  const [outlineColor, setOutlineColor] = useState("#ffffff");
  const [outlineSize, setOutlineSize] = useState(10);
  const [effect, setEffect] = useState<StickerEffect>("shadow");
  const [tool, setTool] = useState<Tool>("wand");
  const [brush, setBrush] = useState(18);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [saving, setSaving] = useState<{ done: number; total: number } | null>(null);
  const [editVersion, setEditVersion] = useState(0);

  const editorRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const selected = items.find((i) => i.id === selectedId) ?? null;
  const look = { outlineColor, outlineSize, effect };

  // ── Add photos: each one is cut out right away ──
  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, Math.max(0, MAX_BATCH - items.length));
    if (files.length > list.length) toast(`Up to ${MAX_BATCH} at a time`);
    setLoading((n) => n + list.length);
    for (const f of list) {
      try {
        await tick();
        const raw = await loadToCanvas(f);
        const item: Item = {
          id: uid(),
          raw,
          work: cutout(raw, 42, "exterior"),
          mode: "exterior",
          tolerance: 42,
          thumb: null,
        };
        item.thumb = finishSticker(item.work, look).toDataURL("image/png");
        setItems((prev) => [...prev, item]);
        setSelectedId((cur) => cur ?? item.id);
      } catch {
        toast.error(`${f.name || "A photo"} couldn't be opened`);
      } finally {
        setLoading((n) => n - 1);
      }
    }
  };

  // ── The shared look changed: refresh every preview ──
  const lookKey = `${outlineColor}|${outlineSize}|${effect}`;
  useEffect(() => {
    let alive = true;
    (async () => {
      for (const it of items) {
        await tick();
        if (!alive) return;
        const thumb = finishSticker(it.work, look).toDataURL("image/png");
        setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, thumb } : p)));
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookKey]);

  // ── Editor: show the selected cut-out ──
  const drawEditor = useCallback(() => {
    const c = editorRef.current;
    if (!c || !selected) return;
    c.width = selected.work.width;
    c.height = selected.work.height;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(selected.work, 0, 0);
  }, [selected]);
  useEffect(() => {
    drawEditor();
  }, [drawEditor, editVersion]);
  useEffect(() => {
    if (!selected) return;
    const ctx = selected.work.getContext("2d", { willReadFrequently: true })!;
    setHistory([ctx.getImageData(0, 0, selected.work.width, selected.work.height)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const refreshThumb = (id: string) => {
    setItems((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, thumb: finishSticker(p.work, look).toDataURL("image/png") } : p,
      ),
    );
  };

  const recut = (patch: Partial<Pick<Item, "mode" | "tolerance">>) => {
    if (!selected) return;
    const mode = patch.mode ?? selected.mode;
    const tolerance = patch.tolerance ?? selected.tolerance;
    const work = cutout(selected.raw, tolerance, mode);
    setItems((prev) =>
      prev.map((p) =>
        p.id === selected.id
          ? { ...p, mode, tolerance, work, thumb: finishSticker(work, look).toDataURL("image/png") }
          : p,
      ),
    );
    const ctx = work.getContext("2d", { willReadFrequently: true })!;
    setHistory([ctx.getImageData(0, 0, work.width, work.height)]);
    setEditVersion((v) => v + 1);
  };

  const pushHistory = () => {
    if (!selected) return;
    const ctx = selected.work.getContext("2d", { willReadFrequently: true })!;
    const snap = ctx.getImageData(0, 0, selected.work.width, selected.work.height);
    setHistory((h) => [...h.slice(-10), snap]);
  };
  const undo = () => {
    if (!selected || history.length <= 1) return;
    const next = history.slice(0, -1);
    selected.work
      .getContext("2d", { willReadFrequently: true })!
      .putImageData(next[next.length - 1], 0, 0);
    setHistory(next);
    setEditVersion((v) => v + 1);
    refreshThumb(selected.id);
  };

  const toWork = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = editorRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: Math.round(((e.clientX - r.left) / r.width) * c.width),
      y: Math.round(((e.clientY - r.top) / r.height) * c.height),
      scale: c.width / r.width,
    };
  };
  const paint = (x: number, y: number, scale: number) => {
    if (!selected) return;
    const ctx = selected.work.getContext("2d", { willReadFrequently: true })!;
    const radius = (brush / 2) * scale;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    if (tool === "erase") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fill();
    } else {
      ctx.clip();
      ctx.drawImage(selected.raw, 0, 0);
    }
    ctx.restore();
    drawEditor();
  };
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!selected) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y, scale } = toWork(e);
    pushHistory();
    if (tool === "wand") {
      clearRegion(selected.work, x, y, selected.tolerance);
      drawEditor();
      refreshThumb(selected.id);
    } else {
      drawing.current = true;
      paint(x, y, scale);
    }
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const { x, y, scale } = toWork(e);
    paint(x, y, scale);
  };
  const onUp = () => {
    if (drawing.current && selected) refreshThumb(selected.id);
    drawing.current = false;
  };

  const remove = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((p) => p.id !== id);
      if (selectedId === id) setSelectedId(next[0]?.id ?? null);
      return next;
    });
  };

  // ── Save all ──
  const saveAll = async () => {
    if (!user || !items.length) return;
    setSaving({ done: 0, total: items.length });
    let saved = 0;
    const cols = Math.ceil(Math.sqrt(items.length));
    for (let i = 0; i < items.length; i++) {
      try {
        await tick();
        const blob = await canvasToBlob(finishSticker(items[i].work, look));
        const id = crypto.randomUUID();
        const { path, url } = await uploadImage("stickers", relationshipId, blob, `sticker_${id}`);
        // Spread a batch out in a loose grid so they don't land on top of each other.
        const col = i % cols;
        const row = Math.floor(i / cols);
        const span = Math.min(70, 18 * cols);
        const x =
          50 - span / 2 + (cols > 1 ? (col / (cols - 1)) * span : 0) + (Math.random() - 0.5) * 6;
        const y =
          22 +
          row * Math.min(22, 60 / Math.max(1, Math.ceil(items.length / cols))) +
          (Math.random() - 0.5) * 4;
        const { error } = await supabase.from("stickers").insert({
          relationship_id: relationshipId,
          created_by: user.id,
          image_url: url,
          image_path: path,
          pos_x: Math.max(8, Math.min(88, x)),
          pos_y: Math.max(8, Math.min(86, y)),
          rotation: (Math.random() - 0.5) * 18,
          page_id: targetPageId || null,
        });
        if (error) throw error;
        saved++;
      } catch {
        /* counted below */
      }
      setSaving({ done: i + 1, total: items.length });
    }
    qc.invalidateQueries({ queryKey: ["stickers", relationshipId] });
    setSaving(null);
    if (saved === items.length) {
      toast.success(saved === 1 ? "Sticker added" : `${saved} stickers added`);
      closeSheet();
    } else {
      toast.error(
        `${items.length - saved} couldn't be saved. Check your connection and try again.`,
      );
    }
  };

  const slider =
    "h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#dfe3f5] accent-[#7f9ef0]";
  const chip = (on: boolean) => `sn-pill h-10 shrink-0 px-4 text-[14px] ${on ? "sn-active" : ""}`;
  const tools = [
    { id: "wand" as const, label: "Tap to clear", icon: <Wand2 size={16} strokeWidth={1.8} /> },
    { id: "restore" as const, label: "Restore", icon: <Paintbrush size={16} strokeWidth={1.8} /> },
    { id: "erase" as const, label: "Erase", icon: <Eraser size={16} strokeWidth={1.8} /> },
  ];

  if (!items.length && !loading) {
    return (
      <FormStack>
        <label className="flex h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-[22px] border border-dashed border-[#c9cfee] bg-white/45 px-6 text-center transition hover:bg-white/70">
          <ImagePlus size={28} strokeWidth={1.5} className="text-[#5b6aa6]" />
          <span className="font-serif text-[20px] font-semibold text-sn-navy">Choose photos</span>
          <span className="text-[14px] text-sn-ink">
            Pick one or a whole batch. Backgrounds come off on their own.
          </span>
          {/* sr-only rather than hidden, for iOS Safari */}
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => addFiles(e.target.files)}
            className="sr-only"
          />
        </label>
      </FormStack>
    );
  }

  return (
    <FormStack>
      {/* Every sticker in this batch */}
      <div className="no-scrollbar -mx-1 flex gap-2.5 overflow-x-auto px-1 py-1.5">
        {items.map((it) => (
          <div key={it.id} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setSelectedId(it.id)}
              aria-label="Touch up this sticker"
              aria-pressed={it.id === selectedId}
              className={`grid h-[84px] w-[84px] place-items-center rounded-[18px] bg-[#f4f6fe] bg-[radial-gradient(#dfe3f5_1.2px,transparent_1.2px)] [background-size:12px_12px] p-1.5 transition ${
                it.id === selectedId ? "ring-[3px] ring-[#94b2f6]" : "ring-1 ring-white"
              }`}
            >
              {it.thumb && (
                <img src={it.thumb} alt="" className="max-h-full max-w-full object-contain" />
              )}
            </button>
            <button
              type="button"
              onClick={() => remove(it.id)}
              aria-label="Remove this one"
              className="absolute -right-1.5 -top-1.5 grid h-7 w-7 place-items-center rounded-full border border-white bg-white text-[#c2416c] shadow-[var(--shadow-pill)]"
            >
              <X size={14} strokeWidth={2.2} />
            </button>
          </div>
        ))}
        {Array.from({ length: loading }).map((_, i) => (
          <div
            key={`l${i}`}
            className="grid h-[84px] w-[84px] shrink-0 place-items-center rounded-[18px] bg-white/60"
          >
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#c9d8fd] border-t-[#7f9ef0]" />
          </div>
        ))}
        {items.length + loading < MAX_BATCH && (
          <label className="grid h-[84px] w-[84px] shrink-0 cursor-pointer place-items-center rounded-[18px] border border-dashed border-[#c9cfee] bg-white/45 text-[#5b6aa6] transition hover:bg-white/70">
            <Plus size={22} strokeWidth={1.8} />
            <span className="sr-only">Add more photos</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => addFiles(e.target.files)}
              className="sr-only"
            />
          </label>
        )}
      </div>

      {/* The look, for the whole batch */}
      <Group label={items.length > 1 ? `Look · all ${items.length}` : "Look"}>
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-0.5">
          {BORDERS.map((b) => (
            <button
              key={b.label}
              type="button"
              onClick={() => setOutlineSize(b.size)}
              className={chip(outlineSize === b.size)}
            >
              {b.label}
            </button>
          ))}
        </div>
        {outlineSize > 0 && (
          <div className="flex flex-wrap gap-2.5">
            {OUTLINE_COLORS.map((c) => {
              const on = outlineColor === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setOutlineColor(c.value)}
                  aria-label={`${c.label} border`}
                  aria-pressed={on}
                  className={`grid h-10 w-10 place-items-center rounded-full border-2 transition ${on ? "border-[#94b2f6] ring-2 ring-white" : "border-white"}`}
                  style={{ background: c.value }}
                >
                  {on && <Check size={16} strokeWidth={2.4} className="text-sn-navy" />}
                </button>
              );
            })}
          </div>
        )}
        <div className="flex gap-2">
          {EFFECTS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setEffect(f.id)}
              className={chip(effect === f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Group>

      {/* Touch up the selected one */}
      {selected && (
        <Group label="Touch up this one">
          <div className="relative flex aspect-[4/3] w-full touch-none items-center justify-center overflow-hidden rounded-[18px] bg-[#f4f6fe] bg-[radial-gradient(#dfe3f5_1.5px,transparent_1.5px)] [background-size:16px_16px] p-2">
            <canvas
              ref={editorRef}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              className="max-h-full max-w-full cursor-crosshair object-contain"
            />
          </div>
          <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1 py-0.5">
            {tools.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTool(t.id)}
                aria-pressed={tool === t.id}
                className={chip(tool === t.id)}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
            <button
              type="button"
              disabled={history.length <= 1}
              onClick={undo}
              className="sn-ghost h-10 shrink-0 px-3.5 text-[14px] disabled:opacity-40"
            >
              <Undo2 size={16} strokeWidth={1.8} /> Undo
            </button>
          </div>
          {tool !== "wand" && (
            <label className="block">
              <span className="text-[13px] text-sn-muted">Brush size</span>
              <input
                type="range"
                min="6"
                max="60"
                value={brush}
                onChange={(e) => setBrush(Number(e.target.value))}
                className={slider}
              />
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => recut({ mode: "exterior" })}
              className={chip(selected.mode === "exterior")}
            >
              Around the edges
            </button>
            <button
              type="button"
              onClick={() => recut({ mode: "global" })}
              className={chip(selected.mode === "global")}
            >
              Every matching colour
            </button>
          </div>
          <label className="block">
            <span className="text-[13px] text-sn-muted">How much background to take away</span>
            <input
              type="range"
              min="10"
              max="110"
              value={selected.tolerance}
              onChange={(e) =>
                setItems((prev) =>
                  prev.map((p) =>
                    p.id === selected.id ? { ...p, tolerance: Number(e.target.value) } : p,
                  ),
                )
              }
              onPointerUp={(e) =>
                recut({ tolerance: Number((e.target as HTMLInputElement).value) })
              }
              onKeyUp={(e) => recut({ tolerance: Number((e.target as HTMLInputElement).value) })}
              className={slider}
            />
          </label>
        </Group>
      )}

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={() => setItems([])}
          disabled={!!saving}
          className="sn-ghost h-12 px-5 text-[15px]"
        >
          Clear
        </button>
        <PrimaryButton
          disabled={!!saving || loading > 0 || !items.length}
          onClick={saveAll}
          className="flex-1"
        >
          {saving
            ? `Adding ${saving.done} of ${saving.total}…`
            : loading > 0
              ? "Cutting out…"
              : items.length === 1
                ? "Add sticker"
                : `Add all ${items.length} stickers`}
        </PrimaryButton>
      </div>
    </FormStack>
  );
}
