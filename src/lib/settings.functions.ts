import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isValidTimeZone } from "@/lib/timezone";

export const MAGIC_STYLE_KEYS = ["auto", "punchier", "friendly", "professional", "funny", "inspiring", "storytelling", "emojis"] as const;
export type Preferences = { magicStyle: (typeof MAGIC_STYLE_KEYS)[number]; defaultChannelId: string | null; timeZone: string | null };

// Scoped to the signed-in user by RLS on user_preferences.
export const getPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true; prefs: Preferences } | { ok: false }> => {
    const { data, error } = await context.supabase
      .from("user_preferences").select("magic_style, default_channel_id, time_zone").eq("user_id", context.userId).maybeSingle();
    if (error) return { ok: false };
    return { ok: true, prefs: {
      magicStyle: (MAGIC_STYLE_KEYS as readonly string[]).includes(data?.magic_style ?? "") ? data!.magic_style as Preferences["magicStyle"] : "auto",
      defaultChannelId: data?.default_channel_id ?? null,
      timeZone: data?.time_zone ?? null,
    } };
  });

export const savePreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    magicStyle: z.enum(MAGIC_STYLE_KEYS),
    defaultChannelId: z.string().min(1).max(100).nullable(),
    timeZone: z.string().min(1).max(100).refine(isValidTimeZone, "Unknown time zone").nullable(),
  }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const { error } = await context.supabase.from("user_preferences").upsert({
      user_id: context.userId, magic_style: data.magicStyle, default_channel_id: data.defaultChannelId,
      time_zone: data.timeZone, updated_at: new Date().toISOString(),
    });
    if (error) console.error("save preferences failed", error.code);
    return { ok: !error };
  });
