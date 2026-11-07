import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { charLimit } from "@/lib/trends.functions";
import { mediaInput, ownsMedia, postAssets, MAX_MEDIA_BYTES, MEDIA_BUCKET, type MediaAttachment } from "@/lib/media";
import { checkMediaAgainstLimits, effectiveMediaLimits, formatBytes, type EffectiveMediaLimits } from "@/lib/media-limits";

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

// ---------- Writes (never publish automatically; scheduling only on explicit user action) ----------

function clearCache(userId: string) {
  for (const k of cache.keys()) if (k.startsWith(`${userId}:`)) cache.delete(k);
}

export type ChannelOutcome = { channelId: string; ok: boolean; message: string };
export type WriteResult =
  | { status: "ok"; results: ChannelOutcome[] }
  | { status: "reconnect" }
  | { status: "error"; message?: string };

const POST_RESULT = `__typename ... on PostActionSuccess { post { id } } ... on MutationError { message }`;

async function resolveMedia(userId: string, attachments: MediaAttachment[], imagesOnly = false, limits: EffectiveMediaLimits = effectiveMediaLimits([])) {
  if (!attachments.length) return [];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: bucket } = await supabaseAdmin.storage.getBucket(MEDIA_BUCKET);
  if (!bucket?.public) throw new Error("Public media storage is not enabled. Remove the attachments or ask your workspace owner to enable it.");
  const resolved: { type: "image" | "video"; url: string }[] = [];
  for (const attachment of attachments) {
    if (!ownsMedia(attachment.path, userId) || (imagesOnly && attachment.type === "video")) throw new Error("Invalid media attachment.");
    const { data: info, error } = await supabaseAdmin.storage.from(MEDIA_BUCKET).info(attachment.path);
    const expected = attachment.path.endsWith(".mp4") ? "video" : "image";
    const maxBytes = attachment.type === "image" ? limits.imageMaxBytes : limits.videoMaxBytes;
    if (error || !info || typeof info.size !== "number" || info.size > MAX_MEDIA_BYTES || info.size <= 0 || attachment.type !== expected) throw new Error("An attachment is missing, invalid or larger than 20 MB. Please remove it and upload again.");
    if (info.size > maxBytes) throw new Error(`An attachment is ${formatBytes(info.size)}, over the ${formatBytes(maxBytes)} limit for the selected channel. Please remove it and upload a smaller file.`);
    const allowed = expected === "video" ? ["video/mp4"] : ["image/jpeg", "image/png", "image/webp"];
    if (!info.contentType || !allowed.includes(info.contentType)) throw new Error("Only JPG, PNG, WebP images and MP4 video are supported.");
    const url = `${import.meta.env['VITE_SUPABASE_URL']}/storage/v1/object/public/${MEDIA_BUCKET}/${attachment.path}`;
    resolved.push({ type: attachment.type, url });
  }
  return resolved;
}

export const createBufferPosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    channelIds: z.array(z.string().min(1).max(100)).min(1).max(20),
    text: z.string().trim().max(5000),
    action: z.enum(["draft", "queue", "schedule", "publish"]),
    dueAt: z.string().datetime().optional(),
    ideaId: z.string().max(100).optional(),
    media: mediaInput,
  }).refine((v) => v.text.length > 0 || (v.action === "publish" && v.media.length > 0), { message: "Add text or media." }).parse(d))
  .handler(async ({ data, context }): Promise<WriteResult> => {
    if (data.action === "schedule") {
      if (!data.dueAt || new Date(data.dueAt).getTime() < Date.now() + 60_000) {
        return { status: "error", message: "Pick a date and time at least a minute in the future." };
      }
    }
    const ch = await loadChannels(context.userId, false);
    if (ch.status !== "ok") return ch;
    const byId = new Map(ch.channels.map((c) => [c.id, c]));
    for (const id of data.channelIds) {
      const c = byId.get(id);
      if (!c) return { status: "error", message: "One of the selected channels wasn't found. Please refresh." };
      if (data.text.length > charLimit(c.service)) {
        return { status: "error", message: `Too long for ${c.name} (max ${charLimit(c.service)} characters).` };
      }
    }
    const limits = effectiveMediaLimits(data.channelIds.map((id) => byId.get(id)!));
    const violation = checkMediaAgainstLimits(data.media.map((m) => ({ name: m.path, size: 0, kind: m.type })), limits);
    if (violation) return { status: "error", message: violation };
    const r = await guard(async () => {
      let media;
      try { media = await resolveMedia(context.userId, data.media, false, limits); }
      catch (e) { return { status: "error" as const, message: e instanceof Error ? e.message : "Couldn't validate the attachments." }; }
      const token = await getToken(context.userId);
      const results: ChannelOutcome[] = [];
      const tracking = await import("@/lib/media-tracking.server");
      const operation = await tracking.protectMedia(context.userId, data.media);
      let uncertain = false;
      for (const channelId of data.channelIds) {
        const input: Record<string, unknown> = {
          channelId, text: data.text, assets: postAssets(media), schedulingType: "automatic", needsApproval: false,
          mode: data.action === "schedule" ? "customScheduled" : data.action === "publish" ? "shareNow" : "addToQueue",
          saveToDraft: data.action === "draft",
        };
        if (data.action === "schedule") input["dueAt"] = data.dueAt;
        if (data.ideaId) input["ideaId"] = data.ideaId;
        try {
          const d = await gql(token, `mutation($input: CreatePostInput!) { createPost(input: $input) { ${POST_RESULT} } }`, { input });
          const p = d?.createPost;
          if (p?.__typename === "PostActionSuccess") {
            if (!p.post?.id) { uncertain = true; throw new Error("Missing saved post id"); }
            try { await tracking.recordSavedMedia(context.userId, data.media, String(p.post.id), data.action); }
            catch {
              uncertain = true;
              results.push({ channelId, ok: true, message: "Saved in Buffer. Attachment tracking is pending; files remain protected." });
              continue;
            }
          }
          results.push(p?.__typename === "PostActionSuccess"
            ? { channelId, ok: true, message: "Done" }
            : { channelId, ok: false, message: p?.message ? `Buffer said: ${p.message}` : "Buffer rejected this post." });
        } catch (e) {
          uncertain = true;
          if (e instanceof Reconnect) throw e;
          results.push({ channelId, ok: false, message: "Buffer couldn't process this post." });
        }
      }
      if (!uncertain) await tracking.finishMediaOperation(operation);
      return { status: "ok" as const, results };
    });
    clearCache(context.userId);
    return r;
  });

export const editBufferDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().min(1).max(100), text: z.string().trim().min(1).max(5000) }).parse(d))
  .handler(async ({ data, context }): Promise<WriteResult> => {
    const r = await guard(async () => {
      const token = await getToken(context.userId);
      // Keep it a draft: saveToDraft true, no mode/dueAt change.
      const d = await gql(token, `mutation($input: EditPostInput!) { editPost(input: $input) { ${POST_RESULT} } }`,
        { input: { id: data.id, text: data.text, saveToDraft: true } });
      const p = d?.editPost;
      const ok = p?.__typename === "PostActionSuccess";
      return { status: "ok" as const, results: [{ channelId: "", ok, message: ok ? "Draft updated." : p?.message ? `Buffer said: ${p.message}` : "Buffer couldn't update the draft." }] };
    });
    clearCache(context.userId);
    return r;
  });

export const deleteBufferDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data, context }): Promise<WriteResult> => {
    const r = await guard(async () => {
      const token = await getToken(context.userId);
      const d = await gql(token, `mutation($input: DeletePostInput!) { deletePost(input: $input) {
        __typename ... on DeletePostSuccess { id } ... on MutationError { message } } }`, { input: { id: data.id } });
      const p = d?.deletePost;
      const ok = p?.__typename === "DeletePostSuccess";
      if (ok) {
        // Remove attached files that no other saved post or idea still uses.
        const tracking = await import("@/lib/media-tracking.server");
        await tracking.releaseMedia(data.id);
      }
      return { status: "ok" as const, results: [{ channelId: "", ok, message: ok ? "Draft deleted." : p?.message ? `Buffer said: ${p.message}` : "Buffer couldn't delete the draft." }] };
    });
    clearCache(context.userId);
    return r;
  });

export type BufferIdea = { id: string; title: string; text: string; createdAt: number | null };
export type IdeasResult = { status: "ok"; ideas: BufferIdea[] } | { status: "reconnect" } | { status: "error" };

export const getBufferIdeas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(forceInput)
  .handler(({ data, context }) => cached(`${context.userId}:ideas`, !!data?.force, () => guard(async () => {
    const token = await getToken(context.userId);
    const ideas: BufferIdea[] = [];
    for (const org of await orgIds(token)) {
      const d = await gql(token, `query($input: IdeasInput!, $first: Int) { ideas(input: $input, first: $first) {
        edges { node { id createdAt content { title text } } } } }`, { first: 50, input: { organizationId: org } });
      for (const e of d?.ideas?.edges ?? []) {
        ideas.push({ id: String(e.node.id), title: e.node.content?.title ?? "", text: e.node.content?.text ?? "", createdAt: e.node.createdAt ?? null });
      }
    }
    ideas.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    return { status: "ok" as const, ideas };
  }) as Promise<IdeasResult>));

export const createBufferIdea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ title: z.string().trim().max(300), text: z.string().trim().max(5000), media: mediaInput })
    .refine((v) => v.title || v.text, "Add a title or text").parse(d))
  .handler(async ({ data, context }): Promise<WriteResult> => {
    const r = await guard(async () => {
      let media;
      try { media = await resolveMedia(context.userId, data.media, true); }
      catch (e) { return { status: "error" as const, message: e instanceof Error ? e.message : "Couldn't validate the attachments." }; }
      const token = await getToken(context.userId);
      const [org] = await orgIds(token);
      if (!org) return { status: "error" as const, message: "No Buffer organization found." };
      const tracking = await import("@/lib/media-tracking.server");
      const operation = await tracking.protectMedia(context.userId, data.media);
      const d = await gql(token, `mutation($input: CreateIdeaInput!) { createIdea(input: $input) {
        __typename ... on Idea { id } ... on IdeaResponse { idea { id } } ... on MutationError { message } } }`,
        { input: { organizationId: org, content: { title: data.title || null, text: data.text || null, media: media.map((m) => ({ url: m.url, type: "image" })) } } });
      const p = d?.createIdea;
      const ok = p?.__typename === "Idea" || p?.__typename === "IdeaResponse";
      if (ok) {
        const id = p?.id ?? p?.idea?.id;
        if (!id) return { status: "error" as const, message: "Buffer saved the idea, but its identifier was unavailable. Its attachments remain protected." };
        try { await tracking.recordSavedMedia(context.userId, data.media, String(id), "idea"); }
        catch { return { status: "ok" as const, results: [{ channelId: "", ok: true, message: "Idea saved in Buffer. Attachment tracking is pending; files remain protected." }] }; }
      }
      await tracking.finishMediaOperation(operation);
      return { status: "ok" as const, results: [{ channelId: "", ok, message: ok ? "Idea saved in Buffer." : p?.message ? `Buffer said: ${p.message}` : "Buffer couldn't save the idea." }] };
    });
    clearCache(context.userId);
    return r;
  });

export type ChannelLimitResult =
  | { status: "ok"; orgs: { used: number; limit: number }[] }
  | { status: "reconnect" }
  | { status: "error" };

// Organization.channelCount and Organization.limits.channels from the official reference.
export const getBufferChannelLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(forceInput)
  .handler(({ data, context }) => cached(`${context.userId}:channel-limit`, !!data?.force, () => guard(async () => {
    const token = await getToken(context.userId);
    const d = await gql(token, "query { account { organizations { channelCount limits { channels } } } }");
    const orgs = (d?.account?.organizations ?? [])
      .map((o: { channelCount?: number; limits?: { channels?: number } }) => ({ used: Number(o.channelCount), limit: Number(o.limits?.channels) }))
      .filter((o: { used: number; limit: number }) => Number.isFinite(o.used) && Number.isFinite(o.limit));
    return { status: "ok" as const, orgs };
  }) as Promise<ChannelLimitResult>));
