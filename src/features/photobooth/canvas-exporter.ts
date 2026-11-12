import { format } from "date-fns";
import { FRAME_TEMPLATES, PHOTO_FILTERS } from "./frame-templates";
import type { FrameId, FilterId, PhotoCut, PlacedSticker } from "./types";
import { uploadImage } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";

interface CompositeOptions {
  cuts: PhotoCut[];
  frameId: FrameId;
  filterId: FilterId;
  stickers: PlacedSticker[];
  partnerName: string;
  userName: string;
  anniversary?: string | null;
  customCaption?: string;
  partnerCity?: string;
  userCity?: string;
}

export async function renderPhotoStripCanvas({
  cuts,
  frameId,
  filterId,
  stickers,
  partnerName,
  userName,
  customCaption,
  partnerCity,
  userCity,
}: CompositeOptions): Promise<HTMLCanvasElement> {
  const frame = FRAME_TEMPLATES.find((f) => f.id === frameId) || FRAME_TEMPLATES[0];
  const filter = PHOTO_FILTERS.find((f) => f.id === filterId);

  // High-Resolution 300 DPI canvas dimensions
  const isGrid = frame.aspectRatio === "grid";
  const isPolaroid = frame.aspectRatio === "polaroid";

  const canvas = document.createElement("canvas");
  canvas.width = isGrid ? 2400 : 1200;
  canvas.height = isGrid ? 2400 : isPolaroid ? 1600 : 3600;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not obtain 2D canvas context");

  // 1. Draw Frame Background
  ctx.fillStyle = frame.bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle border / inner margin
  const marginX = isGrid ? 100 : 70;
  const marginTop = isGrid ? 100 : 80;
  const marginBottom = isGrid ? 220 : 320; // Bottom space for logo, date, stamps

  // 2. Pre-load cut images
  const loadedImages: HTMLImageElement[] = await Promise.all(
    cuts.map(
      (cut) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error("Failed to load cut image"));
          img.src = cut.dataUrl;
        }),
    ),
  );

  // 3. Draw Cut Slots
  const numCuts = Math.min(loadedImages.length, frame.cutCount);

  if (frame.aspectRatio === "strip") {
    // 4 vertical cuts stacked
    const availableHeight = canvas.height - marginTop - marginBottom;
    const gap = 40;
    const slotHeight = (availableHeight - gap * (frame.cutCount - 1)) / frame.cutCount;
    const slotWidth = canvas.width - marginX * 2;

    for (let i = 0; i < frame.cutCount; i++) {
      const slotY = marginTop + i * (slotHeight + gap);

      // Slot placeholder background
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.roundRect?.(marginX, slotY, slotWidth, slotHeight, 16);
      ctx.fill();

      if (loadedImages[i]) {
        ctx.save();
        // Clip to rounded rectangle
        ctx.beginPath();
        ctx.roundRect?.(marginX, slotY, slotWidth, slotHeight, 16);
        ctx.clip();

        // Apply filter
        if (filter && filter.cssFilter !== "none") {
          ctx.filter = filter.cssFilter;
        }

        // Draw image covering slot
        drawImageCover(ctx, loadedImages[i], marginX, slotY, slotWidth, slotHeight);
        ctx.restore();
      }
    }
  } else if (frame.aspectRatio === "grid") {
    // 2x2 grid
    const availableWidth = canvas.width - marginX * 2;
    const availableHeight = canvas.height - marginTop - marginBottom;
    const gap = 50;
    const cellW = (availableWidth - gap) / 2;
    const cellH = (availableHeight - gap) / 2;

    for (let i = 0; i < 4; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const slotX = marginX + col * (cellW + gap);
      const slotY = marginTop + row * (cellH + gap);

      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.roundRect?.(slotX, slotY, cellW, cellH, 20);
      ctx.fill();

      if (loadedImages[i]) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect?.(slotX, slotY, cellW, cellH, 20);
        ctx.clip();

        if (filter && filter.cssFilter !== "none") {
          ctx.filter = filter.cssFilter;
        }

        drawImageCover(ctx, loadedImages[i], slotX, slotY, cellW, cellH);
        ctx.restore();
      }
    }
  }

  // 4. Draw Typography & Stamps in Footer
  ctx.save();
  ctx.fillStyle = frame.textColor;
  ctx.textAlign = "center";

  const footerCenterY = canvas.height - marginBottom / 2 + 10;

  // Title / Logo
  ctx.font = "bold 64px serif";
  ctx.fillText("Seanaya", canvas.width / 2, footerCenterY - 40);

  // Subtitle / Date / LDR tag
  ctx.font = "32px sans-serif";
  const dateStr = format(new Date(), "yyyy.MM.dd");

  if (customCaption && customCaption.trim()) {
    ctx.font = "bold 32px sans-serif";
    ctx.fillText(customCaption.trim(), canvas.width / 2, footerCenterY + 15);
    ctx.font = "24px sans-serif";
    ctx.fillStyle = "rgba(128,128,128,0.7)";
    ctx.fillText(`${dateStr}  •  Our Quiet Space Together`, canvas.width / 2, footerCenterY + 60);
  } else if (frame.hasLdrTag) {
    const uCity = userCity || "Bacolod";
    const pCity = partnerCity || "Manila";
    ctx.font = "bold 32px serif";
    ctx.fillText(`${uCity}  —  ${pCity}  •  ${dateStr}`, canvas.width / 2, footerCenterY + 15);
    ctx.font = "italic 24px serif";
    ctx.fillStyle = frame.accentColor;
    ctx.fillText(
      "Always close in heart, across any distance",
      canvas.width / 2,
      footerCenterY + 60,
    );
  } else {
    ctx.fillText(
      `${userName} & ${partnerName}  •  ${dateStr}`,
      canvas.width / 2,
      footerCenterY + 20,
    );
    ctx.font = "24px sans-serif";
    ctx.fillStyle = "rgba(128,128,128,0.7)";
    ctx.fillText("Our Quiet Space Together", canvas.width / 2, footerCenterY + 65);
  }
  ctx.restore();

  // 5. Draw Placed Stickers
  for (const s of stickers) {
    try {
      const stickerImg = await loadImage(s.src);
      const stickerX = (s.xPercent / 100) * canvas.width;
      const stickerY = (s.yPercent / 100) * canvas.height;
      const baseSize = 220 * s.scale;

      ctx.save();
      ctx.translate(stickerX, stickerY);
      ctx.rotate((s.rotation * Math.PI) / 180);
      ctx.drawImage(stickerImg, -baseSize / 2, -baseSize / 2, baseSize, baseSize);
      ctx.restore();
    } catch {
      // Ignore sticker load failure
    }
  }

  return canvas;
}

// Helper: Aspect fill (cover) image drawing
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const targetRatio = w / h;

  let sWidth = img.naturalWidth;
  let sHeight = img.naturalHeight;
  let sx = 0;
  let sy = 0;

  if (imgRatio > targetRatio) {
    sWidth = img.naturalHeight * targetRatio;
    sx = (img.naturalWidth - sWidth) / 2;
  } else {
    sHeight = img.naturalWidth / targetRatio;
    sy = (img.naturalHeight - sHeight) / 2;
  }

  ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, w, h);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Download canvas as PNG
export function downloadPhotoStrip(canvas: HTMLCanvasElement, filename = "Seanaya_PhotoBooth.png") {
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Save directly to Seanaya memories album
export async function savePhotoStripToAlbum({
  canvas,
  relationshipId,
  title = "Photo Booth Session",
}: {
  canvas: HTMLCanvasElement;
  relationshipId: string;
  title?: string;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error("Canvas blob conversion failed"));
        return;
      }
      try {
        const res = await uploadImage("memories", relationshipId, blob, `photobooth-${Date.now()}`);
        const uploadedUrl = res.url;

        // Insert into memories table
        const { data: user } = await supabase.auth.getUser();
        if (user?.user?.id) {
          await supabase.from("memories").insert({
            relationship_id: relationshipId,
            created_by: user.user.id,
            title: `Photo Booth Strip (${format(new Date(), "MMM d, yyyy")})`,
            description: "Captured together remotely in our Seanaya Photo Booth!",
            category: "random",
            cover_url: uploadedUrl,
            memory_date: format(new Date(), "yyyy-MM-dd"),
            tags: ["photobooth", "polaroid", "strip"],
          });
        }

        resolve(uploadedUrl);
      } catch (err) {
        reject(err);
      }
    }, "image/png");
  });
}

export type SavedStrip = { url: string; itemId: string | null; memoryId: string | null };

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not render the strip"))), "image/png"),
  );
}

/**
 * Puts a finished strip into the Album book (its own new page) and the memories timeline.
 * Returns ids so a decorated version can later replace the same picture.
 */
export async function saveStripToAlbumBook({
  canvas,
  relationshipId,
  title,
}: {
  canvas: HTMLCanvasElement;
  relationshipId: string;
  title: string;
}): Promise<SavedStrip> {
  const blob = await canvasToBlob(canvas);
  const { url } = await uploadImage("wall", relationshipId, blob, `album/booth-${Date.now()}`);
  const db = supabase as any;

  // New album page at the end of the book
  const { data: last } = await db
    .from("album_pages")
    .select("page_index")
    .eq("relationship_id", relationshipId)
    .order("page_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: page } = await db
    .from("album_pages")
    .insert({
      relationship_id: relationshipId,
      page_index: (last?.page_index ?? -1) + 1,
      name: `Photo booth · ${format(new Date(), "MMM d")}`,
    })
    .select("id")
    .single();

  let itemId: string | null = null;
  if (page?.id) {
    const { data: item } = await db
      .from("album_items")
      .insert({
        page_id: page.id,
        item_type: "picture",
        content: null,
        image_url: url,
        color: "rect:#ffffff",
        pos_x: 36,
        pos_y: 6,
        scale: 1,
        rotation: -3,
      })
      .select("id")
      .single();
    itemId = item?.id ?? null;
  }

  let memoryId: string | null = null;
  const { data: user } = await supabase.auth.getUser();
  if (user?.user?.id) {
    const { data: mem } = await supabase
      .from("memories")
      .insert({
        relationship_id: relationshipId,
        created_by: user.user.id,
        title,
        description: "Taken together in the photo booth.",
        category: "random",
        cover_url: url,
        memory_date: format(new Date(), "yyyy-MM-dd"),
        tags: ["photobooth", "strip"],
      })
      .select("id")
      .single();
    memoryId = mem?.id ?? null;
  }

  if (!itemId && !memoryId) throw new Error("Couldn't save to the album");
  return { url, itemId, memoryId };
}

/** Replace a saved strip's picture with a newly decorated render. */
export async function updateSavedStrip(
  saved: SavedStrip,
  canvas: HTMLCanvasElement,
  relationshipId: string,
): Promise<SavedStrip> {
  const blob = await canvasToBlob(canvas);
  const { url } = await uploadImage("wall", relationshipId, blob, `album/booth-${Date.now()}`);
  const db = supabase as any;
  if (saved.itemId) await db.from("album_items").update({ image_url: url }).eq("id", saved.itemId);
  if (saved.memoryId) await supabase.from("memories").update({ cover_url: url }).eq("id", saved.memoryId);
  return { ...saved, url };
}
