import { supabase } from "@/integrations/supabase/client";

export type Bucket = "memories" | "wall" | "trips" | "stickers";

/** Upload a file or blob under {relationshipId}/{subpath}. Returns { path, url }. */
export async function uploadImage(bucket: Bucket, relationshipId: string, file: File | Blob, subpath: string) {
  const name = (file as any).name || "image.png";
  const ext = (name.split(".").pop() || "png").toLowerCase();
  const path = `${relationshipId}/${subpath}.${ext}`;
  const contentType = file.type || "image/png";
  
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType });
  if (error) throw error;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365);
  return { path, url: data?.signedUrl ?? "" };
}

/** Refresh a signed URL. */
export async function signedUrl(bucket: Bucket, path: string, seconds = 60 * 60 * 24 * 30) {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, seconds);
  return data?.signedUrl ?? "";
}
