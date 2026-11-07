import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getBufferChannelLimit, getBufferChannels, getBufferPosts, getBufferSummary, type BufferChannel, type BufferPost, type PostStatus } from "@/lib/buffer.functions";
import { getDashboardData, type DashboardData } from "@/lib/dashboard.functions";
import { formatBytes } from "@/lib/media-limits";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { SidebarNav, type NavGroupData } from "@/components/ui/dashboard-sidebar";
import { Sparkles, CalendarClock, SlidersHorizontal, Image as ImageIcon, Wand2, Hash } from "lucide-react";
import { NewPost, DraftActions, IdeasView, type Prefill } from "@/components/dashboard-posts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Radio, FileText, FileEdit, Lightbulb, Compass, CalendarDays, RefreshCw, ExternalLink } from "lucide-react";
import { CalendarView } from "@/components/calendar-view";
import { SettingsView } from "@/components/settings-view";
import { importArticle, saveBufferDraft } from "@/lib/compose.functions";
import synoraLogo from "@/assets/synora-logo.png.asset.json";

import { collectTrends, findTopics, generateIdeas, createTopicDraft, type TrendItem, type Topic, type Idea } from "@/lib/trends.functions";

type Channel = { id: string; name: string; service: string };

function Trends({ channel }: { channel?: Channel | undefined }) {
  const runCollect = useServerFn(collectTrends);
  const runTopics = useServerFn(findTopics);
  const [niche, setNiche] = useState("");
  const [feeds, setFeeds] = useState(["", "", ""]);
  const [items, setItems] = useState<TrendItem[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [busy, setBusy] = useState<"collect" | "topics" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground";

  async function doCollect(e: React.FormEvent) {
    e.preventDefault();
    setBusy("collect"); setError(null); setTopics([]); setItems([]); setFailed([]);
    try {
      const r = await runCollect({ data: { niche: niche.trim(), feeds: feeds.map((f) => f.trim()).filter(Boolean) } });
      setItems(r.items); setFailed(r.failed);
      if (!r.items.length) setError("No items found. Try a different niche or feed.");
    } catch { setError("Couldn't collect trends. Check your niche and feed links."); }
    setBusy(null);
  }
  async function doTopics() {
    setBusy("topics"); setError(null);
    try {
      const r = await runTopics({ data: { niche: niche.trim(), items: items.map((i) => ({ title: i.title, link: i.link })) } });
      if (r.ok) setTopics(r.topics); else setError(r.error);
    } catch { setError("Couldn't find topics right now. Please try again."); }
    setBusy(null);
  }

  return (
    <section className="mt-8 border-t border-border pt-8">
      <h2 className="text-sm uppercase tracking-widest text-muted-foreground">Discover trends</h2>
      <form onSubmit={doCollect} className="mt-3 space-y-3">
        <input required minLength={2} placeholder="e.g. AI tools for creators" value={niche} onChange={(e) => setNiche(e.target.value)} className={input} aria-label="Your niche" />
        {feeds.map((f, i) => (
          <input key={i} type="url" placeholder={`Optional RSS feed URL ${i + 1}`} value={f}
            onChange={(e) => setFeeds(feeds.map((x, j) => (j === i ? e.target.value : x)))} className={input} aria-label={`RSS feed ${i + 1}`} />
        ))}
        <button type="submit" disabled={busy !== null || niche.trim().length < 2} className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {busy === "collect" ? "Collecting trends…" : "Collect trends"}
        </button>
      </form>
      {failed.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">Couldn't load: {failed.join(", ")}</p>
      )}
      {items.length > 0 && (
        <>
          <ul className="mt-4 max-h-96 divide-y divide-border overflow-y-auto rounded-xl border border-border">
            {items.map((it) => (
              <li key={it.link} className="px-4 py-3">
                <a href={it.link} target="_blank" rel="noreferrer noopener" className="text-sm text-foreground hover:underline">{it.title}</a>
                <p className="mt-1 text-xs text-muted-foreground">
                  {it.source}{it.date ? ` · ${new Date(it.date).toLocaleDateString()}` : ""}
                </p>
              </li>
            ))}
          </ul>
          <button onClick={doTopics} disabled={busy !== null} className="mt-4 inline-flex h-11 items-center rounded-full border border-border px-6 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50">
            {busy === "topics" ? "Finding topics…" : "Find potential topics"}
          </button>
        </>
      )}
      {topics.length > 0 && (
        <ol className="mt-4 space-y-3">
          {topics.map((t, i) => (
            <li key={i} className="rounded-xl border border-border p-4">
              <p className="font-display text-lg text-foreground">{i + 1}. {t.topic}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t.reason}</p>
              <ul className="mt-2 space-y-1">
                {t.links.map((l) => (
                  <li key={l.link}><a href={l.link} target="_blank" rel="noreferrer noopener" className="text-xs text-primary hover:underline">{l.title}</a></li>
                ))}
              </ul>
              <TopicTools niche={niche.trim()} topic={t} channel={channel} />
            </li>
          ))}
        </ol>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    </section>
  );
}

function ReconnectButton() {
  return (
    <a href="/api/public/buffer/start" className="mt-3 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground">
      Reconnect Buffer
    </a>
  );
}

function TopicTools({ niche, topic, channel }: { niche: string; topic: Topic; channel?: Channel | undefined }) {
  const runIdeas = useServerFn(generateIdeas);
  const runDraft = useServerFn(createTopicDraft);
  const runSave = useServerFn(saveBufferDraft);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [draft, setDraft] = useState("");
  const [limit, setLimit] = useState(0);
  const [busy, setBusy] = useState<"ideas" | "draft" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reconnect, setReconnect] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const payload = { niche, topic: topic.topic, reason: topic.reason, links: topic.links };
  const btn = "inline-flex h-9 items-center rounded-full border border-border px-4 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50";

  async function doIdeas() {
    setBusy("ideas"); setError(null);
    try { const r = await runIdeas({ data: payload }); if (r.ok) setIdeas(r.ideas); else setError(r.error); }
    catch { setError("Couldn't get content ideas. Please try again."); }
    setBusy(null);
  }
  async function doDraft() {
    if (!channel) return;
    setBusy("draft"); setError(null); setSaved(null);
    try {
      const r = await runDraft({ data: { ...payload, service: channel.service } });
      if (r.ok) { setDraft(r.draft); setLimit(r.limit); } else setError(r.error);
    } catch { setError("Couldn't create a draft. Please try again."); }
    setBusy(null);
  }
  async function doSave() {
    if (!channel) return;
    setBusy("save"); setError(null); setSaved(null); setReconnect(false);
    try {
      const r = await runSave({ data: { channelId: channel.id, text: draft } });
      if (r.ok) setSaved(`Saved as a draft in Buffer for ${channel.name}. Nothing was published or scheduled.`);
      else { setError(r.error); setReconnect(!!r.reconnect); }
    } catch { setError("Couldn't save the draft. Please try again."); }
    setBusy(null);
  }
  const over = limit > 0 && draft.length > limit;

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex flex-wrap gap-2">
        <button onClick={doIdeas} disabled={busy !== null} className={btn}>{busy === "ideas" ? "Thinking of ideas…" : "Content ideas"}</button>
        <button onClick={doDraft} disabled={busy !== null || !channel} className={btn}>
          {busy === "draft" ? "Writing draft…" : channel ? `Create draft for ${channel.name}` : "Create draft (no channel)"}
        </button>
      </div>
      {ideas.length > 0 && (
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          {ideas.map((d, i) => (
            <li key={i} className="text-sm"><span className="text-foreground">{d.hook}</span><span className="block text-xs text-muted-foreground">{d.angle}</span></li>
          ))}
        </ol>
      )}
      {draft && (
        <div className="mt-3 space-y-2">
          <textarea value={draft} onChange={(e) => { setDraft(e.target.value); setSaved(null); }} rows={6}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground" aria-label="Topic post draft" />
          <p className={`text-xs ${over ? "text-destructive" : "text-muted-foreground"}`}>{draft.length} / {limit} characters</p>
          <button onClick={doSave} disabled={busy !== null || !draft.trim() || over || !channel} className={btn}>
            {busy === "save" ? "Saving…" : "Save as draft in Buffer"}
          </button>
        </div>
      )}
      {saved && <p className="mt-2 text-sm text-foreground">{saved}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      {reconnect && <ReconnectButton />}
    </div>
  );
}

function Composer({ channels, channelId, setChannelId }: { channels: Channel[]; channelId: string; setChannelId: (id: string) => void }) {
  const runImport = useServerFn(importArticle);
  const runSave = useServerFn(saveBufferDraft);
  const [url, setUrl] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<"import" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reconnect, setReconnect] = useState(false);
  const [saved, setSaved] = useState(false);
  const channel = channels.find((c) => c.id === channelId);

  async function doImport(e: React.FormEvent) {
    e.preventDefault();
    setBusy("import"); setError(null); setSaved(false);
    try {
      const r = await runImport({ data: { url: url.trim(), service: channel?.service ?? "" } });
      if (r.ok) setDraft(r.draft); else setError(r.error);
    } catch { setError("Please enter a valid article link."); }
    setBusy(null);
  }
  async function doSave() {
    setBusy("save"); setError(null); setSaved(false);
    try {
      const r = await runSave({ data: { channelId, text: draft } });
      if (r.ok) setSaved(true); else { setError(r.error); setReconnect(!!r.reconnect); }
    } catch { setError("Couldn't save the draft. Please try again."); }
    setBusy(null);
  }

  const input = "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground";
  return (
    <section className="mt-8 border-t border-border pt-8">
      <h2 className="text-sm uppercase tracking-widest text-muted-foreground">Turn an article into a post</h2>
      <form onSubmit={doImport} className="mt-3 space-y-3">
        <input type="url" required placeholder="https://example.com/article" value={url} onChange={(e) => setUrl(e.target.value)} className={input} aria-label="Article URL" />
        <select value={channelId} onChange={(e) => setChannelId(e.target.value)} className={input} aria-label="Channel">
          {channels.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.service})</option>)}
        </select>
        <button type="submit" disabled={busy !== null || !url} className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {busy === "import" ? "Reading article and writing draft…" : "Import article"}
        </button>
      </form>
      {draft && (
        <div className="mt-5 space-y-3">
          <textarea value={draft} onChange={(e) => { setDraft(e.target.value); setSaved(false); }} rows={7} className={input} aria-label="Post draft" />
          <button onClick={doSave} disabled={busy !== null || !draft.trim() || !channelId} className="inline-flex h-11 items-center rounded-full border border-border px-6 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50">
            {busy === "save" ? "Saving…" : "Save as draft in Buffer"}
          </button>
        </div>
      )}
      {saved && <p className="mt-3 text-sm text-foreground">Saved as a draft in Buffer{channel ? ` for ${channel.name}` : ""}.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      {reconnect && <ReconnectButton />}
    </section>
  );
}

export const Route = createFileRoute("/app")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/" });
    return { user: data.user };
  },
  head: () => ({
    meta: [
      { title: "Dashboard — Synora" },
      { name: "description", content: "Your Synora dashboard for Buffer channels, posts and ideas." },
      { property: "og:title", content: "Dashboard — Synora" },
      { property: "og:description", content: "Your Synora dashboard for Buffer channels, posts and ideas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppPage,
});

export type View = "overview" | "channels" | "posts" | "drafts" | "calendar" | "ideas" | "discover" | "photo" | "settings";
export const NAV: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "channels", label: "Channels", icon: Radio },
  { id: "posts", label: "Posts", icon: FileText },
  { id: "drafts", label: "Drafts", icon: FileEdit },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "ideas", label: "Ideas", icon: Lightbulb },
  { id: "discover", label: "Discover", icon: Compass },
  { id: "photo", label: "Photo Studio", icon: ImageIcon },
];

const navItem = (id: View) => { const n = NAV.find((x) => x.id === id)!; return { id: n.id, title: n.label, icon: n.icon }; };
const NAV_GROUPS: NavGroupData<View>[] = [
  { items: [navItem("overview")] },
  { heading: "Create", icon: Sparkles, items: [navItem("photo"), navItem("ideas"), navItem("discover")] },
  { heading: "Plan & Ship", icon: CalendarClock, items: [navItem("posts"), navItem("drafts"), navItem("calendar")] },
  { heading: "Set up", icon: SlidersHorizontal, items: [navItem("channels")] },
];

function PageHeader({ title, onRefresh, busy }: { title: string; onRefresh?: () => void; busy?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h1 className="font-display text-3xl text-foreground">{title}</h1>
      {onRefresh && (
        <button onClick={onRefresh} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-4 text-sm text-foreground hover:bg-muted disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Refresh
        </button>
      )}
    </div>
  );
}

type Busy = { retryAfterMin: number | null };
const waitText = (b?: Busy | null) => b?.retryAfterMin ? ` Try again in about ${b.retryAfterMin} minute${b.retryAfterMin === 1 ? "" : "s"}.` : " Please wait a few minutes and try again.";

function Problem({ res }: { res: { status: string; busy?: Busy } }) {
  if (res.status === "reconnect") {
    return (
      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">Please sign in with Buffer again.</p>
        <ReconnectButton />
      </div>
    );
  }
  if (res.busy) return <p role="alert" className="mt-6 text-sm text-destructive">Buffer is receiving too many requests right now.{waitText(res.busy)}</p>;
  return <p role="alert" className="mt-6 text-sm text-destructive">Couldn't reach Buffer right now. Please try Refresh in a moment.</p>;
}

/** Shown when Buffer rate-limited us and we're displaying the last saved data. */
function StaleBanner({ res }: { res: { status: string; stale?: Busy } | null }) {
  if (res?.status !== "ok" || !res.stale) return null;
  return <p role="status" className="mt-4 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground">Buffer is busy, showing saved data.{waitText(res.stale)}</p>;
}

function Skeletons({ n = 3 }: { n?: number }) {
  return (
    <div className="mt-6 space-y-3">
      {Array.from({ length: n }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}
    </div>
  );
}

const MANUAL_GAP = 30_000;

/** Loads once the tab is visible; manual refresh bypasses the cache at most every 30s. */
function useLoad<T>(load: (force: boolean) => Promise<T>, deps: unknown[] = []) {
  const [res, setRes] = useState<T | { status: "error" } | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const lastForced = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  const run = useCallback((force: boolean) => {
    if (busyRef.current || document.hidden) return;
    if (force) {
      if (Date.now() - lastForced.current < MANUAL_GAP) return;
      lastForced.current = Date.now();
    }
    busyRef.current = true;
    setBusy(true);
    if (!force) setRes(null);
    loadRef.current(force).then(setRes).catch(() => setRes({ status: "error" }))
      .finally(() => { busyRef.current = false; setBusy(false); });
  }, []);
  useEffect(() => {
    if (!document.hidden) { run(false); return; }
    const onVisible = () => { if (!document.hidden) { document.removeEventListener("visibilitychange", onVisible); run(false); } };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  const refresh = useCallback(() => run(true), [run]);
  return { res, busy, refresh };
}

const OVERVIEW_LOAD_KEY = "synora-overview-load-at";
const OVERVIEW_COOLDOWN_MS = 10 * 60_000;
const OVERVIEW_AUTO_MS = 30 * 60_000;
// Per-user keys so accounts on the same browser never share guards.
const overviewKey = (userId: string, kind: "loaded" | "attempt" | "limited") => `synora-overview-${kind}:${userId}`;
// Module-level in-flight lock: survives StrictMode double-mounts and fast remounts.
let overviewInflight: Promise<void> | null = null;

type OverviewBuffer =
  | { state: "idle" }
  | { state: "error"; reconnect?: boolean; busy?: Busy | undefined }
  | {
      state: "ok";
      at: number;
      channels: BufferChannel[];
      counts: Record<PostStatus, { count: number; hasMore: boolean }>;
      posts: (BufferPost & { status: PostStatus })[];
      stale?: Busy | undefined;
    };

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-foreground">{label}</span>
        <span className="text-muted-foreground">{used} of {limit} used today</span>
      </div>
      <div role="progressbar" aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit} aria-label={`${label} usage today`} className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
      </div>
    </div>
  );
}

function OverviewView({ onOpenPosts, userId }: { onOpenPosts: () => void; userId: string }) {
  const dashFn = useServerFn(getDashboardData);
  const summaryFn = useServerFn(getBufferSummary);
  const channelsFn = useServerFn(getBufferChannels);
  const postsFn = useServerFn(getBufferPosts);

  // Synora's own database: loads automatically, never touches the Buffer API.
  const [dash, setDash] = useState<DashboardData | null>(null);
  useEffect(() => {
    let on = true;
    dashFn().then((r) => { if (on) setDash(r); }).catch(() => { if (on) setDash({ ok: false }); });
    return () => { on = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Buffer data: one automatic load after sign-in, otherwise only on demand.
  const [buffer, setBuffer] = useState<OverviewBuffer>({ state: "idle" });
  const [loading, setLoading] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(() =>
    Number(localStorage.getItem(OVERVIEW_LOAD_KEY) ?? 0) + OVERVIEW_COOLDOWN_MS);
  const [limitedUntil, setLimitedUntil] = useState(() => Number(localStorage.getItem(overviewKey(userId, "limited")) ?? 0));
  const [now, setNow] = useState(() => Date.now());
  const remaining = Math.max(0, cooldownUntil - now);
  const limitedRemaining = Math.max(0, limitedUntil - now);
  useEffect(() => {
    if (remaining <= 0 && limitedRemaining <= 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [remaining, limitedRemaining]);

  async function loadFromBuffer(manual: boolean) {
    if (overviewInflight) return overviewInflight;
    if (manual && remaining > 0) return;
    if (manual) {
      localStorage.setItem(OVERVIEW_LOAD_KEY, String(Date.now()));
      setCooldownUntil(Date.now() + OVERVIEW_COOLDOWN_MS);
    }
    setLoading(true);
    const run = (async () => {
      try {
        const [summary, channels, draft, scheduled, sent] = await Promise.all([
          summaryFn({ data: { force: manual } }),
          channelsFn({ data: { force: manual } }),
          postsFn({ data: { status: "draft", force: manual } }),
          postsFn({ data: { status: "scheduled", force: manual } }),
          postsFn({ data: { status: "sent", force: manual } }),
        ]);
        if (summary.status === "reconnect" || channels.status === "reconnect") {
          setBuffer({ state: "error", reconnect: true });
        } else if (summary.status !== "ok" || channels.status !== "ok") {
          const busy = ("busy" in summary ? summary.busy : undefined) ?? ("busy" in channels ? channels.busy : undefined);
          setBuffer({ state: "error", busy });
          if (busy) {
            const until = Date.now() + (busy.retryAfterMin ?? 5) * 60_000;
            localStorage.setItem(overviewKey(userId, "limited"), String(until));
            setLimitedUntil(until);
          }
        } else {
          const posts: (BufferPost & { status: PostStatus })[] = [];
          for (const [status, r] of [["draft", draft], ["scheduled", scheduled], ["sent", sent]] as const) {
            if (r.status === "ok") for (const p of r.posts) posts.push({ ...p, status });
          }
          const time = (p: BufferPost) => new Date(p.sentAt ?? p.dueAt ?? p.createdAt ?? 0).getTime();
          posts.sort((a, b) => time(b) - time(a));
          localStorage.setItem(overviewKey(userId, "loaded"), String(Date.now()));
          setBuffer({
            state: "ok", at: Date.now(), channels: channels.channels, counts: summary.counts, posts,
            stale: ("stale" in summary ? summary.stale : undefined) ?? ("stale" in channels ? channels.stale : undefined),
          });
        }
      } catch {
        setBuffer({ state: "error" });
      }
      setLoading(false);
    })().finally(() => { overviewInflight = null; });
    overviewInflight = run;
    return run;
  }

  // One automatic load per user: skipped when data is fresh (< 30 min), an
  // auto-load was already attempted, a rate-limit cooldown is active, or a
  // load is in progress. Never retries, never polls.
  useEffect(() => {
    if (document.hidden) return;
    if (localStorage.getItem(overviewKey(userId, "attempt"))) return;
    if (Date.now() - Number(localStorage.getItem(overviewKey(userId, "loaded")) ?? 0) < OVERVIEW_AUTO_MS) return;
    if (Date.now() < Number(localStorage.getItem(overviewKey(userId, "limited")) ?? 0)) return;
    if (overviewInflight) return;
    localStorage.setItem(overviewKey(userId, "attempt"), String(Date.now()));
    void loadFromBuffer(false);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const mins = Math.floor(remaining / 60_000);
  const secs = Math.ceil((remaining % 60_000) / 1000);
  const loadButton = (
    <button onClick={() => void loadFromBuffer(true)} disabled={loading || remaining > 0}
      className="mt-4 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground disabled:opacity-50">
      {loading ? "Loading from Buffer…" : remaining > 0 ? `Available again in ${mins}:${String(secs).padStart(2, "0")}` : "Load from Buffer"}
    </button>
  );

  const fmt = (c: { count: number; hasMore: boolean }) => `${c.count}${c.hasMore ? "+" : ""}`;
  const perChannel = new Map<string, number>();
  if (buffer.state === "ok") for (const p of buffer.posts) perChannel.set(p.channelId ?? "", (perChannel.get(p.channelId ?? "") ?? 0) + 1);
  const statusLabel: Record<PostStatus, string> = { draft: "Draft", scheduled: "Scheduled", sent: "Sent" };

  return (
    <>
      <PageHeader title="Dashboard" />

      {/* Buffer data — on demand only, to protect Buffer's small API quota. */}
      <section aria-label="Buffer data" className="mt-6">
        {buffer.state === "idle" && loading && (
          <div>
            <p role="status" className="text-sm text-muted-foreground">Loading your Buffer data…</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}</div>
          </div>
        )}
        {buffer.state === "idle" && !loading && (
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Your Buffer posts, drafts and channels aren't loaded on this page yet.</p>
            {limitedRemaining > 0 && <p role="status" className="mt-2 text-sm text-muted-foreground">Buffer is busy right now. Please try again in a few minutes.</p>}
            {loadButton}
          </div>
        )}
        {buffer.state === "error" && (
          <div className="rounded-2xl border border-border bg-card p-6">
            {buffer.reconnect ? (
              <>
                <p className="text-sm text-muted-foreground">Please sign in with Buffer again.</p>
                <ReconnectButton />
              </>
            ) : buffer.busy ? (
              <p role="alert" className="text-sm text-destructive">Buffer is busy right now. Please try again in a few minutes.</p>
            ) : (
              <p role="alert" className="text-sm text-destructive">Couldn't reach Buffer right now. Please try again in a moment.</p>
            )}
            {!buffer.reconnect && loadButton}
          </div>
        )}
        {buffer.state === "ok" && (
          <>
            {buffer.stale && <p role="status" className="rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground">Buffer is busy, showing saved data.{waitText(buffer.stale)}</p>}
            <p className="mt-2 text-xs text-muted-foreground">Last updated {new Date(buffer.at).toLocaleTimeString()} · Post counts include up to 50 most recent per status. "+" means there are more.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Connected channels", String(buffer.channels.length)],
                ["Drafts", fmt(buffer.counts.draft)],
                ["Scheduled posts", fmt(buffer.counts.scheduled)],
                ["Sent posts", fmt(buffer.counts.sent)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
                  <p className="mt-2 font-display text-4xl text-foreground">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Connected channels</h2>
                {buffer.channels.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">No channels connected in Buffer yet.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-border">
                    {buffer.channels.map((c) => (
                      <li key={c.id} className="flex items-center gap-3 py-2.5">
                        {c.avatar
                          ? <img src={c.avatar} alt="" className="h-8 w-8 rounded-full object-cover" loading="lazy" />
                          : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm text-foreground">{c.name.slice(0, 1).toUpperCase()}</span>}
                        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{c.name}</span>
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">{c.service}</span>
                        <span className="text-xs text-muted-foreground">{perChannel.get(c.id) ?? 0} posts</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Recent posts and drafts</h2>
                {buffer.posts.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">Nothing here yet. Start with one post.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-border">
                    {buffer.posts.slice(0, 10).map((p) => {
                      const date = p.sentAt ?? p.dueAt ?? p.createdAt;
                      return (
                        <li key={`${p.status}-${p.id}`} className="py-2.5">
                          <button onClick={onOpenPosts} className="block w-full text-left">
                            <span className="line-clamp-2 text-sm text-foreground">{p.text || "(no text)"}</span>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {statusLabel[p.status]} · {p.channelName}{date ? ` · ${new Date(date).toLocaleDateString()}` : ""}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      {/* Synora's own data — always available, no Buffer calls. */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">AI usage today</h2>
          {!dash && <div className="mt-4 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-8 animate-pulse rounded-lg bg-muted" />)}</div>}
          {dash && !dash.ok && <p role="alert" className="mt-3 text-sm text-destructive">Couldn't load usage right now.</p>}
          {dash?.ok && (
            <div className="mt-4 space-y-4">
              <UsageBar label="Photo to Post" used={dash.ai.photoToPost.used} limit={dash.ai.photoToPost.limit} />
              <UsageBar label="Magic Photo" used={dash.ai.magicPhoto.used} limit={dash.ai.magicPhoto.limit} />
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-foreground">Magic Caption</span>
                <span className="text-muted-foreground">No daily limit</span>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Media</h2>
          {!dash && <div className="mt-4 h-8 animate-pulse rounded-lg bg-muted" />}
          {dash && !dash.ok && <p role="alert" className="mt-3 text-sm text-destructive">Couldn't load media info right now.</p>}
          {dash?.ok && (
            <div className="mt-4 flex gap-8">
              <div>
                <p className="font-display text-3xl text-foreground">{dash.media.files}</p>
                <p className="mt-1 text-xs text-muted-foreground">files linked to saved posts</p>
              </div>
              <div>
                <p className="font-display text-3xl text-foreground">{formatBytes(dash.media.bytes)}</p>
                <p className="mt-1 text-xs text-muted-foreground">total uploaded</p>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Recent activity</h2>
          {!dash && <div className="mt-4 space-y-3">{[0, 1].map((i) => <div key={i} className="h-8 animate-pulse rounded-lg bg-muted" />)}</div>}
          {dash && !dash.ok && <p role="alert" className="mt-3 text-sm text-destructive">Couldn't load activity right now.</p>}
          {dash?.ok && dash.activity.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Nothing here yet. Start with one post.</p>}
          {dash?.ok && dash.activity.length > 0 && (
            <ul className="mt-3 divide-y divide-border">
              {dash.activity.map((a, i) => (
                <li key={i} className="py-2.5">
                  <p className="text-sm text-foreground">{a.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{new Date(a.at).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function ChannelsView() {
  const fn = useServerFn(getBufferChannels);
  const limitFn = useServerFn(getBufferChannelLimit);
  const [limit, setLimit] = useState<Awaited<ReturnType<typeof getBufferChannelLimit>> | null>(null);
  const lastAuto = useRef(Date.now());
  const { res, busy, refresh } = useLoad((force) => {
    limitFn({ data: { force } }).then(setLimit).catch(() => setLimit({ status: "error" }));
    return fn({ data: { force } });
  });
  // Reload when the user returns to this tab, at most once every 2 minutes.
  useEffect(() => {
    const onReturn = () => {
      if (document.hidden || Date.now() - lastAuto.current < 120_000) return;
      lastAuto.current = Date.now();
      refresh();
    };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => { window.removeEventListener("focus", onReturn); document.removeEventListener("visibilitychange", onReturn); };
  }, [refresh]);
  const atLimit = limit?.status === "ok" && limit.orgs.some((o) => o.limit > 0 && o.used >= o.limit);
  const known = limit?.status === "ok" && limit.orgs.length > 0;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-foreground">Channels</h1>
        <div className="flex flex-wrap gap-2">
          <a href="https://publish.buffer.com/settings/channels" target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-sm text-primary-foreground hover:opacity-90">
            <ExternalLink className="h-4 w-4" /> Connect a new channel
          </a>
          <button onClick={refresh} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-4 text-sm text-foreground hover:bg-muted disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Refresh channels
          </button>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">Buffer opens in a new tab. Click 'Connect a channel', choose your network, then come back here and click Refresh.</p>
      {atLimit && <p role="status" className="mt-3 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground">Your Buffer plan allows a limited number of channels. You've reached it, so remove a channel or upgrade in Buffer to add another.</p>}
      {!atLimit && limit && limit.status !== "reconnect" && !known && <p className="mt-3 text-xs text-muted-foreground">Your Buffer plan may limit how many channels you can connect. Buffer will tell you if you reach it.</p>}
      {limit?.status === "ok" && known && !atLimit && <p className="mt-3 text-xs text-muted-foreground">Channels used: {limit.orgs.map((o) => `${o.used} of ${o.limit}`).join(", ")} allowed by your Buffer plan.</p>}
      {!res && <Skeletons />}
      {res && res.status !== "ok" && <Problem res={res} />}
      <StaleBanner res={res} />
      {res?.status === "ok" && res.channels.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">No channels connected in Buffer yet. Connect one in Buffer, then press Refresh channels.</p>
      )}
      {res?.status === "ok" && res.channels.length > 0 && (
        <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card">
          {res.channels.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              {c.avatar
                ? <img src={c.avatar} alt="" className="h-9 w-9 rounded-full object-cover" loading="lazy" />
                : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm text-foreground">{c.name.slice(0, 1).toUpperCase()}</span>}
              <span className="min-w-0 flex-1 truncate text-foreground">{c.name}</span>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{c.service}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function PostList({ status, version }: { status: PostStatus; version: number }) {
  const fn = useServerFn(getBufferPosts);
  const { res, busy, refresh } = useLoad((force) => fn({ data: { status, force: version > 0 } }), [status, version]);
  const label = { draft: "drafts", scheduled: "scheduled posts", sent: "sent posts" }[status];
  return (
    <>
      <div className="mt-4 flex justify-end">
        <button onClick={refresh} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-4 text-sm text-foreground hover:bg-muted disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>
      {!res && <Skeletons />}
      {res && res.status !== "ok" && <Problem res={res} />}
      <StaleBanner res={res} />
      {res?.status === "ok" && res.posts.length === 0 && <p className="mt-6 text-sm text-muted-foreground">No {label} in Buffer yet.</p>}
      {res?.status === "ok" && res.posts.length > 0 && (
        <ul className="mt-4 space-y-3">
          {res.posts.map((p) => {
            const date = status === "sent" ? p.sentAt ?? p.dueAt : status === "scheduled" ? p.dueAt : p.createdAt;
            const prefix = status === "sent" ? "Sent" : status === "scheduled" ? "Scheduled for" : "Created";
            return (
              <li key={p.id} className="rounded-2xl border border-border bg-card p-4">
                <p className="whitespace-pre-wrap break-words text-sm text-foreground line-clamp-6">{p.text || <span className="text-muted-foreground">(no text)</span>}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {p.channelName} · {p.service}{date ? ` · ${prefix} ${new Date(date).toLocaleString()}` : ""}
                </p>
                {status === "draft" && <DraftActions id={p.id} text={p.text} onChanged={refresh} />}
              </li>
            );
          })}
        </ul>
      )}
      {res?.status === "ok" && res.hasMore && <p className="mt-3 text-xs text-muted-foreground">Showing the 50 most recent.</p>}
    </>
  );
}

function PhotoStudioView() {
  const tools = [
    { icon: Hash, title: "Photo to Post", text: "Writes a caption and 3–5 hashtags from your photo. Up to 10 a day." },
    { icon: Wand2, title: "Magic Photo", text: "Clean, Warm, Bright or Calm edits with a before/after view and Undo. Up to 5 a day." },
  ];
  return (
    <>
      <PageHeader title="Photo Studio" />
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Add one photo below to unlock both tools. Nothing is published until you decide.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {tools.map((t) => (
          <div key={t.title} className="flex gap-3 rounded-xl border border-border bg-card p-4">
            <t.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div><p className="text-sm font-medium text-foreground">{t.title}</p><p className="mt-1 text-xs text-muted-foreground">{t.text}</p></div>
          </div>
        ))}
      </div>
      <div className="mt-6"><NewPost prefill={null} onDone={() => {}} /></div>
    </>
  );
}

function PostsView({ prefill }: { prefill: Prefill | null }) {
  const [version, setVersion] = useState(0);
  return (
    <>
      <PageHeader title="Posts" />
      <div className="mt-6"><NewPost prefill={prefill} onDone={() => setVersion((v) => v + 1)} /></div>
      <Tabs defaultValue="draft" className="mt-8">
        <TabsList>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
        </TabsList>
        <TabsContent value="draft"><PostList status="draft" version={version} /></TabsContent>
        <TabsContent value="scheduled"><PostList status="scheduled" version={version} /></TabsContent>
        <TabsContent value="sent"><PostList status="sent" version={version} /></TabsContent>
      </Tabs>
    </>
  );
}

function DraftsView({ onNewPost }: { onNewPost: () => void }) {
  return (
    <>
      <PageHeader title="Drafts" />
      <p className="mt-3 text-sm text-muted-foreground">Drafts saved in Buffer. Edit or delete them here — nothing is published until you decide.</p>
      <div className="mt-5">
        <button onClick={onNewPost} className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground">Write a new post</button>
      </div>
      <div className="mt-6"><PostList status="draft" version={0} /></div>
    </>
  );
}

function DiscoverView() {
  const fn = useServerFn(getBufferChannels);
  const { res } = useLoad((force) => fn({ data: { force } }));
  const [channelId, setChannelId] = useState("");
  useEffect(() => {
    if (res?.status === "ok" && !channelId && res.channels[0]) setChannelId(res.channels[0].id);
  }, [res, channelId]);
  const selected = res?.status === "ok" ? res.channels.find((c) => c.id === channelId) : undefined;
  return (
    <>
      <PageHeader title="Discover" />
      {!res && <Skeletons n={1} />}
      {res && res.status !== "ok" && <Problem res={res} />}
      <StaleBanner res={res} />
      {res?.status === "ok" && res.channels.length === 0 && <p className="mt-6 text-sm text-muted-foreground">Connect a channel in Buffer to write posts for it.</p>}
      {res?.status === "ok" && res.channels.length > 0 && <Composer channels={res.channels} channelId={channelId} setChannelId={setChannelId} />}
      <Trends channel={selected} />
    </>
  );
}

function AppPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const meta = (user.user_metadata ?? {}) as { buffer_email?: string | null; name?: string };
  const email = meta.buffer_email || "no email provided";
  const [view, setView] = useState<View>("overview");
  const [prefill, setPrefill] = useState<Prefill | null>(null);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <SidebarNav groups={NAV_GROUPS} activeId={view} onSelect={setView} settingsId="settings" email={email} onSignOut={signOut} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border px-4 md:px-10">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger title="Toggle navigation" className="md:hidden" />
              <img src={synoraLogo.url} alt="Synora" className="h-5 w-auto md:hidden" />
              <span className="hidden truncate text-xs text-muted-foreground md:block">Workspace / {NAV.find((n) => n.id === view)?.label ?? "Settings"}</span>
            </div>
            <span className="hidden text-xs text-muted-foreground md:block">Write, polish and save — calmly.</span>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-9 md:px-10 md:py-12">
            {view === "overview" && <OverviewView onOpenPosts={() => setView("posts")} userId={user.id} />}
            {view === "channels" && <ChannelsView />}
            {view === "posts" && <PostsView prefill={prefill} />}
            {view === "drafts" && <DraftsView onNewPost={() => setView("posts")} />}
            {view === "calendar" && <CalendarView Reconnect={() => <ReconnectButton />} onCreate={(when) => { setPrefill({ text: "", when, key: Date.now() }); setView("posts"); }} />}
            {view === "ideas" && <IdeasView onUse={(text, ideaId) => { setPrefill({ text, ideaId, key: Date.now() }); setView("posts"); }} />}
            {view === "discover" && <DiscoverView />}
            {view === "photo" && <PhotoStudioView />}
            {view === "settings" && <SettingsView email={email} onSignOut={signOut} />}
          </main>
          <footer className="mx-5 mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border py-6 text-xs text-muted-foreground md:mx-10">
            <span>Built on the Buffer API. Not an official Buffer product.</span>
            <div className="flex gap-5"><a href="/privacy" className="hover:text-foreground">Privacy Policy</a><a href="/terms" className="hover:text-foreground">Terms</a></div>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}
