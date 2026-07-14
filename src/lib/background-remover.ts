/**
 * Removes the background of an image client-side using HTML Canvas.
 * It analyzes the corners to auto-detect the background color,
 * and sets matching color pixels to transparent.
 * Optionally applies a die-cut sticker style outline.
 */
export function removeBackgroundImage(
  file: File,
  tolerance = 42,
  outlineColor?: string,
  outlineSize?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get 2D canvas context"));
        return;
      }
      
      ctx.drawImage(img, 0, 0);
      
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      
      const w = canvas.width;
      const h = canvas.height;
      
      const getPixel = (x: number, y: number) => {
        const idx = (y * w + x) * 4;
        return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
      };
      
      // Sample 4 corners
      const c1 = getPixel(0, 0);
      const c2 = getPixel(w - 1, 0);
      const c3 = getPixel(0, h - 1);
      const c4 = getPixel(w - 1, h - 1);
      
      // Average the corner colors
      const bgR = Math.round((c1.r + c2.r + c3.r + c4.r) / 4);
      const bgG = Math.round((c1.g + c2.g + c3.g + c4.g) / 4);
      const bgB = Math.round((c1.b + c2.b + c3.b + c4.b) / 4);
      
      // Set matching background pixels to transparent alpha
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        const diffR = r - bgR;
        const diffG = g - bgG;
        const diffB = b - bgB;
        const distance = Math.sqrt(diffR * diffR + diffG * diffG + diffB * diffB);
        
        if (distance < tolerance) {
          data[i + 3] = 0;
        }
      }
      
      ctx.putImageData(imgData, 0, 0);

      // Apply outline if requested
      let finalCanvas = canvas;
      if (outlineColor && outlineSize && outlineSize > 0) {
        finalCanvas = applyStickerOutline(canvas, outlineColor, outlineSize);
      }
      
      finalCanvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to convert canvas to blob"));
        }
      }, "image/png");
      
      URL.revokeObjectURL(img.src);
    };
    
    img.onerror = (err) => {
      reject(err);
    };
  });
}

/**
 * Traces the silhouette of the transparent image and draws a thick color outline.
 */
function applyStickerOutline(
  originalCanvas: HTMLCanvasElement,
  outlineColor: string,
  outlineSize: number
): HTMLCanvasElement {
  const width = originalCanvas.width;
  const height = originalCanvas.height;

  // Create a new padded canvas to fit the outline without clipping
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
  const steps = 36; // Number of angles to draw to make it perfectly smooth
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
