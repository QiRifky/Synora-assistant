import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BufferChannel = { id: string; name: string; service: string; avatar: string | null };
export type ChannelsResult =
  | { status: "ok"; channels: BufferChannel[] }
  | { status: "reconnect" }
  | { status: "error" };

export type PostStatus = "draft" | "scheduled" | "sent";
export type BufferPost = {
  id: string; text: string; channelName: string; service: string;
  dueAt: string | null; sentAt: string | null; createdAt: string | null;
};
export type PostsResult =
  | { status: "ok"; posts: BufferPost[]; hasMore: boolean }
  | { status: "reconnect" }
  | { status: "error" };
export type SummaryResult =
  | { status: "ok"; channels: number; counts: Record<PostStatus, { count: number; hasMore: boolean }> }
  | { status: "reconnect" }
  | { status: "error" };

const PAGE = 50;
const TTL = 60_000;
// Best-effort per-worker cache to stay under Buffer's rate limits. Holds no tokens.
const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T extends { status: string }>(key: string, force: boolean, run: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < TTL) return hit.value as T;
  const value = await run();
  if (value.status === "ok") cache.set(key, { at: Date.now(), value });
  else cache.delete(key);
  return value;
}

class Reconnect extends Error {}
class Failed extends Error {}

async function gql(token: string, query: string, variables?: Record<string, unknown>) {
  const res = await fetch("https://api.buffer.com", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await res.json().catch(() => null)) as
    | { data?: any; errors?: { message?: string; extensions?: { code?: string } }[] }
    | null;
  const unauth =
    res.status === 401 || res.status === 403 ||
    !!body?.errors?.some((e) => /UNAUTH|FORBIDDEN/i.test(e.extensions?.code ?? "") || /unauth|expired|invalid token/i.test(e.message ?? ""));
  if (unauth) throw new Reconnect();
  if (!res.ok || body?.errors?.length) {
    console.error("buffer api request failed", res.status, body?.errors?.[0]?.extensions?.code ?? "");
    throw new Failed();
  }
  return body?.data;
}

async function getToken(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: conn } = await supabaseAdmin
    .from("buffer_connections").select("access_token, token_expires_at")
    .eq("user_id", userId).maybeSingle();
  if (!conn?.access_token) throw new Reconnect();
  if (conn.token_expires_at && new Date(conn.token_expires_at).getTime() < Date.now()) throw new Reconnect();
  return conn.access_token as string;
}

async function guard<T>(run: () => Promise<T>): Promise<T | { status: "reconnect" } | { status: "error" }> {
  try { return await run(); }
  catch (e) {
    if (e instanceof Reconnect) return { status: "reconnect" };
    if (!(e instanceof Failed)) console.error("buffer request error");
    return { status: "error" };
  }
}

async function orgIds(token: string): Promise<string[]> {
  const d = await gql(token, "query { account { organizations { id } } }");
  return (d?.account?.organizations ?? []).map((o: { id: string }) => String(o.id));
}

async function loadChannels(userId: string, force: boolean): Promise<ChannelsResult> {
  return cached(`${userId}:channels`, force, () => guard(async () => {
    const token = await getToken(userId);
    const channels: BufferChannel[] = [];
    for (const org of await orgIds(token)) {
      const d = await gql(token, "query($o: OrganizationId!) { channels(input: { organizationId: $o }) { id name displayName service avatar } }", { o: org });
      for (const c of d?.channels ?? []) {
        channels.push({ id: String(c.id), name: c.displayName || c.name || "Unnamed", service: String(c.service ?? ""), avatar: c.avatar || null });
      }
    }
    return { status: "ok" as const, channels };
  }));
}

async function loadPosts(userId: string, status: PostStatus, force: boolean): Promise<PostsResult> {
  return cached(`${userId}:posts:${status}`, force, () => guard(async () => {
    const ch = await loadChannels(userId, false);
    const names = new Map(ch.status === "ok" ? ch.channels.map((c) => [c.id, c.name]) : []);
    const token = await getToken(userId);
    const sort = status === "scheduled"
      ? [{ field: "dueAt", direction: "asc" }]
      : [{ field: status === "sent" ? "dueAt" : "createdAt", direction: "desc" }];
    const posts: BufferPost[] = [];
    let hasMore = false;
    for (const org of await orgIds(token)) {
      const d = await gql(token,
        `query($input: PostsInput!, $first: Int) { posts(input: $input, first: $first) {
          edges { node { id text channelId channelService dueAt sentAt createdAt } } pageInfo { hasNextPage } } }`,
        { first: PAGE, input: { organizationId: org, filter: { status: [status] }, sort } });
      hasMore ||= !!d?.posts?.pageInfo?.hasNextPage;
      for (const e of d?.posts?.edges ?? []) {
        const n = e.node;
        posts.push({
          id: String(n.id), text: n.text ?? "", channelName: names.get(String(n.channelId)) ?? "Unknown channel",
          service: String(n.channelService ?? ""), dueAt: n.dueAt ?? null, sentAt: n.sentAt ?? null, createdAt: n.createdAt ?? null,
        });
      }
    }
    return { status: "ok" as const, posts, hasMore };
  }));
}

const forceInput = (d: unknown) => z.object({ force: z.boolean().optional() }).optional().parse(d);

// Never log or return tokens.
export const getBufferChannels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(forceInput)
  .handler(({ data, context }) => loadChannels(context.userId, !!data?.force));

export const getBufferPosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ status: z.enum(["draft", "scheduled", "sent"]), force: z.boolean().optional() }).parse(d))
  .handler(({ data, context }) => loadPosts(context.userId, data.status, !!data.force));

export const getBufferSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(forceInput)
  .handler(async ({ data, context }): Promise<SummaryResult> => {
    const force = !!data?.force;
    const ch = await loadChannels(context.userId, force);
    if (ch.status !== "ok") return ch;
    const counts = {} as Record<PostStatus, { count: number; hasMore: boolean }>;
    for (const s of ["draft", "scheduled", "sent"] as const) {
      const r = await loadPosts(context.userId, s, force);
      if (r.status !== "ok") return r;
      counts[s] = { count: r.posts.length, hasMore: r.hasMore };
    }
    return { status: "ok", channels: ch.channels.length, counts };
  });
