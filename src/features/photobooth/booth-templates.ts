/**
 * Photo booth layouts and the PNG renderer.
 * A "shot" is one countdown: it holds your frame and your partner's, shown side by side.
 */

export type Shot = { a?: string; b?: string };

export type LayoutId = "strip" | "grid" | "polaroid";
export type StyleId = "paper" | "periwinkle" | "blush" | "midnight";

export const LAYOUTS: Record<LayoutId, { name: string; shots: number }> = {
  strip: { name: "Photo strip", shots: 4 },
  grid: { name: "Grid", shots: 4 },
  polaroid: { name: "Polaroid", shots: 1 },
};

export const STYLES: Record<StyleId, { name: string; bg: string; ink: string; sub: string; lily: boolean }> = {
  paper: { name: "Paper", bg: "#fbf8f4", ink: "#1f2a5c", sub: "#6b7397", lily: true },
  periwinkle: { name: "Periwinkle", bg: "#cdd9f8", ink: "#1f2a5c", sub: "#4a5687", lily: true },
  blush: { name: "Blush", bg: "#fbe3ec", ink: "#7d2e52", sub: "#a5577a", lily: true },
  midnight: { name: "Midnight", bg: "#1d2140", ink: "#f4f1ff", sub: "#b9bde0", lily: false },
};

export const FILTERS: { id: string; name: string; css: string }[] = [
  { id: "normal", name: "Natural", css: "none" },
  { id: "soft", name: "Soft", css: "brightness(1.06) saturate(1.08) contrast(0.96)" },
  { id: "warm", name: "Warm", css: "sepia(0.18) saturate(1.15) brightness(1.04)" },
  { id: "film", name: "Film", css: "contrast(1.08) saturate(0.85) sepia(0.12)" },
  { id: "mono", name: "Mono", css: "grayscale(1) contrast(1.1)" },
];

const imgCache = new Map<string, Promise<HTMLImageElement>>();
function loadImage(src: string) {
  if (!imgCache.has(src)) {
    imgCache.set(
      src,
      new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      }),
    );
  }
  return imgCache.get(src)!;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s;
  const sh = h / s;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

async function drawShot(
  ctx: CanvasRenderingContext2D,
  shot: Shot | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  filter: string,
  empty: string,
) {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.fillStyle = empty;
  ctx.fillRect(x, y, w, h);
  const frames = [shot?.a, shot?.b].filter(Boolean) as string[];
  ctx.filter = filter;
  if (frames.length === 1) {
    drawCover(ctx, await loadImage(frames[0]), x, y, w, h);
  } else if (frames.length === 2) {
    const gap = Math.round(w * 0.012);
    const half = (w - gap) / 2;
    drawCover(ctx, await loadImage(frames[0]), x, y, half, h);
    drawCover(ctx, await loadImage(frames[1]), x + half + gap, y, half, h);
  }
  ctx.restore();
}

export async function renderBooth({
  layout,
  style,
  filterId,
  shots,
  caption,
  names,
}: {
  layout: LayoutId;
  style: StyleId;
  filterId: string;
  shots: Shot[];
  caption: string;
  names: string;
}): Promise<HTMLCanvasElement> {
  if (typeof document !== "undefined" && document.fonts) {
    await Promise.all([
      document.fonts.load('600 48px "Crimson Pro"'),
      document.fonts.load('600 24px "Nunito Sans"'),
      document.fonts.load('500 56px "Caveat"'),
    ]).catch(() => {});
  }
  const st = STYLES[style];
  const filter = FILTERS.find((f) => f.id === filterId)?.css ?? "none";
  const empty = style === "midnight" ? "#2b3058" : "rgba(31,42,92,0.08)";
  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const line = caption.trim() || `${names} · ${date}`;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  let footerTop = 0;

  if (layout === "strip") {
    const W = 600, pad = 32, gap = 18, cw = W - pad * 2, ch = Math.round(cw * 0.75), footer = 190;
    canvas.width = W;
    canvas.height = pad + 4 * ch + 3 * gap + footer;
    ctx.fillStyle = st.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 4; i++) await drawShot(ctx, shots[i], pad, pad + i * (ch + gap), cw, ch, 10, filter, empty);
    footerTop = pad + 4 * ch + 3 * gap;
    ctx.fillStyle = st.ink;
    ctx.textAlign = "center";
    ctx.font = '600 50px "Crimson Pro", Georgia, serif';
    ctx.fillText("Seanaya", W / 2, footerTop + 86);
    ctx.fillStyle = st.sub;
    ctx.font = '600 22px "Nunito Sans", system-ui, sans-serif';
    ctx.fillText(line, W / 2, footerTop + 128, W - 80);
  } else if (layout === "grid") {
    const W = 1200, pad = 44, gap = 24, cw = (W - pad * 2 - gap) / 2, footer = 190;
    canvas.width = W;
    canvas.height = pad + 2 * cw + gap + footer;
    ctx.fillStyle = st.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 4; i++) {
      const col = i % 2, row = Math.floor(i / 2);
      await drawShot(ctx, shots[i], pad + col * (cw + gap), pad + row * (cw + gap), cw, cw, 14, filter, empty);
    }
    footerTop = pad + 2 * cw + gap;
    ctx.fillStyle = st.ink;
    ctx.textAlign = "left";
    ctx.font = '600 60px "Crimson Pro", Georgia, serif';
    ctx.fillText("Seanaya", pad + 6, footerTop + 100);
    ctx.fillStyle = st.sub;
    ctx.font = '600 26px "Nunito Sans", system-ui, sans-serif';
    ctx.fillText(line, pad + 8, footerTop + 144, W - pad * 2 - 260);
  } else {
    const W = 900, pad = 54, cw = W - pad * 2, footer = 250;
    canvas.width = W;
    canvas.height = pad + cw + footer;
    ctx.fillStyle = st.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await drawShot(ctx, shots[0], pad, pad, cw, cw, 4, filter, empty);
    footerTop = pad + cw;
    ctx.fillStyle = st.ink;
    ctx.textAlign = "center";
    ctx.font = '500 64px "Caveat", "Segoe Print", cursive';
    ctx.fillText(caption.trim() || names, W / 2, footerTop + 118, W - 120);
    ctx.fillStyle = st.sub;
    ctx.font = '600 24px "Nunito Sans", system-ui, sans-serif';
    ctx.fillText(date, W / 2, footerTop + 166);
  }

  if (st.lily) {
    try {
      const lily = await loadImage("/lily2.png");
      const size = layout === "strip" ? 150 : layout === "grid" ? 210 : 170;
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.translate(canvas.width - size * 0.62, canvas.height - size * 0.5);
      ctx.rotate(-0.42);
      ctx.drawImage(lily, -size / 2, -size / 2, size, size);
      ctx.restore();
    } catch {
      /* decoration only */
    }
  }
  return canvas;
}

export function downloadCanvas(canvas: HTMLCanvasElement, name: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, "image/png");
}
