/**
 * Removes the background of an image client-side using HTML Canvas.
 * It analyzes the corners to auto-detect the background color,
 * and sets matching color pixels to transparent.
 */
export function removeBackgroundImage(file: File, tolerance = 42): Promise<Blob> {
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
      
      canvas.toBlob((blob) => {
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
