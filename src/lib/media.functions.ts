import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MEDIA_BUCKET } from "@/lib/media";
import { USER_QUOTA_BYTES } from "@/lib/media-limits";

export const getMediaAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.storage.getBucket(MEDIA_BUCKET);
    return { available: !error && data?.public === true };
  });

// Never log or return tokens; only aggregate byte counts.
export const getMediaUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ usedBytes: number; quotaBytes: number }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("media_usage_bytes", { p_user_id: context.userId });
    if (error || typeof data !== "number") return { usedBytes: 0, quotaBytes: USER_QUOTA_BYTES };
    return { usedBytes: data, quotaBytes: USER_QUOTA_BYTES };
  });
