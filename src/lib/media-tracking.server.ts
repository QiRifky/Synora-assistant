import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { MEDIA_BUCKET } from "@/lib/media";
import type { MediaAttachment } from "@/lib/media";

export async function protectMedia(userId: string, media: MediaAttachment[]) {
  if (!media.length) return null;
  const operation = crypto.randomUUID();
  const { error } = await supabaseAdmin.rpc("protect_media_save", {
    p_user_id: userId, p_paths: media.map((m) => m.path), p_operation: operation,
  });
  if (error) {
    // Quota failures get a clear message; everything else stays generic.
    if (/quota/i.test(error.message ?? "")) throw new Error("Your 100 MB media storage is full. Remove old files or delete old drafts to free space.");
    throw new Error("Couldn't protect the attachments. Please try again.");
  }
  return operation;
}

export async function recordSavedMedia(userId: string, media: MediaAttachment[], bufferId: string, kind: "draft" | "queue" | "schedule" | "publish" | "idea") {
  if (!media.length) return;
  const { error } = await supabaseAdmin.from("media_references").upsert(
    media.map((m) => ({ user_id: userId, path: m.path, buffer_id: bufferId, kind })),
    { onConflict: "path,buffer_id,kind" },
  );
  // Pending protection remains if recording fails, so cleanup always fails safe.
  if (error) throw new Error("The item was saved, but attachment tracking is pending. Its files remain protected.");
}

export async function finishMediaOperation(operation: string | null) {
  if (!operation) return;
  await supabaseAdmin.from("media_references").delete().eq("buffer_id", operation).eq("kind", "pending");
}

// After a draft is deleted in Buffer: drop its references and delete files that
// no other saved post or idea still uses. Never logs paths.
export async function releaseMedia(bufferId: string) {
  const { data, error } = await supabaseAdmin.rpc("release_media_references", { p_buffer_id: bufferId });
  if (error || !Array.isArray(data) || !data.length) return;
  const paths = data.map((row: { path: string }) => row.path);
  const { error: removalError } = await supabaseAdmin.storage.from(MEDIA_BUCKET).remove(paths);
  if (!removalError) await supabaseAdmin.from("media_cleanup_claims").delete().in("path", paths);
}
