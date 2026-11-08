import { useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Compass, Image as ImageIcon, Lightbulb, PenSquare, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getDashboardData, getDashboardSnapshot, type DashboardData } from "@/lib/dashboard.functions";
import { refreshDashboardSnapshot } from "@/lib/buffer.functions";
import { nextScheduledPost, snapshotIsStale, type SavedDashboard } from "@/lib/dashboard-shared";
import type { View } from "@/routes/app";

function Card({ title, loading, children }: { title: string; loading: boolean; children: ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-5 shadow-soft"><h2 className="text-xs uppercase tracking-widest text-muted-foreground">{title}</h2>{loading ? <div aria-label={`Loading ${title}`} role="status" className="mt-4 h-16 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" /> : children}</div>;
}

export function DashboardOverview({ banner, onOpen, userId }: { banner: (refresh: ReactNode) => ReactNode; onOpen: (view: View) => void; userId: string }) {
  const read = useServerFn(getDashboardSnapshot);
  const activityRead = useServerFn(getDashboardData);
  const refresh = useServerFn(refreshDashboardSnapshot);
  const [saved, setSaved] = useState<SavedDashboard | null>(null);
  const [reading, setReading] = useState(true);
  const [activity, setActivity] = useState<DashboardData | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let active = true;
    read().then((r) => { if (!active) return; if (r.ok) setSaved(r); else setMessage("Couldn't read your saved data right now."); }).catch(() => { if (active) setMessage("Couldn't read your saved data right now."); }).finally(() => { if (active) setReading(false); });
    activityRead().then((r) => { if (active) setActivity(r); }).catch(() => { if (active) setActivity({ ok: false }); });
    return () => { active = false; };
  }, [userId]); // Database only; no retry, Buffer calls, polling or focus listeners.
  const remaining = Math.max(0, Math.ceil((Date.parse(saved?.cooldownUntil ?? "") - now) / 1000)) || 0;
  useEffect(() => { if (!remaining) return; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, [remaining]);
  async function run() {
    if (lock.current || remaining > 0 || reading) return;
    lock.current = true; setBusy(true); setMessage("");
    try {
      const r = await refresh();
      setSaved(r); setNow(Date.now());
      if (r.status === "busy") setMessage("Buffer is busy right now. Showing your last saved data.");
      else if (r.status === "reconnect") setMessage("Please sign in with Buffer again.");
      else if (r.status === "error") setMessage("Couldn't refresh right now. Your saved data is unchanged.");
      else if (r.status === "cooldown") setMessage("Refresh isn't available yet. Your saved data is unchanged.");
    } catch { setMessage("Couldn't refresh right now. Your saved data is unchanged."); }
    finally { lock.current = false; setBusy(false); }
  }
  const tip = busy ? "Refreshing from Buffer…" : remaining ? `Refresh from Buffer · Available in ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}` : "Refresh from Buffer";
  const icon = <TooltipProvider><Tooltip><TooltipTrigger asChild><span tabIndex={remaining || busy || reading ? 0 : undefined} className="inline-flex rounded-full" title={tip}><Button variant="outline" size="icon" aria-label="Refresh from Buffer" disabled={busy || remaining > 0 || reading} onClick={() => void run()} className="rounded-full"><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin motion-reduce:animate-none" : ""}`} /></Button></span></TooltipTrigger><TooltipContent>{tip}</TooltipContent></Tooltip></TooltipProvider>;
  const snapshot = saved?.snapshot;
  const next = nextScheduledPost(snapshot?.posts ?? [], now);
  const nextChannel = snapshot?.channels.find((c) => c.id === next?.channelId);
  const counts = snapshot ? [String(snapshot.channels.length), ...(["draft", "scheduled", "sent"] as const).map((s) => `${snapshot.counts[s].count}${snapshot.counts[s].hasMore ? "+" : ""}`)] : [];
  return <>
    {banner(null)}
    {saved?.updatedAt && <p className="text-xs text-muted-foreground">Last updated {new Date(saved.updatedAt).toLocaleString()}{snapshotIsStale(saved.updatedAt, now) && <span className="ml-3">Showing saved data</span>}</p>}
    {message && <p role="status" className="mt-3 text-sm text-muted-foreground">{message}</p>}
    {!reading && !snapshot && !message && <p className="mt-3 text-sm text-muted-foreground">No data yet. Tap the refresh icon to load your Buffer data.</p>}
    <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div className="flex justify-end sm:col-start-2 lg:col-start-4">{icon}</div></div>
    <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{["Connected channels", "Drafts", "Scheduled posts", "Sent posts"].map((title, i) => <Card key={title} title={title} loading={reading}><p className="mt-2 font-display text-4xl text-foreground">{counts[i] ?? "—"}</p></Card>)}</div>
    {snapshot && <p className="mt-2 text-xs text-muted-foreground">Counts reflect saved posts. “+” means there are more.</p>}
    <section aria-labelledby="quick-start" className="mt-6">
      <h2 id="quick-start" className="text-xs uppercase tracking-widest text-muted-foreground">Quick start</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">{([["posts","New post","Write and save a post",PenSquare],["photo","Photo Studio","Polish a photo",ImageIcon],["ideas","Ideas","Keep your ideas",Lightbulb],["discover","Discover","Browse templates",Compass]] as const).map(([view,label,desc,Icon], i) => <button key={view} type="button" onClick={() => onOpen(view)} className={`group flex min-h-28 flex-col justify-between rounded-2xl border p-4 text-left shadow-soft transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${i === 0 ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90" : "border-border bg-card hover:border-primary"}`}><Icon className={`h-6 w-6 ${i === 0 ? "" : "text-primary"}`} aria-hidden /><span><span className="block font-semibold">{label}</span><span className={`block text-xs ${i === 0 ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{desc}</span></span></button>)}</div>
    </section>
    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2"><Card title="Connected channels" loading={reading}>{!snapshot ? <p className="mt-3 text-sm text-muted-foreground">No saved channels yet.</p> : snapshot.channels.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No channels connected in Buffer yet.</p> : <ul className="mt-3 divide-y divide-border">{snapshot.channels.map((c) => <li key={c.id} className="flex items-center gap-3 py-2.5">{c.avatar ? <img src={c.avatar} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm">{c.name.slice(0,1).toUpperCase()}</span>}<span className="min-w-0 flex-1 truncate text-sm">{c.name}</span><span className="text-xs uppercase text-muted-foreground">{c.service}</span></li>)}</ul>}</Card></div>
      <Card title="Recent posts and drafts" loading={reading}>{!snapshot ? <p className="mt-3 text-sm text-muted-foreground">No saved posts yet.</p> : !snapshot.posts.length ? <p className="mt-3 text-sm text-muted-foreground">Nothing here yet. Start with one post.</p> : <ul className="mt-3 divide-y divide-border">{snapshot.posts.slice(0,10).map((p) => <li key={`${p.status}-${p.id}`} className="py-2.5"><Button variant="ghost" onClick={() => onOpen("posts")} className="h-auto w-full flex-col items-start whitespace-normal px-0 text-left"><span className="line-clamp-2 text-sm">{p.text || "(no text)"}</span><span className="mt-1 text-xs text-muted-foreground">{p.status} · {p.channelName}</span></Button></li>)}</ul>}</Card>
    </div>
    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      <Card title="Next up" loading={reading}>{next ? <div className="mt-3 space-y-2">{nextChannel?.avatar && <img src={nextChannel.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />}{!nextChannel?.avatar && <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm" aria-label={next.service}>{next.channelName.slice(0,1).toUpperCase()}</span>}<p className="text-sm">{next.channelName}</p><p className="text-xs text-muted-foreground">{new Date(next.dueAt ?? "").toLocaleString()}</p><p className="line-clamp-2 text-sm">{next.text || "(no text)"}</p><Button variant="link" className="h-auto px-0" onClick={() => onOpen("calendar")}>View in Calendar</Button></div> : <p className="mt-3 text-sm text-muted-foreground">{snapshot ? "Nothing scheduled. A quiet week." : "No saved schedule yet."}</p>}</Card>

      <div className="lg:col-span-2"><Card title="Recent activity" loading={!activity}>{activity && !activity.ok ? <p role="alert" className="mt-3 text-sm text-destructive">Couldn't load activity right now.</p> : activity?.ok && !activity.activity.length ? <p className="mt-3 text-sm text-muted-foreground">Nothing here yet. Start with one post.</p> : activity?.ok && <ul className="mt-3 divide-y divide-border">{activity.activity.map((a,i) => <li key={i} className="py-2.5"><p className="text-sm">{a.label}</p><p className="mt-0.5 text-xs text-muted-foreground">{new Date(a.at).toLocaleString()}</p></li>)}</ul>}</Card></div>
    </div>
  </>;
}