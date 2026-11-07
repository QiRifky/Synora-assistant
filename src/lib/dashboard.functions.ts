import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PHOTO_CAPTION_DAILY_LIMIT, PHOTO_EDIT_DAILY_LIMIT } from "@/lib/photo-shared";

export type DashboardData =
  | {
      ok: true;
      ai: {
        photoToPost: { used: number; limit: number };
        magicPhoto: { used: number; limit: number };
        magicCaption: { unlimited: true };
      };
      media: { files: number; bytes: number };
      activity: { at: string; label: string }[];
    }
  | { ok: false };

/**
 * Reads only Synora's own database (usage counters, media references,
 * preferences). Never calls the Buffer API and never returns tokens.
 */
export const getDashboardData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardData> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;

    const [captionLeft, editLeft, bytes, refs] = await Promise.all([
      supabaseAdmin.rpc("photo_usage_left", { p_user_id: uid, p_kind: "caption" }),
      supabaseAdmin.rpc("photo_usage_left", { p_user_id: uid, p_kind: "edit" }),
      supabaseAdmin.rpc("media_usage_bytes", { p_user_id: uid }),
      supabaseAdmin
        .from("media_references")
        .select("created_at, kind")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const left = (v: unknown, limit: number) =>
      Math.max(0, Math.min(limit, typeof v === "number" ? v : limit));

    const captionL = left(captionLeft.data, PHOTO_CAPTION_DAILY_LIMIT);
    const editL = left(editLeft.data, PHOTO_EDIT_DAILY_LIMIT);

    const seen = new Set<string>();
    const activity: { at: string; label: string }[] = [];
    for (const r of refs.data ?? []) {
      const kind = String(r.kind ?? "");
      const label =
        kind === "idea" ? "Saved an idea in Buffer" :
        kind === "publish" ? "Sent a post to Buffer for immediate publishing" :
        kind === "queue" ? "Added a post to the Buffer queue" :
        kind === "schedule" ? "Scheduled a post in Buffer" :
        kind === "draft" ? "Saved a draft in Buffer" : null;
      if (!label || seen.has(label)) continue;
      seen.add(label);
      activity.push({ at: String(r.created_at), label });
      if (activity.length >= 6) break;
    }

    return {
      ok: true,
      ai: {
        photoToPost: { used: PHOTO_CAPTION_DAILY_LIMIT - captionL, limit: PHOTO_CAPTION_DAILY_LIMIT },
        magicPhoto: { used: PHOTO_EDIT_DAILY_LIMIT - editL, limit: PHOTO_EDIT_DAILY_LIMIT },
        magicCaption: { unlimited: true },
      },
      media: {
        files: refs.data?.length ?? 0,
        bytes: typeof bytes.data === "number" ? bytes.data : 0,
      },
      activity,
    };
  });
