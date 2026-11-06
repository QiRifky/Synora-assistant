import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fitToLimit } from "@/lib/trends.functions";

const DAILY_LIMIT = 50;

export type MagicResult =
  | { ok: true; text: string; left: number }
  | { ok: false; error: string; left: number };

async function leftFor(userId: string): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.rpc("magic_caption_left", { p_user_id: userId });
  return typeof data === "number" ? data : DAILY_LIMIT;
}

export const getMagicCaptionAllowance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({ left: await leftFor(context.userId), limit: DAILY_LIMIT }));

export const magicCaption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      text: z.string().trim().min(1).max(5000),
      instruction: z.string().trim().max(200).optional(),
      limit: z.number().int().min(0).max(5000),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<MagicResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: slot } = await supabaseAdmin.rpc("try_magic_caption_use", { p_user_id: context.userId });
    if (slot === "busy") {
      return { ok: false, left: await leftFor(context.userId), error: "Another Magic Caption is still running. Please wait a moment." };
    }
    if (slot === "out") {
      return { ok: false, left: 0, error: "Daily limit reached, try again tomorrow." };
    }

    const refund = () => supabaseAdmin.rpc("refund_magic_caption_use", { p_user_id: context.userId });
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      await refund();
      return { ok: false, left: await leftFor(context.userId), error: "Magic Caption is temporarily unavailable. Please try again later." };
    }

    const cap = data.limit > 0 ? data.limit : 500;
    const hadHashtags = /#[\p{L}\p{N}_]+/u.test(data.text);
    const system = [
      "You rewrite social media captions to be more engaging: a stronger hook, clear and natural wording.",
      "Keep the same meaning and the same language as the original.",
      "Never invent facts, numbers, quotes or links. Keep every existing link, @mention and #hashtag exactly as written.",
      hadHashtags ? "You may add at most 2 relevant hashtags." : "Do not add any hashtags.",
      `Output only the rewritten caption, no quotes or preamble. It must be at most ${cap} characters.`,
    ].join(" ");
    const prompt = data.instruction
      ? `Caption:\n${data.text}\n\nInstruction: ${data.instruction}`
      : `Caption:\n${data.text}`;

    try {
      const { createOpenAI } = await import("@ai-sdk/openai");
      const { streamText } = await import("ai");
      const openai = createOpenAI({
        baseURL: "https://ai.gateway.lovable.dev/v1",
        apiKey,
        headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      });
      const result = streamText({
        model: openai.responses("openai/gpt-6-luna"),
        system,
        prompt,
        providerOptions: {
          openai: {
            forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto",
            store: false, include: ["reasoning.encrypted_content"],
          },
        },
      });
      let text = (await result.text).trim().replace(/^["'«»“”]+|["'«»“”]+$/g, "").trim();
      if (!text) return { ok: false, left: await leftFor(context.userId), error: "The AI returned nothing. Please try again." };
      if (data.limit > 0 && text.length > data.limit) text = fitToLimit(text, data.limit);
      return { ok: true, text, left: await leftFor(context.userId) };
    } catch (e: any) {
      await refund();
      const status = e?.statusCode ?? e?.status;
      console.error("magic caption failed", status);
      const left = await leftFor(context.userId);
      if (status === 429 || status === 402) {
        return { ok: false, left, error: "Magic Caption is temporarily unavailable. Please try again later." };
      }
      return { ok: false, left, error: "Couldn't rewrite the caption right now. Please try again." };
    }
  });
