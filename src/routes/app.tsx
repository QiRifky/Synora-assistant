import { DiscoverNavIcon } from "@/components/ui/discover-nav-icon";
import { DraftsNavIcon } from "@/components/ui/drafts-nav-icon";
import { CalendarNavIcon } from "@/components/ui/calendar-nav-icon";
import { SetupNavIcon } from "@/components/ui/setup-nav-icon";
import { PlanShipNavIcon } from "@/components/ui/plan-ship-nav-icon";
import { IdeasNavIcon } from "@/components/ui/ideas-nav-icon";
import { PhotoNavIcon } from "@/components/ui/photo-nav-icon";
import { PostsNavIcon } from "@/components/ui/posts-nav-icon";
import { CreateNavIcon } from "@/components/ui/package-plus-icon";
import { OverviewNavIcon } from "@/components/ui/layout-dashboard-icon";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getBufferChannelLimit, getBufferChannels, getBufferPosts, getBufferSummary, type BufferChannel, type BufferPost, type PostStatus } from "@/lib/buffer.functions";
import { DashboardOverview } from "@/components/dashboard-overview";
import type { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { SidebarNav, type NavGroupData } from "@/components/ui/dashboard-sidebar";
import { Sparkles, CalendarClock, SlidersHorizontal, Image as ImageIcon, Wand2, Hash } from "lucide-react";
import { NewPost, DraftActions, IdeasView, type Prefill } from "@/components/dashboard-posts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Radio, FileText, FileEdit, Lightbulb, Compass, CalendarDays, RefreshCw, ExternalLink } from "lucide-react";
import { CalendarView } from "@/components/calendar-view";
import { SettingsView } from "@/components/settings-view";
import { TemplateLibrary } from "@/components/template-library";
import { FolderShelf } from "@/components/folder-shelf";

function ReconnectButton() {
  return (
    <a href="/api/public/buffer/start" className="mt-3 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground">
      Reconnect Buffer
    </a>
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
  { id: "overview", label: "Overview", icon: OverviewNavIcon as unknown as typeof LayoutDashboard },
  { id: "channels", label: "Channels", icon: Radio },
  { id: "posts", label: "Posts", icon: PostsNavIcon as unknown as typeof FileText },
  { id: "drafts", label: "Drafts", icon: DraftsNavIcon as unknown as typeof FileEdit },
  { id: "calendar", label: "Calendar", icon: CalendarNavIcon as unknown as typeof CalendarDays },
  { id: "ideas", label: "Ideas", icon: IdeasNavIcon as unknown as typeof Lightbulb },
  { id: "discover", label: "Discover", icon: DiscoverNavIcon as unknown as typeof Compass },
  { id: "photo", label: "Photo Studio", icon: PhotoNavIcon as unknown as typeof ImageIcon },
];

const navItem = (id: View) => { const n = NAV.find((x) => x.id === id)!; return { id: n.id, title: n.label, icon: n.icon }; };
export const NAV_GROUPS: NavGroupData<View>[] = [
  { items: [navItem("overview")] },
  { heading: "Create", icon: CreateNavIcon as unknown as typeof Sparkles, items: [navItem("posts"), navItem("photo"), navItem("ideas")] },
  { heading: "Plan & Ship", icon: PlanShipNavIcon as unknown as typeof CalendarClock, items: [navItem("discover"), navItem("drafts"), navItem("calendar")] },
  { heading: "Set up", icon: SetupNavIcon as unknown as typeof SlidersHorizontal, items: [navItem("channels")] },
];

function PageHeader({ title, onRefresh, busy }: { title: string; onRefresh?: () => void; busy?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="sr-only">{title}</span>
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
        <span />
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

function PostList({ status, version, savedOnly = false, folders = false }: { status: PostStatus; version: number; savedOnly?: boolean; folders?: boolean }) {
  const [folder, setFolder] = useState<string | null>(null);
  const fn = useServerFn(getBufferPosts);
  const { res, busy, refresh } = useLoad((force) => fn({ data: { status, force: version > 0, savedOnly: savedOnly && !force && version === 0 } }), [status, version]);
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
        <>
        {folders && (() => {
          const map = new Map<string, string[]>();
          for (const p of res.posts) { const k = p.channelName || p.service; map.set(k, [...(map.get(k) ?? []), p.text || "(no text)"]); }
          return <FolderShelf groups={[...map].map(([k, items]) => ({ key: k, label: k, items }))} selected={folder} onSelect={setFolder} allLabel="All drafts" />;
        })()}
        <ul className="mt-4 space-y-3">
          {res.posts.filter((p) => !folders || !folder || (p.channelName || p.service) === folder).map((p) => {
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
        </>
      )}
      {res?.status === "ok" && res.hasMore && <p className="mt-3 text-xs text-muted-foreground">Showing the 50 most recent.</p>}
    </>
  );
}

function PhotoStudioView({ savedOnly = false }: { savedOnly?: boolean }) {
  return (
    <>
      <PageHeader title="Photo Studio" />
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Upload a photo, then write a caption from it or improve it. Nothing is published until you decide.</p>
      <div className="mt-6"><NewPost studio savedOnly={savedOnly} prefill={null} onDone={() => {}} /></div>
    </>
  );
}

function PostsView({ prefill, savedOnly = false }: { prefill: Prefill | null; savedOnly?: boolean }) {
  const [version, setVersion] = useState(0);
  return (
    <>
      <PageHeader title="Posts" />
      <div className="mt-6"><NewPost savedOnly={savedOnly} prefill={prefill} onDone={() => setVersion((v) => v + 1)} /></div>
      <Tabs defaultValue="draft" className="mt-8">
        <TabsList>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
        </TabsList>
        <TabsContent value="draft"><PostList savedOnly={savedOnly} status="draft" version={version} /></TabsContent>
        <TabsContent value="scheduled"><PostList savedOnly={savedOnly} status="scheduled" version={version} /></TabsContent>
        <TabsContent value="sent"><PostList savedOnly={savedOnly} status="sent" version={version} /></TabsContent>
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
      <div className="mt-6"><PostList status="draft" version={0} folders /></div>
    </>
  );
}

function DiscoverView({ onUse }: { onUse: (text: string) => void }) {
  return (
    <>
      <PageHeader title="Discover" />
      <p className="mt-3 text-sm text-muted-foreground">Start from a template. Fill in the blanks, then continue in New post.</p>
      <TemplateLibrary onUse={onUse} />
    </>
  );
}

const BANNERS: Record<View, { title: string; caption: string }> = {
  overview: { title: "Dashboard", caption: "Your Buffer channels, posts and Synora activity at a glance." },
  channels: { title: "Channels", caption: "See the social accounts connected to your Buffer and add new ones." },
  posts: { title: "Posts", caption: "Write, polish and save posts for your channels. Nothing goes out until you decide." },
  drafts: { title: "Drafts", caption: "Pick up where you left off. Edit or tidy the drafts saved in Buffer." },
  calendar: { title: "Calendar", caption: "See what's scheduled and what's already been sent, day by day." },
  ideas: { title: "Ideas", caption: "Keep every spark in one place, then turn the best ones into posts." },
  discover: { title: "Discover", caption: "Start from a ready-made template. Fill in the blanks and make it yours." },
  photo: { title: "Photo Studio", caption: "Upload a photo, get a caption from it, or give it a gentle touch-up." },
  settings: { title: "Settings", caption: "Manage your account, Buffer connection, preferences and data." },
};

const BANNER_IMAGES = import.meta.glob("../assets/banners/*.jpg", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

function PageBanner({ view, action }: { view: View; action?: ReactNode }) {
  const b = BANNERS[view];
  const img = BANNER_IMAGES[`../assets/banners/${view}.jpg`];
  return (
    <section className="relative mb-8 overflow-hidden rounded-3xl border border-border bg-muted shadow-soft">
      {img && <img src={img} alt="" width={1536} height={512} className="absolute inset-0 h-full w-full object-cover object-right" />}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
      {action}
      <div className="relative px-6 py-10 md:px-10 md:py-14">
        <h1 className="font-display text-3xl text-foreground md:text-4xl">{b.title}</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground md:text-base">{b.caption}</p>
      </div>
    </section>
  );
}

function AppPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const meta = (user.user_metadata ?? {}) as { buffer_email?: string | null; name?: string };
  const email = meta.buffer_email || "no email provided";
  const [view, setView] = useState<View>("overview");
  const [savedOnly, setSavedOnly] = useState(false);
  const [prefill, setPrefill] = useState<Prefill | null>(null);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <SidebarNav groups={NAV_GROUPS} activeId={view} onSelect={(v) => { setSavedOnly(false); setView(v); }} settingsId="settings" email={email} onSignOut={signOut} />
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-9 pt-4 md:px-10 md:pb-12 md:pt-6">
            <SidebarTrigger title="Toggle navigation" className="-ml-2 mb-3 md:hidden" />
            {view !== "overview" && <PageBanner view={view} />}
            {view === "overview" && <DashboardOverview banner={(action) => <PageBanner view="overview" action={action} />} onOpen={(v) => { setSavedOnly(v !== "calendar"); setView(v); }} userId={user.id} />}
            {view === "channels" && <ChannelsView />}
            {view === "posts" && <PostsView prefill={prefill} savedOnly={savedOnly} />}
            {view === "drafts" && <DraftsView onNewPost={() => setView("posts")} />}
            {view === "calendar" && <CalendarView Reconnect={() => <ReconnectButton />} onCreate={(when) => { setPrefill({ text: "", when, key: Date.now() }); setView("posts"); }} />}
            {view === "ideas" && <IdeasView savedOnly={savedOnly} onUse={(text, ideaId) => { setPrefill({ text, ideaId, key: Date.now() }); setView("posts"); }} />}
            {view === "discover" && <DiscoverView onUse={(text) => { setPrefill({ text, key: Date.now() }); setView("posts"); }} />}
            {view === "photo" && <PhotoStudioView savedOnly={savedOnly} />}
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
