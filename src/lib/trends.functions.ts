import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TrendItem = { title: string; source: string; link: string; date: string | null };
export type Topic = { topic: string; reason: string; links: { title: string; link: string }[] };

function isBlockedHost(host: string) {
  const h = host.toLowerCase();
  return (
    h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local") ||
    /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) ||
    h.startsWith("[") || /^\d+$/.test(h)
  );
}

function decode(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").trim();
}

function tag(block: string, name: string) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : "";
}

function toIso(d: string) {
  const t = Date.parse(d);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function parseFeed(xml: string, fallbackSource: string, max: number): TrendItem[] {
  const channelTitle = tag(xml.split(/<(item|entry)[\s>]/i)[0] ?? "", "title") || fallbackSource;
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/(item|entry)>/gi) ?? [];
  return blocks.slice(0, max).map((b) => {
    let link = tag(b, "link");
    if (!link) link = b.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? "";
    const src = tag(b, "source");
    return {
      title: tag(b, "title"),
      source: src || channelTitle,
      link: decode(link),
      date: toIso(tag(b, "pubDate") || tag(b, "published") || tag(b, "updated")),
    };
  }).filter((i) => i.title && /^https?:\/\//.test(i.link));
}

async function fetchText(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SynoraBot/1.0)", Accept: "application/rss+xml, application/xml, text/xml, */*" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.text()).slice(0, 2_000_000);
}

async function hackerNews(): Promise<TrendItem[]> {
  const res = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json");
  if (!res.ok) throw new Error(String(res.status));
  const ids = ((await res.json()) as number[]).slice(0, 12);
  const items = await Promise.all(ids.map(async (id) => {
    try {
      const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
      const it = (await r.json()) as any;
      if (!it?.title) return null;
      return {
        title: it.title, source: "Hacker News",
        link: it.url || `https://news.ycombinator.com/item?id=${id}`,
        date: it.time ? new Date(it.time * 1000).toISOString() : null,
      } as TrendItem;
    } catch { return null; }
  }));
  return items.filter((x): x is TrendItem => !!x);
}

export const collectTrends = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      niche: z.string().trim().min(2).max(120),
      feeds: z.array(z.string().trim().max(2000)).max(3),
    }).parse(d),
  )
  .handler(async ({ data }): Promise<{ items: TrendItem[]; failed: string[] }> => {
    const sources: { name: string; run: () => Promise<TrendItem[]> }[] = [
      { name: "Hacker News", run: hackerNews },
      {
        name: "Google News",
        run: async () => parseFeed(
          await fetchText(`https://news.google.com/rss/search?q=${encodeURIComponent(data.niche)}&hl=en-US&gl=US&ceid=US:en`),
          "Google News", 12),
      },
    ];
    for (const f of data.feeds.filter(Boolean)) {
      sources.push({
        name: f,
        run: async () => {
          const u = new URL(f);
          if (!/^https?:$/.test(u.protocol) || isBlockedHost(u.hostname)) throw new Error("blocked");
          const items = parseFeed(await fetchText(u.toString()), u.hostname, 8);
          if (!items.length) throw new Error("empty");
          return items;
        },
      });
    }
    const results = await Promise.allSettled(sources.map((s) => s.run()));
    const failed: string[] = [];
    const items: TrendItem[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value.length) items.push(...r.value);
      else failed.push(sources[i].name);
    });
    const seen = new Set<string>();
    const unique = items.filter((i) => (seen.has(i.link) ? false : (seen.add(i.link), true)));
    return { items: unique.slice(0, 30), failed };
  });

export const findTopics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      niche: z.string().trim().min(2).max(120),
      items: z.array(z.object({ title: z.string().max(500), link: z.string().url().max(2000) })).min(1).max(40),
    }).parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true; topics: Topic[] } | { ok: false; error: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false, error: "Topic finding isn't set up yet." };
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const openai = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const list = data.items.map((it, i) => `${i}. ${it.title}`).join("\n");
    try {
      const result = streamText({
        model: openai.responses("openai/gpt-6-astra"),
        system:
          'You help social media creators spot promising post topics. Reply with JSON only, shaped {"topics":[{"topic":string,"reason":string,"items":number[]}]}: exactly 5 topics, each reason one sentence, items = indices of related headlines from the list.',
        prompt: `Niche: ${data.niche}\n\nHeadlines:\n${list}`,
        providerOptions: {
          openai: {
            forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto",
            store: false, include: ["reasoning.encrypted_content"],
          },
        },
      });
      const raw = (await result.text).trim();
      const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
      const parsed = z.object({
        topics: z.array(z.object({ topic: z.string(), reason: z.string(), items: z.array(z.number()) })),
      }).parse(JSON.parse(json));
      const topics = parsed.topics.slice(0, 5).map((t) => ({
        topic: t.topic,
        reason: t.reason,
        links: t.items.map((i) => data.items[i]).filter(Boolean).slice(0, 5),
      }));
      if (!topics.length) return { ok: false, error: "Couldn't find topics in these items." };
      return { ok: true, topics };
    } catch (e: any) {
      const status = e?.statusCode ?? e?.status;
      console.error("topic finding failed", status);
      if (status === 429) return { ok: false, error: "Too many requests right now. Please wait a moment and try again." };
      if (status === 402) return { ok: false, error: "AI credits have run out. Add credits to keep finding topics." };
      return { ok: false, error: "Couldn't find topics right now. Please try again." };
    }
  });
