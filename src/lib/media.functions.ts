import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MEDIA_BUCKET } from "@/lib/media";

export const getMediaAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.storage.getBucket(MEDIA_BUCKET);
    return { available: !error && data?.public === true };
  });