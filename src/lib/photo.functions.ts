import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MEDIA_BUCKET, ownsMedia } from "@/lib/media";
import {
  buildCaptionSystem, buildEditPrompt, parseCaptionResult,
  PHOTO_CAPTION_DAILY_LIMIT, PHOTO_EDIT_DAILY_LIMIT,
  type CaptionResult,
} from "@/lib/photo-shared";

const VISION_MODEL = "openai/gpt-6-astra";
const EDIT_MODEL = "openai/gpt-image-2.5-sunburst";

type Fail = { ok: false; error: string; left?: number };

const pathSchema = z
  .string()
  .max(200)
  .regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(jpg|png|webp)$/i);

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function mimeFor(path: string): string {
  if (/\.png$/i.test(path)) return "image/png";
  if (/\.webp$/i.test(path)) return "image/webp";
  return "image/jpeg";
}

// Downloads an image the signed-in user owns. Never logs content.
async function downloadOwnedImage(path: string, userId: string) {
  if (!ownsMedia(path, userId)) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage.from(MEDIA_BUCKET).download(path);
  if (error || !data) return null;
  return { bytes: new Uint8Array(await data.arrayBuffer()), type: mimeFor(path) };
}

async function reserveUse(userId: string, kind: "caption" | "edit"): Promise<"ok" | "busy" | "out"> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("try_photo_use", { p_user_id: userId, p_kind: kind });
  if (error || (data !== "ok" && data !== "busy" && data !== "out")) return "busy";
  return data;
}

async function refundUse(userId: string, kind: "caption" | "edit") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.rpc("refund_photo_use", { p_user_id: userId, p_kind: kind });
}

async function usageLeft(userId: string, kind: "caption" | "edit"): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.rpc("photo_usage_left", { p_user_id: userId, p_kind: kind });
  return typeof data === "number" ? data : 0;
}

// Caches the image-edit model availability for 5 minutes so the UI can hide
// the Magic Photo button when the model is not offered.
let editAvailability: { at: number; available: boolean } | null = null;
async function editModelAvailable(apiKey: string): Promise<boolean> {
  if (editAvailability && Date.now() - editAvailability.at < 5 * 60_000) return editAvailability.available;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const body = (await res.json().catch(() => null)) as { data?: { id?: string }[] } | null;
    const available = !!body?.data?.some((m) => m.id === EDIT_MODEL);
    editAvailability = { at: Date.now(), available };
    return available;
  } catch {
    return editAvailability?.available ?? false;
  }
}

export const getPhotoFeatures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    const [captionLeft, editLeft, editAvailable] = await Promise.all([
      usageLeft(context.userId, "caption"),
      usageLeft(context.userId, "edit"),
      apiKey ? editModelAvailable(apiKey) : Promise.resolve(false),
    ]);
    return {
      captionLeft,
      captionLimit: PHOTO_CAPTION_DAILY_LIMIT,
      editLeft,
      editLimit: PHOTO_EDIT_DAILY_LIMIT,
      editAvailable,
    };
  });

export const photoToPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      path: pathSchema,
      text: z.string().max(5000).default(""),
      limit: z.number().int().min(0).max(5000).default(0),
      language: z.string().max(35).default("en"),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<(CaptionResult & { ok: true; left: number }) | Fail> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false, error: "Photo to Post is temporarily unavailable. Please try again later." };

    const reservation = await reserveUse(context.userId, "caption");
    if (reservation === "busy") return { ok: false, error: "One request at a time — please wait for the current one to finish." };
    if (reservation === "out") {
      return { ok: false, error: `You've used all ${PHOTO_CAPTION_DAILY_LIMIT} Photo to Post requests for today. Try again tomorrow.`, left: 0 };
    }

    const image = await downloadOwnedImage(data.path, context.userId);
    if (!image) {
      await refundUse(context.userId, "caption");
      return { ok: false, error: "Couldn't read that image. Please upload it again." };
    }

    try {
      const { createOpenAI } = await import("@ai-sdk/openai");
      const { streamText } = await import("ai");
      const openai = createOpenAI({
        baseURL: "https://ai.gateway.lovable.dev/v1",
        apiKey,
        headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      });
      const result = streamText({
        model: openai.responses(VISION_MODEL),
        system: buildCaptionSystem(data.limit, data.language, !!data.text.trim()),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: data.text.trim()
                  ? `Existing post text (context):\n${data.text.trim()}\n\nWrite the caption and hashtags for the attached photo.`
                  : "Write the caption and hashtags for the attached photo.",
              },
              { type: "image", image: `data:${image.type};base64,${toBase64(image.bytes)}` },
            ],
          },
        ],
        providerOptions: {
          openai: {
            forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto",
            store: false, include: ["reasoning.encrypted_content"],
          },
        },
      });
      const parsed = parseCaptionResult(await result.text);
      if (!parsed) {
        await refundUse(context.userId, "caption");
        return { ok: false, error: "The AI returned nothing usable. Please try again." };
      }
      const caption = data.limit > 0 && parsed.caption.length > data.limit
        ? parsed.caption.slice(0, data.limit).trimEnd()
        : parsed.caption;
      return { ok: true, caption, hashtags: parsed.hashtags, left: await usageLeft(context.userId, "caption") };
    } catch (e: unknown) {
      await refundUse(context.userId, "caption");
      const status = (e as { statusCode?: number; status?: number })?.statusCode ?? (e as { status?: number })?.status;
      console.error("photo to post failed", status);
      if (status === 429 || status === 402) {
        return { ok: false, error: "Photo to Post is temporarily unavailable. Please try again later." };
      }
      return { ok: false, error: "Couldn't write a caption from this photo right now. Please try again." };
    }
  });

export const magicPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ path: pathSchema, style: z.enum(["clean", "warm", "bright", "calm"]) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true; path: string; url: string; left: number } | Fail> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey || !(await editModelAvailable(apiKey))) {
      return { ok: false, error: "Magic Photo is temporarily unavailable. Please try again later." };
    }

    const reservation = await reserveUse(context.userId, "edit");
    if (reservation === "busy") return { ok: false, error: "One request at a time — please wait for the current one to finish." };
    if (reservation === "out") {
      return { ok: false, error: `You've used all ${PHOTO_EDIT_DAILY_LIMIT} Magic Photo edits for today. Try again tomorrow.`, left: 0 };
    }

    const image = await downloadOwnedImage(data.path, context.userId);
    if (!image) {
      await refundUse(context.userId, "edit");
      return { ok: false, error: "Couldn't read that image. Please upload it again." };
    }

    try {
      const form = new FormData();
      form.set("model", EDIT_MODEL);
      form.set("prompt", buildEditPrompt(data.style));
      form.set("image", new File([image.bytes], data.path.split("/").pop() ?? "photo.jpg", { type: image.type }));
      const res = await fetch("https://ai.gateway.lovable.dev/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "X-Lovable-AIG-SDK": "fetch" },
        body: form,
      });
      const body = (await res.json().catch(() => null)) as { data?: { b64_json?: string }[] } | null;
      const b64 = body?.data?.[0]?.b64_json;
      if (!res.ok || !b64) {
        await refundUse(context.userId, "edit");
        console.error("magic photo failed", res.status);
        if (res.status === 429 || res.status === 402) {
          return { ok: false, error: "Magic Photo is temporarily unavailable. Please try again later." };
        }
        return { ok: false, error: "Couldn't improve this photo right now. Please try again." };
      }

      const extension = data.path.split(".").pop() ?? "jpg";
      const newPath = `${context.userId}/${crypto.randomUUID()}.${extension}`;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: uploadError } = await supabaseAdmin.storage
        .from(MEDIA_BUCKET)
        .upload(newPath, fromBase64(b64), { contentType: image.type });
      if (uploadError) {
        await refundUse(context.userId, "edit");
        return { ok: false, error: "Couldn't save the improved photo. Please try again." };
      }
      const { data: pub } = supabaseAdmin.storage.from(MEDIA_BUCKET).getPublicUrl(newPath);
      return { ok: true, path: newPath, url: pub.publicUrl, left: await usageLeft(context.userId, "edit") };
    } catch (e: unknown) {
      await refundUse(context.userId, "edit");
      console.error("magic photo failed", (e as { status?: number })?.status);
      return { ok: false, error: "Couldn't improve this photo right now. Please try again." };
    }
  });
