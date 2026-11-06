import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Fail = { ok: false; error: string; reconnect?: boolean };

function isBlockedHost(host: string) {
  const h = host.toLowerCase();
  return (
    h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local") ||
    /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) ||
    h.startsWith("[") || /^\d+$/.test(h)
  );
}

function htmlToText(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "";
  const body = (html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html)
    .replace(/<(script|style|noscript|svg|nav|header|footer|aside|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|h\d|li|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "'")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  return { title, text: body.slice(0, 12000) };
}

export const importArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ url: z.string().url().max(2000), service: z.string().max(50) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true; title: string; draft: string } | Fail> => {
    const url = new URL(data.url);
    if (!/^https?:$/.test(url.protocol) || isBlockedHost(url.hostname)) {
      return { ok: false, error: "Please use a public http(s) article link." };
    }
    let html: string;
    try {
      const res = await fetch(url.toString(), {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SynoraBot/1.0)", Accept: "text/html" },
        redirect: "follow",
      });
      if (!res.ok) return { ok: false, error: `The article page returned an error (${res.status}).` };
      html = (await res.text()).slice(0, 2_000_000);
    } catch {
      return { ok: false, error: "Couldn't reach that link. Check the URL and try again." };
    }
    const { title, text } = htmlToText(html);
    if (text.length < 200) return { ok: false, error: "Couldn't find readable article text on that page." };

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false, error: "Draft writing isn't set up yet." };
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const openai = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    try {
      const result = streamText({
        model: openai.responses("openai/gpt-6-astra"),
        system:
          "You write short, engaging social media posts that share an article. Output only the post text, no quotes or preamble. Keep it concise and suited to the platform; include the article URL at the end.",
        prompt: `Platform: ${data.service || "general"}\nArticle URL: ${url}\nTitle: ${title}\n\nArticle text:\n${text}`,
        providerOptions: {
          openai: {
            forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto",
            store: false, include: ["reasoning.encrypted_content"],
          },
        },
      });
      const draft = (await result.text).trim();
      if (!draft) return { ok: false, error: "Couldn't write a draft for this article." };
      return { ok: true, title, draft };
    } catch (e: any) {
      const status = e?.statusCode ?? e?.status;
      console.error("draft generation failed", status);
      if (status === 429) return { ok: false, error: "Too many requests right now. Please wait a moment and try again." };
      if (status === 402) return { ok: false, error: "AI credits have run out. Add credits to keep generating drafts." };
      return { ok: false, error: "Couldn't write a draft right now. Please try again." };
    }
  });

// Never log or return tokens.
export const saveBufferDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ channelId: z.string().min(1).max(100), text: z.string().min(1).max(5000) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | Fail> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conn } = await supabaseAdmin
      .from("buffer_connections").select("access_token, token_expires_at")
      .eq("user_id", context.userId).maybeSingle();
    if (!conn?.access_token || (conn.token_expires_at && new Date(conn.token_expires_at).getTime() < Date.now())) {
      return { ok: false, reconnect: true, error: "Your Buffer connection has expired." };
    }
    const res = await fetch("https://api.buffer.com", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${conn.access_token}` },
      body: JSON.stringify({
        query: `mutation($input: CreatePostInput!) { createPost(input: $input) {
          __typename ... on PostActionSuccess { post { id } } ... on MutationError { message } } }`,
        variables: {
          input: {
            channelId: data.channelId, text: data.text, assets: [], saveToDraft: true,
            schedulingType: "automatic", mode: "addToQueue", needsApproval: false, aiAssisted: true,
          },
        },
      }),
    });
    const body = (await res.json().catch(() => null)) as any;
    const r = body?.data?.createPost;
    if (res.status === 401 || res.status === 403 || r?.__typename === "UnauthorizedError" ||
        body?.errors?.some((e: any) => /UNAUTH/i.test(e?.extensions?.code ?? ""))) {
      return { ok: false, reconnect: true, error: "Your Buffer connection has expired." };
    }
    if (r?.__typename === "PostActionSuccess") return { ok: true };
    console.error("buffer createPost failed", res.status, r?.__typename);
    return { ok: false, error: r?.message ? `Buffer said: ${r.message}` : "Buffer couldn't save the draft. Please try again." };
  });
