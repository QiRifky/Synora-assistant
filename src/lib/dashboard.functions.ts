import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { DashboardSnapshot, SavedDashboard } from "@/lib/dashboard-shared";

export type DashboardData =
  | {
      ok: true;
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

    const refs = await supabaseAdmin
        .from("media_references")
        .select("created_at, kind")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(20);
    if (refs.error) return { ok: false };

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
      activity,
    };
  });

/** Reads saved data only; never contacts Buffer or refreshes on mount. */
export const getDashboardSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<({ ok: true } & SavedDashboard) | { ok: false }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conn } = await supabaseAdmin.from("buffer_connections").select("buffer_account_id").eq("user_id", context.userId).maybeSingle();
    const { data, error } = await context.supabase.from("dashboard_snapshots").select("snapshot, buffer_account_id, updated_at, cooldown_until").eq("user_id", context.userId).maybeSingle();
    if (error) return { ok: false };
    if (conn && data && data.buffer_account_id !== conn.buffer_account_id) {
      const { error: clearError } = await supabaseAdmin.from("dashboard_snapshots").delete().eq("user_id", context.userId).eq("buffer_account_id", data.buffer_account_id);
      if (clearError) return { ok: false };
      return { ok: true, snapshot: null, updatedAt: null, cooldownUntil: null };
    }
    return { ok: true, snapshot: data?.snapshot as DashboardSnapshot | null ?? null, updatedAt: data?.updated_at ?? null, cooldownUntil: data?.cooldown_until ?? null };
  });
