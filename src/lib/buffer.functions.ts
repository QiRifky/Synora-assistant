import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { charLimit } from "@/lib/trends.functions";
import { mediaInput, ownsMedia, postAssets, MAX_MEDIA_BYTES, MEDIA_BUCKET, type MediaAttachment } from "@/lib/media";
import { checkMediaAgainstLimits, effectiveMediaLimits, formatBytes, type EffectiveMediaLimits } from "@/lib/media-limits";
import { retryAfterMinutes } from "@/lib/rate-limit";
import { DASHBOARD_COOLDOWN_MS, dashboardPostBudgets, type DashboardRefreshResult, type DashboardSnapshot } from "@/lib/dashboard-shared";

/** Set when Buffer rate-limited us; minutes until retry when Buffer said so. */
export type Busy = { retryAfterMin: number | null };
type Err = { status: "error"; message?: string; busy?: Busy };
type Stale = { stale?: Busy };

export type BufferChannel = { id: string; name: string; service: string; avatar: string | null };
export type ChannelsResult =
  | ({ status: "ok"; channels: BufferChannel[] } & Stale)
  | { status: "reconnect" }
  | Err;

export type PostStatus = "draft" | "scheduled" | "sent";
export type BufferPost = {
  id: string; text: string; channelName: string; service: string;
  dueAt: string | null; sentAt: string | null; createdAt: string | null;
  channelId?: string; thumbs?: string[];
};
export type PostsResult =
  | ({ status: "ok"; posts: BufferPost[]; hasMore: boolean } & Stale)
  | { status: "reconnect" }
  | Err;
export type SummaryResult =
  | ({ status: "ok"; channels: number; counts: Record<PostStatus, { count: number; hasMore: boolean }> } & Stale)
  | { status: "reconnect" }
  | Err;

const PAGE = 50;
const TTL = 60_000;
const STATUSES = ["draft", "scheduled", "sent"] as const;
// Best-effort per-worker caches to stay under Buffer's rate limits. They hold no tokens.
const cache = new Map<string, { at: number; value: unknown }>();
const lastGood = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

/**
 * Serves fresh cache (60s), deduplicates concurrent identical loads, and on a
 * Buffer 429 falls back to the last good result marked `stale` instead of an error.
 */
async function cached<T extends { status: string }>(key: string, force: boolean, run: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < TTL) return hit.value as T;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const p = (async () => {
    const value = await run();
    if (value.status === "ok") {
      cache.set(key, { at: Date.now(), value });
      lastGood.set(key, value);
      return value;
    }
    const busy = (value as Err).busy;
    const prev = lastGood.get(key);
    if (busy && prev) return { ...(prev as object), stale: busy } as unknown as T;
    cache.delete(key);
    return value;
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

class Reconnect extends Error {}
class Failed extends Error {}
class RateLimited extends Error {
  constructor(public retryAfterMin: number | null) { super("rate_limited"); }
}

async function gql(token: string, query: string, variables?: Record<string, unknown>) {
  const res = await fetch("https://api.buffer.com", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await res.json().catch(() => null)) as
    | { data?: any; errors?: { message?: string; extensions?: { code?: string; retryAfter?: unknown } }[] }
    | null;
  const limited = res.status === 429 || !!body?.errors?.some((e) => /RATE_LIMIT/i.test(e.extensions?.code ?? ""));
  if (limited) {
    console.error("buffer api rate limited", res.status);
    throw new RateLimited(retryAfterMinutes(res.headers, body?.errors?.[0]?.extensions?.retryAfter));
  }
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

const BUSY_MESSAGE = "Buffer is receiving too many requests right now. Please wait a few minutes and try again.";

async function guard<T>(run: () => Promise<T>): Promise<T | { status: "reconnect" } | Err> {
  try { return await run(); }
  catch (e) {
    if (e instanceof Reconnect) return { status: "reconnect" };
    if (e instanceof RateLimited) return { status: "error", message: BUSY_MESSAGE, busy: { retryAfterMin: e.retryAfterMin } };
    if (!(e instanceof Failed)) console.error("buffer request error");
    return { status: "error" };
  }
}

// ---------- Account (organizations + channel limits) in a single request ----------

type Org = { id: string; used: number | null; limit: number | null };
type OrgsResult = ({ status: "ok"; orgs: Org[] } & Stale) | { status: "reconnect" } | Err;

function loadOrgs(userId: string, force: boolean): Promise<OrgsResult> {
  return cached(`${userId}:account`, force, () => guard(async () => {
    const token = await getToken(userId);
    const d = await gql(token, "query { account { organizations { id channelCount limits { channels } } } }");
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const orgs: Org[] = (d?.account?.organizations ?? []).map((o: { id: string; channelCount?: number; limits?: { channels?: number } }) => ({
      id: String(o.id), used: num(o.channelCount), limit: num(o.limits?.channels),
    }));
    return { status: "ok" as const, orgs };
  }) as Promise<OrgsResult>);
}

async function orgIdsFor(userId: string): Promise<string[]> {
  const r = await loadOrgs(userId, false);
  if (r.status === "reconnect") throw new Reconnect();
  if (r.status !== "ok") { if (r.busy) throw new RateLimited(r.busy.retryAfterMin); throw new Failed(); }
  return r.orgs.map((o) => o.id);
}

/** Builds one aliased GraphQL request covering every organization. */
function aliased(orgs: string[], field: (alias: string, v: string) => string) {
  const decl = orgs.map((_, i) => `$o${i}: OrganizationId!`).join(", ");
  const body = orgs.map((_, i) => field(`o${i}`, `$o${i}`)).join("\n");
  const vars = Object.fromEntries(orgs.map((o, i) => [`o${i}`, o]));
  return { query: `query(${decl}) { ${body} }`, vars };
}

function loadChannels(userId: string, force: boolean): Promise<ChannelsResult> {
  return cached(`${userId}:channels`, force, () => guard(async () => {
    const orgs = await orgIdsFor(userId);
    const channels: BufferChannel[] = [];
    if (orgs.length) {
      const token = await getToken(userId);
      const { query, vars } = aliased(orgs, (a, v) => `${a}: channels(input: { organizationId: ${v} }) { id name displayName service avatar }`);
      const d = await gql(token, query, vars);
      orgs.forEach((_, i) => {
        for (const c of d?.[`o${i}`] ?? []) {
          channels.push({ id: String(c.id), name: c.displayName || c.name || "Unnamed", service: String(c.service ?? ""), avatar: c.avatar || null });
        }
      });
    }
    return { status: "ok" as const, channels };
  }) as Promise<ChannelsResult>);
}

type AllPosts = ({ status: "ok"; byStatus: Record<PostStatus, { posts: BufferPost[]; hasMore: boolean }> } & Stale) | { status: "reconnect" } | Err;

/** Drafts, scheduled and sent posts for every organization in one request. */
function loadAllPosts(userId: string, force: boolean, dashboard = false): Promise<AllPosts> {
  return cached(`${userId}:${dashboard ? "dashboard-posts" : "posts"}`, force, () => guard(async () => {
    const ch = await loadChannels(userId, false);
    const names = new Map(ch.status === "ok" ? ch.channels.map((c) => [c.id, c.name]) : []);
    const orgs = await orgIdsFor(userId);
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, { posts: [] as BufferPost[], hasMore: false }])) as Record<PostStatus, { posts: BufferPost[]; hasMore: boolean }>;
    if (orgs.length) {
      const token = await getToken(userId);
      const parts: string[] = [];
      const vars: Record<string, unknown> = { first: PAGE };
      const decl: string[] = ["$first: Int"];
      const budgets = dashboardPostBudgets(orgs.length);
      orgs.forEach((org, i) => STATUSES.forEach((s) => {
        const sort = s === "scheduled" ? [{ field: "dueAt", direction: "asc" }] : [{ field: s === "sent" ? "dueAt" : "createdAt", direction: "desc" }];
        const k = `${s}${i}`;
        const budget = budgets[i * 3 + STATUSES.indexOf(s)] ?? 0;
        if (dashboard && budget === 0) { byStatus[s].hasMore = true; return; }
        decl.push(`$${k}: PostsInput!`);
        vars[k] = { organizationId: org, filter: { status: [s] }, sort };
        parts.push(`${k}: posts(input: $${k}, first: ${dashboard ? budget : "$first"}) { edges { node { id text channelId channelService dueAt sentAt createdAt assets { thumbnail type } } } pageInfo { hasNextPage } }`);
      }));
      if (dashboard) { decl.shift(); delete vars["first"]; }
      const d = await gql(token, `query(${decl.join(", ")}) { ${parts.join("\n")} }`, vars);
      orgs.forEach((_, i) => STATUSES.forEach((s) => {
        const conn = d?.[`${s}${i}`];
        byStatus[s].hasMore ||= !!conn?.pageInfo?.hasNextPage;
        for (const e of conn?.edges ?? []) {
          const n = e.node;
          byStatus[s].posts.push({
            id: String(n.id), text: n.text ?? "", channelName: names.get(String(n.channelId)) ?? "Unknown channel",
            service: String(n.channelService ?? ""), dueAt: n.dueAt ?? null, sentAt: n.sentAt ?? null, createdAt: n.createdAt ?? null,
            channelId: String(n.channelId ?? ""),
            thumbs: (n.assets ?? []).map((a: { thumbnail?: string }) => a?.thumbnail).filter((t: unknown): t is string => typeof t === "string" && /^https:\/\//.test(t)).slice(0, 10),
          });
        }
      }));
    }
    return { status: "ok" as const, byStatus };
  }) as Promise<AllPosts>);
}

async function loadPosts(userId: string, status: PostStatus, force: boolean): Promise<PostsResult> {
  const r = await loadAllPosts(userId, force);
  if (r.status !== "ok") return r;
  return { status: "ok", ...r.byStatus[status], ...(r.stale ? { stale: r.stale } : {}) };
}

const forceInput = (d: unknown) => z.object({ force: z.boolean().optional(), savedOnly: z.boolean().optional() }).optional().parse(d);

async function savedSnapshotFor(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("dashboard_snapshots").select("snapshot").eq("user_id", userId).maybeSingle();
  return data?.snapshot as DashboardSnapshot | null;
}

// Never log or return tokens.
export const getBufferChannels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(forceInput)
  .handler(async ({ data, context }): Promise<ChannelsResult> => data?.savedOnly
    ? { status: "ok", channels: (await savedSnapshotFor(context.userId))?.channels ?? [] }
    : loadChannels(context.userId, !!data?.force));

export const getBufferPosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ status: z.enum(["draft", "scheduled", "sent"]), force: z.boolean().optional(), savedOnly: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }): Promise<PostsResult> => {
    if (!data.savedOnly) return loadPosts(context.userId, data.status, !!data.force);
    const snapshot = await savedSnapshotFor(context.userId);
    return { status: "ok", posts: snapshot?.posts.filter((p) => p.status === data.status) ?? [], hasMore: snapshot?.counts[data.status].hasMore ?? false };
  });

export const getBufferSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(forceInput)
  .handler(async ({ data, context }): Promise<SummaryResult> => {
    const force = !!data?.force;
    if (force) await loadOrgs(context.userId, true);
    const ch = await loadChannels(context.userId, force);
    if (ch.status !== "ok") return ch;
    const all = await loadAllPosts(context.userId, force);
    if (all.status !== "ok") return all;
    const counts = Object.fromEntries(STATUSES.map((s) => [s, { count: all.byStatus[s].posts.length, hasMore: all.byStatus[s].hasMore }])) as Record<PostStatus, { count: number; hasMore: boolean }>;
    const stale = ch.stale ?? all.stale;
    return { status: "ok", channels: ch.channels.length, counts, ...(stale ? { stale } : {}) };
  });

/** Only the Dashboard's explicit refresh calls this; DB lock protects all tabs/workers. */
export const refreshDashboardSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardRefreshResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;
    const read = async () => {
      const { data, error } = await supabaseAdmin.from("dashboard_snapshots").select("snapshot, updated_at, cooldown_until").eq("user_id", uid).maybeSingle();
      if (error) throw new Failed();
      return { snapshot: data?.snapshot as DashboardSnapshot | null ?? null, updatedAt: data?.updated_at ?? null, cooldownUntil: data?.cooldown_until ?? null };
    };
    const { data: conn } = await supabaseAdmin.from("buffer_connections").select("buffer_account_id").eq("user_id", uid).maybeSingle();
    if (!conn) return { ...await read(), status: "reconnect" };
    const refreshId = crypto.randomUUID();
    const { data: claimed, error: claimError } = await supabaseAdmin.rpc("claim_dashboard_refresh", { p_user_id: uid, p_account_id: conn.buffer_account_id, p_refresh_id: refreshId });
    if (!claimed || claimError) return { ...await read(), status: claimError ? "error" : "cooldown" };
    let status: DashboardRefreshResult["status"] = "error";
    try {
      const orgs = await loadOrgs(uid, false);
      if (orgs.status !== "ok") { if (orgs.status === "reconnect") throw new Reconnect(); if (orgs.busy) throw new RateLimited(orgs.busy.retryAfterMin); throw new Failed(); }
      if (orgs.stale) throw new RateLimited(orgs.stale.retryAfterMin);
      const channels = await loadChannels(uid, false);
      if (channels.status !== "ok") { if (channels.status === "reconnect") throw new Reconnect(); if (channels.busy) throw new RateLimited(channels.busy.retryAfterMin); throw new Failed(); }
      if (channels.stale) throw new RateLimited(channels.stale.retryAfterMin);
      const all = await loadAllPosts(uid, false, true);
      if (all.status !== "ok") { if (all.status === "reconnect") throw new Reconnect(); if (all.busy) throw new RateLimited(all.busy.retryAfterMin); throw new Failed(); }
      if (all.stale) throw new RateLimited(all.stale.retryAfterMin);
      const snapshot: DashboardSnapshot = {
        channels: channels.channels,
        counts: Object.fromEntries(STATUSES.map((s) => [s, { count: all.byStatus[s].posts.length, hasMore: all.byStatus[s].hasMore }])) as DashboardSnapshot["counts"],
        posts: STATUSES.flatMap((s) => all.byStatus[s].posts.map((p) => ({ ...p, status: s }))).sort((a,b) => Date.parse(b.sentAt ?? b.createdAt ?? b.dueAt ?? "") - Date.parse(a.sentAt ?? a.createdAt ?? a.dueAt ?? "")),
      };
      const { error } = await supabaseAdmin.from("dashboard_snapshots").update({ snapshot, updated_at: new Date().toISOString(), cooldown_until: new Date(Date.now() + DASHBOARD_COOLDOWN_MS).toISOString() }).eq("user_id", uid).eq("refresh_id", refreshId);
      status = error ? "error" : "ok";
    } catch (e) {
      status = e instanceof RateLimited ? "busy" : e instanceof Reconnect ? "reconnect" : "error";
      if (e instanceof RateLimited) await supabaseAdmin.from("dashboard_snapshots").update({ cooldown_until: new Date(Date.now() + (e.retryAfterMin === null ? DASHBOARD_COOLDOWN_MS : e.retryAfterMin * 60_000)).toISOString() }).eq("user_id", uid).eq("refresh_id", refreshId);
    } finally {
      await supabaseAdmin.from("dashboard_snapshots").update({ refresh_id: null, lock_until: null }).eq("user_id", uid).eq("refresh_id", refreshId);
    }
    return { ...await read(), status };
  });

// ---------- Writes (never publish automatically; scheduling only on explicit user action) ----------

function clearCache(userId: string) {
  for (const k of cache.keys()) if (k.startsWith(`${userId}:`)) cache.delete(k);
}

export type ChannelOutcome = { channelId: string; ok: boolean; message: string };
export type WriteResult =
  | { status: "ok"; results: ChannelOutcome[] }
  | { status: "reconnect" }
  | Err;

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
export type IdeasResult = ({ status: "ok"; ideas: BufferIdea[] } & Stale) | { status: "reconnect" } | Err;

export const getBufferIdeas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(forceInput)
  .handler(({ data, context }) => data?.savedOnly ? Promise.resolve((cache.get(`${context.userId}:ideas`)?.value ?? lastGood.get(`${context.userId}:ideas`) ?? { status: "ok", ideas: [] }) as IdeasResult) : cached(`${context.userId}:ideas`, !!data?.force, () => guard(async () => {
    const orgs = await orgIdsFor(context.userId);
    const token = await getToken(context.userId);
    const ideas: BufferIdea[] = [];
    for (const org of orgs) {
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
      const [org] = await orgIdsFor(context.userId);
      const token = await getToken(context.userId);
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
  | ({ status: "ok"; orgs: { used: number; limit: number }[] } & Stale)
  | { status: "reconnect" }
  | Err;

// Organization.channelCount and Organization.limits.channels, shared with the account request.
export const getBufferChannelLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(forceInput)
  .handler(async ({ data, context }): Promise<ChannelLimitResult> => {
    const r = await loadOrgs(context.userId, !!data?.force);
    if (r.status !== "ok") return r;
    const orgs = r.orgs.flatMap((o) => (o.used !== null && o.limit !== null ? [{ used: o.used, limit: o.limit }] : []));
    return { status: "ok", orgs, ...(r.stale ? { stale: r.stale } : {}) };
  });

// ---------- Settings: connection status and local data removal (never touches the Buffer account) ----------

function forgetUser(userId: string) {
  for (const m of [cache, lastGood] as Map<string, unknown>[]) for (const k of [...m.keys()]) if (k.startsWith(`${userId}:`)) m.delete(k);
}

export type ConnectionStatus = { status: "connected" | "reconnect"; channelCount: number | null; channels: BufferChannel[] | null };

/** Reads only stored connection metadata and already-cached channels; makes no Buffer API request. */
export const getBufferConnectionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConnectionStatus> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conn } = await supabaseAdmin
      .from("buffer_connections").select("token_expires_at").eq("user_id", context.userId).maybeSingle();
    const expired = !!conn?.token_expires_at && new Date(conn.token_expires_at).getTime() < Date.now();
    const known = (cache.get(`${context.userId}:channels`)?.value ?? lastGood.get(`${context.userId}:channels`)) as ChannelsResult | undefined;
    const channels = known?.status === "ok" ? known.channels : null;
    return { status: conn && !expired ? "connected" : "reconnect", channelCount: channels?.length ?? null, channels };
  });

export const disconnectBuffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("buffer_connections").delete().eq("user_id", context.userId);
    forgetUser(context.userId);
    if (error) console.error("disconnect buffer failed", error.code);
    return { ok: !error };
  });

/** Removes Synora-side data only: preferences, uploaded files, usage counters, media references and Buffer tokens. */
export const deleteMySynoraData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ confirm: z.literal("DELETE") }).parse(d))
  .handler(async ({ context }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;
    let ok = true;
    const bucket = supabaseAdmin.storage.from(MEDIA_BUCKET);
    for (let round = 0; round < 50; round++) {
      const { data: files, error } = await bucket.list(uid, { limit: 100 });
      if (error) { ok = false; break; }
      const paths = (files ?? []).filter((f) => f.name).map((f) => `${uid}/${f.name}`).filter((p) => ownsMedia(p, uid));
      if (!paths.length) break;
      const { error: rmErr } = await bucket.remove(paths);
      if (rmErr) { ok = false; break; }
      await supabaseAdmin.from("media_cleanup_claims").delete().in("path", paths);
    }
    const steps = await Promise.all([
      supabaseAdmin.from("media_references").delete().eq("user_id", uid),
      supabaseAdmin.from("magic_caption_usage").delete().eq("user_id", uid),
      supabaseAdmin.from("user_preferences").delete().eq("user_id", uid),
      supabaseAdmin.from("buffer_connections").delete().eq("user_id", uid),
      supabaseAdmin.from("dashboard_snapshots").delete().eq("user_id", uid),
    ]);
    if (steps.some((s) => s.error)) ok = false;
    forgetUser(uid);
    if (!ok) console.error("delete synora data incomplete");
    return { ok };
  });
