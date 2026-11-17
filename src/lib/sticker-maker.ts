/**
 * Turns a photo or screenshot into a sticker: finds the background, cuts it away with
 * soft edges, drops stray specks, trims to the drawing, then adds a border and an effect.
 * Everything runs on a canvas in the browser; no upload until you save.
 */

export type CutMode = "exterior" | "global";
export type StickerEffect = "clean" | "shadow" | "glow";

// Works at this size: plenty for a sticker, fast enough on phones.
const WORK_SIDE = 900;
// Saved stickers are at most this big (they show at ~100px on the pad).
const FINAL_SIDE = 640;

export async function loadToCanvas(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("unsupported"));
      i.src = url;
    });
    const scale = Math.min(1, WORK_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * scale));
    c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The background colour: the most common colour around the edges (ignores app bars and specks). */
function borderColor(d: Uint8ClampedArray, w: number, h: number): [number, number, number] {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  const add = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    if (d[i + 3] < 200) return;
    const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++;
    e.r += d[i];
    e.g += d[i + 1];
    e.b += d[i + 2];
    buckets.set(key, e);
  };
  const step = Math.max(1, Math.floor(Math.min(w, h) / 200));
  for (let x = 0; x < w; x += step) {
    add(x, 0);
    add(x, 1);
    add(x, h - 1);
    add(x, h - 2);
  }
  for (let y = 0; y < h; y += step) {
    add(0, y);
    add(1, y);
    add(w - 1, y);
    add(w - 2, y);
  }
  let best = { n: 0, r: 255, g: 255, b: 255 };
  buckets.forEach((e) => {
    if (e.n > best.n) best = e;
  });
  return best.n ? [best.r / best.n, best.g / best.n, best.b / best.n] : [255, 255, 255];
}

/**
 * Removes the background in place.
 * exterior: only background connected to the edges (keeps white inside the drawing).
 * global: every pixel close to the background colour.
 */
export function cutBackground(img: ImageData, tolerance: number, mode: CutMode) {
  const d = img.data;
  const w = img.width;
  const h = img.height;
  const [br, bg, bb] = borderColor(d, w, h);
  const n = w * h;
  const dist = new Float32Array(n);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    const dr = d[i] - br;
    const dg = d[i + 1] - bg;
    const db = d[i + 2] - bb;
    dist[p] = Math.sqrt(dr * dr + dg * dg + db * db);
  }
  const bgMask = new Uint8Array(n); // 1 = background

  if (mode === "global") {
    for (let p = 0; p < n; p++) if (dist[p] < tolerance) bgMask[p] = 1;
  } else {
    const q = new Int32Array(n);
    let head = 0;
    let tail = 0;
    const seed = (p: number) => {
      if (!bgMask[p] && dist[p] < tolerance) {
        bgMask[p] = 1;
        q[tail++] = p;
      }
    };
    for (let x = 0; x < w; x++) {
      seed(x);
      seed((h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
      seed(y * w);
      seed(y * w + w - 1);
    }
    while (head < tail) {
      const p = q[head++];
      const x = p % w;
      if (x > 0) seed(p - 1);
      if (x < w - 1) seed(p + 1);
      if (p >= w) seed(p - w);
      if (p < n - w) seed(p + w);
    }
  }

  // Group what's left into separate pieces, then tidy up:
  // - tiny specks go,
  // - pieces stuck to the screenshot's edge (status bars, buttons) go, unless it's the drawing itself.
  const label = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);
  const sizes: number[] = [];
  const touches: boolean[] = [];
  for (let s0 = 0; s0 < n; s0++) {
    if (bgMask[s0] || label[s0] >= 0) continue;
    const id = sizes.length;
    let top = 0;
    let size = 0;
    let edge = false;
    stack[top++] = s0;
    label[s0] = id;
    while (top) {
      const p = stack[--top];
      size++;
      const x = p % w;
      if (x === 0 || x === w - 1 || p < w || p >= n - w) edge = true;
      if (x > 0 && !bgMask[p - 1] && label[p - 1] < 0) { label[p - 1] = id; stack[top++] = p - 1; }
      if (x < w - 1 && !bgMask[p + 1] && label[p + 1] < 0) { label[p + 1] = id; stack[top++] = p + 1; }
      if (p >= w && !bgMask[p - w] && label[p - w] < 0) { label[p - w] = id; stack[top++] = p - w; }
      if (p < n - w && !bgMask[p + w] && label[p + w] < 0) { label[p + w] = id; stack[top++] = p + w; }
    }
    sizes.push(size);
    touches.push(edge);
  }
  if (sizes.length) {
    let biggest = 0;
    for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[biggest]) biggest = i;
    const minIsland = Math.max(8, Math.round(n * 0.00005));
    const drop = sizes.map((sz, i) => i !== biggest && (sz <= minIsland || touches[i]));
    for (let p = 0; p < n; p++) if (label[p] >= 0 && drop[label[p]]) bgMask[p] = 1;
  }

  // Soft edges: pixels next to the background fade by how close they are to its colour.
  const soft = tolerance * 1.7;
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if (bgMask[p]) {
      d[i + 3] = 0;
      continue;
    }
    const x = p % w;
    const nearBg =
      (x > 0 && bgMask[p - 1]) ||
      (x < w - 1 && bgMask[p + 1]) ||
      (p >= w && bgMask[p - w]) ||
      (p < n - w && bgMask[p + w]);
    if (nearBg && dist[p] < soft) {
      const a = Math.max(0, Math.min(1, (dist[p] - tolerance * 0.6) / (soft - tolerance * 0.6)));
      d[i + 3] = Math.round(d[i + 3] * a);
    }
  }
}

/** A fresh cut-out of the original at the given settings. */
export function cutout(
  raw: HTMLCanvasElement,
  tolerance: number,
  mode: CutMode,
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = raw.width;
  c.height = raw.height;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(raw, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  cutBackground(data, tolerance, mode);
  ctx.putImageData(data, 0, 0);
  return c;
}

/** Tap-to-clear: removes the colour region connected to (x, y). */
export function clearRegion(canvas: HTMLCanvasElement, x: number, y: number, tolerance: number) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const w = img.width;
  const h = img.height;
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const s = (y * w + x) * 4;
  if (d[s + 3] === 0) return;
  const [tr, tg, tb] = [d[s], d[s + 1], d[s + 2]];
  const n = w * h;
  const seen = new Uint8Array(n);
  const q = new Int32Array(n);
  let head = 0;
  let tail = 0;
  q[tail++] = y * w + x;
  seen[y * w + x] = 1;
  while (head < tail) {
    const p = q[head++];
    d[p * 4 + 3] = 0;
    const px = p % w;
    for (const m of [
      px > 0 ? p - 1 : -1,
      px < w - 1 ? p + 1 : -1,
      p >= w ? p - w : -1,
      p < n - w ? p + w : -1,
    ]) {
      if (m < 0 || seen[m]) continue;
      const i = m * 4;
      if (d[i + 3] === 0) continue;
      const dr = d[i] - tr;
      const dg = d[i + 1] - tg;
      const db = d[i + 2] - tb;
      if (Math.sqrt(dr * dr + dg * dg + db * db) < tolerance) {
        seen[m] = 1;
        q[tail++] = m;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Crops away empty transparent margins. */
export function trim(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const { width: w, height: h } = canvas;
  const d = ctx.getImageData(0, 0, w, h).data;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return canvas;
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out
    .getContext("2d")!
    .drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/**
 * Border + effect, sized down for saving. Border thickness is relative to the sticker
 * (size 10 ≈ a classic die-cut border at sticker scale).
 */
export function finishSticker(
  work: HTMLCanvasElement,
  {
    outlineColor,
    outlineSize,
    effect,
  }: { outlineColor: string; outlineSize: number; effect: StickerEffect },
): HTMLCanvasElement {
  const t = trim(work);
  const scale = Math.min(1, FINAL_SIDE / Math.max(t.width, t.height));
  const sw = Math.max(1, Math.round(t.width * scale));
  const sh = Math.max(1, Math.round(t.height * scale));
  const border =
    outlineSize > 0 ? Math.round((outlineSize / 10) * Math.max(6, Math.max(sw, sh) * 0.028)) : 0;
  const fx = effect === "clean" ? 0 : Math.round(Math.max(sw, sh) * 0.06);
  const pad = border + fx + 4;

  const base = document.createElement("canvas");
  base.width = sw;
  base.height = sh;
  const bctx = base.getContext("2d")!;
  bctx.imageSmoothingQuality = "high";
  bctx.drawImage(t, 0, 0, sw, sh);

  // Solid silhouette for the border, grown round in every direction.
  const out = document.createElement("canvas");
  out.width = sw + pad * 2;
  out.height = sh + pad * 2;
  const ctx = out.getContext("2d")!;
  const shape = document.createElement("canvas");
  shape.width = out.width;
  shape.height = out.height;
  const sctx = shape.getContext("2d")!;
  if (border > 0) {
    const mask = document.createElement("canvas");
    mask.width = sw;
    mask.height = sh;
    const mctx = mask.getContext("2d")!;
    mctx.drawImage(base, 0, 0);
    mctx.globalCompositeOperation = "source-in";
    mctx.fillStyle = outlineColor;
    mctx.fillRect(0, 0, sw, sh);
    for (let r = border; r > 0; r -= Math.max(1, border / 3)) {
      const steps = Math.max(24, Math.round(r * 4));
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        sctx.drawImage(mask, pad + Math.cos(a) * r, pad + Math.sin(a) * r);
      }
    }
  }
  sctx.drawImage(base, pad, pad);

  if (effect === "shadow") {
    ctx.save();
    ctx.shadowColor = "rgba(40, 52, 110, 0.32)";
    ctx.shadowBlur = fx * 0.7;
    ctx.shadowOffsetY = fx * 0.35;
    ctx.drawImage(shape, 0, 0);
    ctx.restore();
  } else if (effect === "glow") {
    ctx.save();
    ctx.shadowColor = "rgba(244, 143, 186, 0.75)";
    ctx.shadowBlur = fx;
    ctx.drawImage(shape, 0, 0);
    ctx.drawImage(shape, 0, 0);
    ctx.restore();
  }
  ctx.drawImage(shape, 0, 0);
  return out;
}

export function canvasToBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("render failed"))), "image/png"),
  );
}
