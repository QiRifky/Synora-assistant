import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { MediaAttachment } from "@/lib/media";

export async function protectMedia(userId: string, media: MediaAttachment[]) {
  if (!media.length) return null;
  const operation = crypto.randomUUID();
  const { error } = await supabaseAdmin.rpc("protect_media_save", {
    p_user_id: userId, p_paths: media.map((m) => m.path), p_operation: operation,
  });
  if (error) throw new Error("Couldn't protect the attachments. Please try again.");
  return operation;
}

export async function recordSavedMedia(userId: string, media: MediaAttachment[], bufferId: string, kind: "draft" | "queue" | "schedule" | "idea") {
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