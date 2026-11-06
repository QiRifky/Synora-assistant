import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getBufferChannels, getBufferPosts, getBufferSummary, type PostStatus } from "@/lib/buffer.functions";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Radio, FileText, Lightbulb, Compass, RefreshCw, LogOut } from "lucide-react";
import { importArticle, saveBufferDraft } from "@/lib/compose.functions";

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

type View = "overview" | "channels" | "posts" | "ideas" | "discover";
const NAV: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "channels", label: "Channels", icon: Radio },
  { id: "posts", label: "Posts", icon: FileText },
  { id: "ideas", label: "Ideas", icon: Lightbulb },
  { id: "discover", label: "Discover", icon: Compass },
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

function Problem({ status }: { status: "reconnect" | "error" }) {
  if (status === "reconnect") {
    return (
      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">Your Buffer connection has expired or was revoked.</p>
        <ReconnectButton />
      </div>
    );
  }
  return <p role="alert" className="mt-6 text-sm text-destructive">Couldn't reach Buffer right now. Please try Refresh in a moment.</p>;
}

function Skeletons({ n = 3 }: { n?: number }) {
  return (
    <div className="mt-6 space-y-3">
      {Array.from({ length: n }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}
    </div>
  );
}

function useLoad<T>(load: (force: boolean) => Promise<T>, deps: unknown[] = []) {
  const [res, setRes] = useState<T | { status: "error" } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = (force: boolean) => {
    setBusy(true);
    if (!force) setRes(null);
    load(force).then(setRes).catch(() => setRes({ status: "error" })).finally(() => setBusy(false));
  };
  useEffect(() => { run(false); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return { res, busy, refresh: () => run(true) };
}

function OverviewView() {
  const fn = useServerFn(getBufferSummary);
  const { res, busy, refresh } = useLoad((force) => fn({ data: { force } }));
  const fmt = (c: { count: number; hasMore: boolean }) => `${c.count}${c.hasMore ? "+" : ""}`;
  return (
    <>
      <PageHeader title="Overview" onRefresh={refresh} busy={busy} />
      {!res && <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}</div>}
      {res && res.status !== "ok" && <Problem status={res.status} />}
      {res?.status === "ok" && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Channels", String(res.channels)],
            ["Drafts", fmt(res.counts.draft)],
            ["Scheduled posts", fmt(res.counts.scheduled)],
            ["Sent posts", fmt(res.counts.sent)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
              <p className="mt-2 font-display text-4xl text-foreground">{value}</p>
            </div>
          ))}
        </div>
      )}
      {res?.status === "ok" && <p className="mt-4 text-xs text-muted-foreground">Post counts include up to 50 most recent per status. "+" means there are more.</p>}
    </>
  );
}

function ChannelsView() {
  const fn = useServerFn(getBufferChannels);
  const { res, busy, refresh } = useLoad((force) => fn({ data: { force } }));
  return (
    <>
      <PageHeader title="Channels" onRefresh={refresh} busy={busy} />
      {!res && <Skeletons />}
      {res && res.status !== "ok" && <Problem status={res.status} />}
      {res?.status === "ok" && res.channels.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">No channels connected in Buffer yet. Connect one in Buffer, then press Refresh.</p>
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

function PostList({ status }: { status: PostStatus }) {
  const fn = useServerFn(getBufferPosts);
  const { res, busy, refresh } = useLoad((force) => fn({ data: { status, force } }), [status]);
  const label = { draft: "drafts", scheduled: "scheduled posts", sent: "sent posts" }[status];
  return (
    <>
      <div className="mt-4 flex justify-end">
        <button onClick={refresh} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-4 text-sm text-foreground hover:bg-muted disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>
      {!res && <Skeletons />}
      {res && res.status !== "ok" && <Problem status={res.status} />}
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
              </li>
            );
          })}
        </ul>
      )}
      {res?.status === "ok" && res.hasMore && <p className="mt-3 text-xs text-muted-foreground">Showing the 50 most recent.</p>}
    </>
  );
}

function PostsView() {
  return (
    <>
      <PageHeader title="Posts" />
      <Tabs defaultValue="draft" className="mt-6">
        <TabsList>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
        </TabsList>
        <TabsContent value="draft"><PostList status="draft" /></TabsContent>
        <TabsContent value="scheduled"><PostList status="scheduled" /></TabsContent>
        <TabsContent value="sent"><PostList status="sent" /></TabsContent>
      </Tabs>
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
      {res && res.status !== "ok" && <Problem status={res.status} />}
      {res?.status === "ok" && res.channels.length === 0 && <p className="mt-6 text-sm text-muted-foreground">Connect a channel in Buffer to write posts for it.</p>}
      {res?.status === "ok" && res.channels.length > 0 && <Composer channels={res.channels} channelId={channelId} setChannelId={setChannelId} />}
      <Trends channel={selected} />
    </>
  );
}

function AppSidebar({ view, setView, email, onSignOut }: { view: View; setView: (v: View) => void; email: string; onSignOut: () => void }) {
  const { setOpenMobile } = useSidebar();
  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-5">
        <span className="font-display text-2xl text-sidebar-foreground">Synora</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((n) => (
                <SidebarMenuItem key={n.id}>
                  <SidebarMenuButton isActive={view === n.id} onClick={() => { setView(n.id); setOpenMobile(false); }}>
                    <n.icon className="h-4 w-4" /> <span>{n.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <p className="truncate text-xs text-muted-foreground" title={email}>{email}</p>
        <button onClick={onSignOut} className="mt-2 inline-flex h-9 items-center gap-2 rounded-full border border-border px-4 text-sm text-foreground hover:bg-muted">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}

function AppPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const meta = (user.user_metadata ?? {}) as { buffer_email?: string | null; name?: string };
  const email = meta.buffer_email || "no email provided";
  const [view, setView] = useState<View>("overview");

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar view={view} setView={setView} email={email} onSignOut={signOut} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 items-center gap-2 border-b border-border px-3 md:hidden">
            <SidebarTrigger />
            <span className="font-display text-lg text-foreground">Synora</span>
          </header>
          <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-8">
            {view === "overview" && <OverviewView />}
            {view === "channels" && <ChannelsView />}
            {view === "posts" && <PostsView />}
            {view === "ideas" && (
              <>
                <PageHeader title="Ideas" />
                <div className="mt-6 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">Coming next</div>
              </>
            )}
            {view === "discover" && <DiscoverView />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
