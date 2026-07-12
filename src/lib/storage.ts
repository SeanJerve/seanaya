import { supabase } from "@/integrations/supabase/client";

export type Bucket = "memories" | "wall";

/** Upload a file under {relationshipId}/{subpath}. Returns { path, url }. */
export async function uploadImage(bucket: Bucket, relationshipId: string, file: File, subpath: string) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${relationshipId}/${subpath}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365);
  return { path, url: data?.signedUrl ?? "" };
}

/** Refresh a signed URL. */
export async function signedUrl(bucket: Bucket, path: string, seconds = 60 * 60 * 24 * 30) {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, seconds);
  return data?.signedUrl ?? "";
}
