/**
 * Advanced Client-Side Background Removal Engine & Canvas Utils.
 * Supports:
 * 1. Smart Exterior Flood Fill (BFS) to remove outer background without breaking inner white/light content.
 * 2. Global Chroma Key background removal.
 * 3. Point Flood Fill (Magic Tap / Wand) at specific coordinates.
 * 4. Die-cut sticker outline generation.
 */

export type BGRemovalMode = "exterior" | "global";

export interface RemoveBGOptions {
  tolerance?: number;
  mode?: BGRemovalMode;
  outlineColor?: string;
  outlineSize?: number;
}

/**
 * Removes background from an image file/element and applies sticker outline.
 */
export function removeBackgroundImage(
  file: File | string,
  tolerance = 42,
  mode: BGRemovalMode = "exterior",
  outlineColor?: string,
  outlineSize?: number,
): Promise<{ blob: Blob; canvas: HTMLCanvasElement; rawImage: HTMLImageElement }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = typeof file === "string" ? file : URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        reject(new Error("Could not get 2D canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Perform background removal based on mode
      processImageDataBG(imgData, tolerance, mode);
      ctx.putImageData(imgData, 0, 0);

      // Apply die-cut border outline if requested
      let finalCanvas = canvas;
      if (outlineColor && outlineSize && outlineSize > 0) {
        finalCanvas = applyStickerOutline(canvas, outlineColor, outlineSize);
      }

      finalCanvas.toBlob((blob) => {
        if (blob) {
          resolve({ blob, canvas: finalCanvas, rawImage: img });
        } else {
          reject(new Error("Failed to convert canvas to blob"));
        }
        if (typeof file !== "string") {
          URL.revokeObjectURL(img.src);
        }
      }, "image/png");
    };

    img.onerror = (err) => reject(err);
  });
}

/**
 * Process ImageData to remove background pixels.
 */
export function processImageDataBG(
  imgData: ImageData,
  tolerance: number,
  mode: BGRemovalMode = "exterior",
) {
  const data = imgData.data;
  const w = imgData.width;
  const h = imgData.height;

  const getPixel = (x: number, y: number) => {
    const idx = (y * w + x) * 4;
    return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
  };

  // Sample corners to find average background color
  const c1 = getPixel(0, 0);
  const c2 = getPixel(w - 1, 0);
  const c3 = getPixel(0, h - 1);
  const c4 = getPixel(w - 1, h - 1);

  const bgR = Math.round((c1.r + c2.r + c3.r + c4.r) / 4);
  const bgG = Math.round((c1.g + c2.g + c3.g + c4.g) / 4);
  const bgB = Math.round((c1.b + c2.b + c3.b + c4.b) / 4);

  const colorDiff = (r: number, g: number, b: number) => {
    return Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
  };

  if (mode === "global") {
    // Global removal: clear any pixel in the image matching the bg color
    for (let i = 0; i < data.length; i += 4) {
      const dist = colorDiff(data[i], data[i + 1], data[i + 2]);
      if (dist < tolerance) {
        data[i + 3] = 0;
      }
    }
    return;
  }

  // Exterior mode: Flood-fill (BFS) from image borders inward
  const visited = new Uint8Array(w * h);
  const queueX = new Int32Array(w * h);
  const queueY = new Int32Array(w * h);
  let head = 0;
  let tail = 0;

  const push = (x: number, y: number) => {
    const idx = y * w + x;
    if (visited[idx]) return;
    visited[idx] = 1;
    queueX[tail] = x;
    queueY[tail] = y;
    tail++;
  };

  // Seed with all border pixels matching bg color
  for (let x = 0; x < w; x++) {
    if (colorDiff(data[(0 * w + x) * 4], data[(0 * w + x) * 4 + 1], data[(0 * w + x) * 4 + 2]) < tolerance) {
      push(x, 0);
    }
    if (colorDiff(data[((h - 1) * w + x) * 4], data[((h - 1) * w + x) * 4 + 1], data[((h - 1) * w + x) * 4 + 2]) < tolerance) {
      push(x, h - 1);
    }
  }
  for (let y = 0; y < h; y++) {
    if (colorDiff(data[(y * w + 0) * 4], data[(y * w + 0) * 4 + 1], data[(y * w + 0) * 4 + 2]) < tolerance) {
      push(0, y);
    }
    if (colorDiff(data[(y * w + (w - 1)) * 4], data[(y * w + (w - 1)) * 4 + 1], data[(y * w + (w - 1)) * 4 + 2]) < tolerance) {
      push(w - 1, y);
    }
  }

  // BFS Flood Fill
  while (head < tail) {
    const x = queueX[head];
    const y = queueY[head];
    head++;

    const pIdx = (y * w + x) * 4;
    data[pIdx + 3] = 0; // Make transparent

    // Neighbors (4-connected)
    const neighbors = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];

    for (let i = 0; i < 4; i++) {
      const nx = neighbors[i][0];
      const ny = neighbors[i][1];

      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        const nIdx = ny * w + nx;
        if (!visited[nIdx]) {
          const nDataIdx = nIdx * 4;
          const dist = colorDiff(data[nDataIdx], data[nDataIdx + 1], data[nDataIdx + 2]);
          if (dist < tolerance) {
            push(nx, ny);
          }
        }
      }
    }
  }
}

/**
 * Flood fill remove connected color at target (startX, startY)
 */
export function floodFillPointRemove(
  imgData: ImageData,
  startX: number,
  startY: number,
  tolerance = 30,
) {
  const data = imgData.data;
  const w = imgData.width;
  const h = imgData.height;

  if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;

  const startIdx = (startY * w + startX) * 4;
  const targetR = data[startIdx];
  const targetG = data[startIdx + 1];
  const targetB = data[startIdx + 2];
  const targetA = data[startIdx + 3];

  if (targetA === 0) return; // Already transparent

  const colorDiff = (r: number, g: number, b: number) => {
    return Math.sqrt((r - targetR) ** 2 + (g - targetG) ** 2 + (b - targetB) ** 2);
  };

  const visited = new Uint8Array(w * h);
  const queueX = new Int32Array(w * h);
  const queueY = new Int32Array(w * h);
  let head = 0;
  let tail = 0;

  visited[startY * w + startX] = 1;
  queueX[tail] = startX;
  queueY[tail] = startY;
  tail++;

  while (head < tail) {
    const x = queueX[head];
    const y = queueY[head];
    head++;

    const pIdx = (y * w + x) * 4;
    data[pIdx + 3] = 0;

    const neighbors = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];

    for (let i = 0; i < 4; i++) {
      const nx = neighbors[i][0];
      const ny = neighbors[i][1];

      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        const nIdx = ny * w + nx;
        if (!visited[nIdx]) {
          const nDataIdx = nIdx * 4;
          if (data[nDataIdx + 3] > 0) {
            const dist = colorDiff(data[nDataIdx], data[nDataIdx + 1], data[nDataIdx + 2]);
            if (dist < tolerance) {
              visited[nIdx] = 1;
              queueX[tail] = nx;
              queueY[tail] = ny;
              tail++;
            }
          }
        }
      }
    }
  }
}

/**
 * Traces the silhouette of the transparent image and draws a thick color outline.
 */
export function applyStickerOutline(
  originalCanvas: HTMLCanvasElement,
  outlineColor: string,
  outlineSize: number,
): HTMLCanvasElement {
  const width = originalCanvas.width;
  const height = originalCanvas.height;

  const paddedCanvas = document.createElement("canvas");
  const padding = outlineSize * 2;
  paddedCanvas.width = width + padding * 2;
  paddedCanvas.height = height + padding * 2;

  const ctx = paddedCanvas.getContext("2d");
  if (!ctx) return originalCanvas;

  // 1. Create a solid color mask of the original transparent drawing
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext("2d");
  if (!maskCtx) return originalCanvas;

  maskCtx.drawImage(originalCanvas, 0, 0);
  maskCtx.globalCompositeOperation = "source-in";
  maskCtx.fillStyle = outlineColor;
  maskCtx.fillRect(0, 0, width, height);

  // 2. Draw the solid mask shifted in a circle to create the thick traced silhouette outline
  const centerX = padding;
  const centerY = padding;
  const steps = 36;
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const dx = centerX + Math.cos(angle) * outlineSize;
    const dy = centerY + Math.sin(angle) * outlineSize;
    ctx.drawImage(maskCanvas, dx, dy);
  }

  // 3. Draw the original image on top in the center
  ctx.drawImage(originalCanvas, centerX, centerY);

  return paddedCanvas;
}
