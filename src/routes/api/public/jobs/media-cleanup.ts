import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { MEDIA_BUCKET } from "@/lib/media";
import { deleteClaimedMedia } from "@/lib/media-cleanup";

export const Route = createFileRoute("/api/public/jobs/media-cleanup")({
  server: { handlers: { POST: async ({ request }) => {
    const failure = await authenticateCronRequest(request);
    if (failure) return failure;
    const body = z.object({ kind: z.literal("media-cleanup") }).strict().safeParse(await request.json().catch(() => null));
    if (!body.success) return new Response("Invalid request", { status: 400 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("claim_unused_media");
    if (error) return Response.json({ deleted: 0 }, { status: 503 });
    const paths = (data ?? []).map((row) => row.path);
    const deleted = await deleteClaimedMedia(paths, async (batch) => {
      const { error: removalError } = await supabaseAdmin.storage.from(MEDIA_BUCKET).remove(batch);
      return !removalError;
    });
    console.info("Media cleanup deleted", deleted);
    return Response.json({ deleted }, { status: paths.length && !deleted ? 503 : 200 });
  } } },
});