import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fitToLimit } from "@/lib/trends.functions";

export type MagicResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

const styleSchema = z.enum([
  "auto", "punchier", "friendly", "professional", "funny", "inspiring", "storytelling", "emojis",
]);
export type MagicStyle = z.infer<typeof styleSchema>;

// Fixed server-side instructions; the browser may only send a style key, never free text.
const STYLE_INSTRUCTIONS: Record<MagicStyle, string> = {
  auto: "Make the caption more engaging while keeping the same meaning.",
  punchier: "Make it shorter, with a stronger hook.",
  friendly: "Make it warm and conversational.",
  professional: "Make it clear and polished.",
  funny: "Add light humor; no offensive jokes.",
  inspiring: "Make it positive and motivating.",
  storytelling: "Open with a short story-like line.",
  emojis: "Add a few fitting emojis, but not too many.",
};

export const magicCaption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      text: z.string().trim().min(1).max(5000),
      style: styleSchema.default("auto"),
      limit: z.number().int().min(0).max(5000),
    }).parse(d),
  )
  .handler(async ({ data }): Promise<MagicResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return { ok: false, error: "Magic Caption is temporarily unavailable. Please try again later." };
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
    const prompt = `Caption:\n${data.text}\n\nStyle: ${STYLE_INSTRUCTIONS[data.style]}`;

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
      if (!text) return { ok: false, error: "The AI returned nothing. Please try again." };
      if (data.limit > 0 && text.length > data.limit) text = fitToLimit(text, data.limit);
      return { ok: true, text };
    } catch (e: any) {
      const status = e?.statusCode ?? e?.status;
      console.error("magic caption failed", status);
      if (status === 429 || status === 402) {
        return { ok: false, error: "Magic Caption is temporarily unavailable. Please try again later." };
      }
      return { ok: false, error: "Couldn't rewrite the caption right now. Please try again." };
    }
  });
