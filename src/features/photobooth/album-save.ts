import { format } from "date-fns";
import { uploadImage } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";

export type SavedStrip = { url: string; itemId: string | null; memoryId: string | null };

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not render the strip"))),
      "image/png",
    ),
  );
}

/**
 * Puts a kept strip into the Album book, on its own new page. It never adds a memory:
 * the memories timeline is only ever filled in by hand.
 * Returns ids so a decorated version can later replace the same picture.
 */
export async function saveStripToAlbumBook({
  canvas,
  relationshipId,
  title,
  description = "Taken in the photo booth.",
}: {
  canvas: HTMLCanvasElement;
  relationshipId: string;
  title: string;
  description?: string;
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
  const { data: page, error: pageError } = await db
    .from("album_pages")
    .insert({
      relationship_id: relationshipId,
      page_index: (last?.page_index ?? -1) + 1,
      name: `Photo booth · ${format(new Date(), "MMM d")}`,
    })
    .select("id")
    .single();

  if (pageError || !page?.id) throw pageError ?? new Error("Could not add an album page");

  let itemId: string | null = null;
  {
    const { data: item, error: itemError } = await db
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
    if (itemError || !item?.id) {
      // Don't leave an empty page behind.
      await db.from("album_pages").delete().eq("id", page.id);
      throw itemError ?? new Error("Could not add the picture");
    }
    itemId = item.id;
  }

  // Booth strips go into the album book only. Memories are added by hand.
  const memoryId: string | null = null;

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
  if (saved.memoryId)
    await supabase.from("memories").update({ cover_url: url }).eq("id", saved.memoryId);
  return { ...saved, url };
}
