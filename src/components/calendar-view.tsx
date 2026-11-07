import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, ChevronLeft, ChevronRight, Columns3, Grid2X2, Plus, RefreshCw } from "lucide-react";
import { getBufferChannels, getBufferPosts, type BufferChannel, type BufferPost, type PostsResult } from "@/lib/buffer.functions";
import { loadPreferences } from "@/lib/preferences-client";
import { addDays, browserTimeZone, dayKeyInZone, defaultSlot, isValidTimeZone } from "@/lib/timezone";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type CalPost = BufferPost & { status: "scheduled" | "sent"; at: string };
type Busy = { retryAfterMin: number | null };
type Res = { scheduled: PostsResult; sent: PostsResult } | { error: true };
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MANUAL_GAP = 30_000;

function keyLabel(key: string, opts: Intl.DateTimeFormatOptions) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 12)).toLocaleDateString(undefined, { ...opts, timeZone: "UTC" });
}
const weekday = (key: string) => new Date(`${key}T12:00:00Z`).getUTCDay();

function Chip({ p, onOpen }: { p: CalPost; onOpen: (p: CalPost) => void }) {
  const tone = p.status === "scheduled" ? "border-primary/30 bg-primary/15 text-foreground" : "border-border bg-muted text-muted-foreground";
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(p); }}
      className={`block w-full truncate rounded-md border px-1.5 py-0.5 text-left text-[11px] leading-4 ${tone}`}
      title={`${p.channelName}: ${p.text}`}>
      <span className="font-medium">{p.channelName}</span> · {p.text || "(no text)"}
    </button>
  );
}

function PostCard({ p, tz, onOpen }: { p: CalPost; tz: string; onOpen: (p: CalPost) => void }) {
  return (
    <button type="button" onClick={() => onOpen(p)} className="block w-full min-w-0 rounded-md border border-border bg-card p-3 text-left hover:bg-muted/50">
      <p className="line-clamp-2 break-words text-sm font-medium text-foreground">{p.text || "(no text)"}</p>
      <p className="my-2 break-words text-xs text-muted-foreground">{p.channelName} · {new Date(p.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: tz })}</p>
      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] ${p.status === "scheduled" ? "bg-primary/15 text-foreground" : "bg-muted text-muted-foreground"}`}>{p.status === "scheduled" ? "Scheduled" : "Sent"}</span>
    </button>
  );
}

export function CalendarView({ onCreate, Reconnect }: { onCreate: (when: string) => void; Reconnect: () => React.ReactNode }) {
  const postsFn = useServerFn(getBufferPosts);
  const channelsFn = useServerFn(getBufferChannels);
  const [tz, setTz] = useState("UTC");
  const [now, setNow] = useState<Date | null>(null);
  const [mode, setMode] = useState<"month" | "week" | "list">("month");
  const [status, setStatus] = useState<"all" | "scheduled" | "sent">("all");
  const [agenda, setAgenda] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [channel, setChannel] = useState("all");
  const [channels, setChannels] = useState<BufferChannel[]>([]);
  const [res, setRes] = useState<Res | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const lastForced = useRef(0);
  const [open, setOpen] = useState<CalPost | null>(null);
  const [dayList, setDayList] = useState<string | null>(null);

  useEffect(() => {
    const browser = browserTimeZone();
    setTz(browser); setNow(new Date()); setAnchor(dayKeyInZone(new Date(), browser));
    loadPreferences().then((p) => {
      if (p?.timeZone && isValidTimeZone(p.timeZone)) { setTz(p.timeZone); setAnchor(dayKeyInZone(new Date(), p.timeZone)); }
    });
  }, []);

  const run = useCallback((force: boolean) => {
    if (busyRef.current || document.hidden) return;
    if (force) { if (Date.now() - lastForced.current < MANUAL_GAP) return; lastForced.current = Date.now(); }
    busyRef.current = true; setBusy(true);
    // Both statuses come from one shared, cached server request.
    Promise.all([postsFn({ data: { status: "scheduled", force } }), postsFn({ data: { status: "sent", force: false } }), channelsFn({ data: {} })])
      .then(([scheduled, sent, ch]) => { setRes({ scheduled, sent }); if (ch.status === "ok") setChannels(ch.channels); })
      .catch(() => setRes({ error: true }))
      .finally(() => { busyRef.current = false; setBusy(false); setNow(new Date()); });
  }, [postsFn, channelsFn]);

  useEffect(() => {
    if (!document.hidden) { run(false); return; }
    const onVisible = () => { if (!document.hidden) { document.removeEventListener("visibilitychange", onVisible); run(false); } };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [run]);

  const ok = res && !("error" in res) && res.scheduled.status === "ok" && res.sent.status === "ok" ? res as { scheduled: Extract<PostsResult, { status: "ok" }>; sent: Extract<PostsResult, { status: "ok" }> } : null;
  const reconnect = res && !("error" in res) && (res.scheduled.status === "reconnect" || res.sent.status === "reconnect");
  const stale: Busy | undefined = ok ? ok.scheduled.stale ?? ok.sent.stale : undefined;
  const failedBusy = res && !("error" in res) && res.scheduled.status === "error" ? res.scheduled.busy : undefined;

  const byDay = useMemo(() => {
    const map = new Map<string, CalPost[]>();
    if (!ok) return map;
    const all: CalPost[] = [
      ...ok.scheduled.posts.filter((p) => p.dueAt).map((p) => ({ ...p, status: "scheduled" as const, at: p.dueAt! })),
      ...ok.sent.posts.filter((p) => p.sentAt ?? p.dueAt).map((p) => ({ ...p, status: "sent" as const, at: (p.sentAt ?? p.dueAt)! })),
    ].filter((p) => (channel === "all" || p.channelId === channel) && (status === "all" || p.status === status));
    all.sort((a, b) => a.at.localeCompare(b.at));
    for (const p of all) {
      const k = dayKeyInZone(new Date(p.at), tz);
      map.set(k, [...(map.get(k) ?? []), p]);
    }
    return map;
  }, [ok, channel, status, tz]);

  if (!anchor || !now) return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;
  const today = dayKeyInZone(now, tz);
  const monthStart = `${anchor.slice(0, 7)}-01`;
  const start = mode !== "week" ? addDays(monthStart, -weekday(monthStart)) : addDays(anchor, -weekday(anchor));
  const days: string[] = [];
  if (mode === "week") for (let i = 0; i < 7; i++) days.push(addDays(start, i));
  else for (let k = start; days.length < 42 && (days.length % 7 !== 0 || k.slice(0, 7) <= anchor.slice(0, 7)); k = addDays(k, 1)) days.push(k);
  const inRange = (k: string) => (mode !== "week" ? k.slice(0, 7) === anchor.slice(0, 7) : days.includes(k));
  const rangeHasPosts = days.some((k) => inRange(k) && byDay.has(k));

  function step(dir: 1 | -1) {
    if (mode === "week") return setAnchor(addDays(anchor!, dir * 7));
    const [y, m] = anchor!.split("-").map(Number);
    setAnchor(new Date(Date.UTC(y!, m! - 1 + dir, 1)).toISOString().slice(0, 10));
  }
  const create = (k: string) => { if (k >= today) onCreate(defaultSlot(k, today, new Date(), tz)); };
  const title = mode !== "week" ? keyLabel(monthStart, { month: "long", year: "numeric" })
    : `${keyLabel(days[0]!, { month: "short", day: "numeric" })} – ${keyLabel(days[6]!, { month: "short", day: "numeric", year: "numeric" })}`;
  const btn = "inline-flex h-9 items-center gap-1 rounded-full border border-border px-3 text-sm text-foreground hover:bg-muted disabled:opacity-50";
  const fmtTime = (p: CalPost) => new Date(p.at).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short", timeZone: tz });

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-foreground">Calendar</h1>
          <p className="mt-2 text-xs text-muted-foreground">{tz} · <span className="inline-block h-2 w-2 rounded-full bg-primary/60" /> Scheduled · <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/50" /> Sent</p>
        </div>
        <button onClick={() => run(true)} disabled={busy} className={btn}><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> {busy ? "Refreshing…" : "Refresh"}</button>
      </div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button className={btn} onClick={() => { step(-1); setPicked(null); }} aria-label="Previous period"><ChevronLeft className="h-4 w-4" /></button>
          <h2 className="min-w-44 text-center text-lg font-medium text-foreground">{title}</h2>
          <button className={btn} onClick={() => { step(1); setPicked(null); }} aria-label="Next period"><ChevronRight className="h-4 w-4" /></button>
          <button className={btn} onClick={() => { setAnchor(today); setPicked(null); }}>Today</button>
        </div>
        <div className="flex gap-1">
          {(["month", "week", "list"] as const).map((m) => (
            <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)} className={`h-9 rounded-md px-3 text-sm capitalize ${mode === m ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted"}`}>{m}</button>
          ))}
        </div>
      </div>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <select value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="Filter by channel" className="h-10 rounded-md border border-border bg-card px-3 text-sm text-foreground">
          <option value="all">All channels</option>
          {channels.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.service})</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Filter by status" className="h-10 rounded-md border border-border bg-card px-3 text-sm text-foreground">
          <option value="all">All statuses</option><option value="scheduled">Scheduled</option><option value="sent">Sent</option>
        </select>
      </div>

      {stale && <p role="status" className="mt-4 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground">Buffer is busy, showing saved data.</p>}
      {reconnect && <div className="mt-6 rounded-2xl border border-border bg-card p-6"><p className="text-sm text-muted-foreground">Please sign in with Buffer again.</p>{Reconnect()}</div>}
      {res && !ok && !reconnect && <p role="alert" className="mt-6 text-sm text-destructive">{failedBusy ? "Buffer is receiving too many requests right now. Please wait a few minutes and try again." : "Couldn't reach Buffer right now. Please try Refresh in a moment."}</p>}
      {!res && <div className="mt-6 h-64 animate-pulse rounded-2xl bg-muted" />}

      {ok && (
        <>
          {mode === "week" && !rangeHasPosts && <p className="mt-4 text-sm text-muted-foreground">Nothing scheduled this {mode}.</p>}
          {mode === "month" && (() => {
            const sel = picked && days.includes(picked) ? picked : null;
            const visible = sel ? [sel] : days.filter((k) => inRange(k) && byDay.has(k));
            const label = (k: string) => keyLabel(k, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
            return (
              <div className={`mt-4 grid min-w-0 gap-8 ${agenda ? "lg:grid-cols-2" : ""}`}>
                <div className="min-w-0">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">{tz}</span>
                    <div className="flex gap-1 rounded-md border border-border p-1" role="group" aria-label="Calendar layout">
                      <button aria-label="Calendar only" title="Calendar only" aria-pressed={!agenda} onClick={() => setAgenda(false)} className={`rounded p-1.5 ${!agenda ? "bg-muted text-foreground" : "text-muted-foreground"}`}><Grid2X2 className="h-4 w-4" /></button>
                      <button aria-label="Calendar and posts" title="Calendar and posts" aria-pressed={agenda} onClick={() => setAgenda(true)} className={`rounded p-1.5 ${agenda ? "bg-muted text-foreground" : "text-muted-foreground"}`}><Columns3 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                    {WEEKDAYS.map((d) => <div key={d} className="rounded-md bg-muted py-2 text-center text-xs text-muted-foreground">{d}</div>)}
                    {days.map((k) => {
                      const count = byDay.get(k)?.length ?? 0;
                      return (
                        <button key={k} type="button" aria-label={`${label(k)}, ${count} posts`} aria-pressed={sel === k} onClick={() => { setPicked(k); setAgenda(true); }}
                          className={`group relative h-16 min-w-0 rounded-lg border text-sm ${sel === k ? "border-primary bg-muted text-foreground" : inRange(k) ? "border-transparent bg-card text-foreground hover:bg-muted/60" : "border-transparent bg-muted/40 text-muted-foreground"} ${k === today ? "font-semibold text-primary" : ""}`}>
                          {+k.slice(8)}
                          {count > 0 && <span className="absolute bottom-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-foreground transition-transform group-hover:scale-110 motion-reduce:transition-none">{count}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {agenda && (
                  <div className="min-w-0">
                    <div className="mb-4 flex min-h-11 flex-wrap items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold text-foreground">{sel ? label(sel) : "Planned posts"}</h3>
                      <div className="flex gap-2">
                        {sel && sel >= today && <button className={btn} onClick={() => create(sel)}><Plus className="h-4 w-4" /> New post</button>}
                        {sel && <button className={btn} onClick={() => setPicked(null)}>All days</button>}
                      </div>
                    </div>
                    <div className="max-h-[34rem] space-y-5 overflow-y-auto overscroll-contain pr-1">
                      {visible.some((k) => byDay.has(k)) ? visible.map((k) => byDay.has(k) && (
                        <div key={k}>
                          {!sel && <h4 className="mb-2 text-xs font-medium text-muted-foreground">{label(k)} · {tz}</h4>}
                          <div className="space-y-3">{byDay.get(k)!.map((p) => <PostCard key={p.id} p={p} tz={tz} onOpen={setOpen} />)}</div>
                        </div>
                      )) : (
                        <div className="flex min-h-60 flex-col items-center justify-center gap-3 text-sm text-muted-foreground"><CalendarDays className="size-8" aria-hidden="true" />No posts{sel ? " for this day" : " this month"}.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          {mode === "list" && (
            <div className="mt-4 space-y-3">
              {days.some((k) => inRange(k) && byDay.has(k))
                ? days.filter((k) => inRange(k)).flatMap((k) => byDay.get(k) ?? []).map((p) => <PostCard key={p.id} p={p} tz={tz} onOpen={setOpen} />)
                : <div className="flex min-h-60 flex-col items-center justify-center gap-3 text-sm text-muted-foreground"><CalendarDays className="size-8" aria-hidden="true" />No posts this month.</div>}
            </div>
          )}
          {/* Week grid */}
          {mode === "week" && <><div className="mt-4 hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
            <div className="grid grid-cols-7 border-b border-border">
              {WEEKDAYS.map((d) => <div key={d} className="px-2 py-2 text-xs uppercase tracking-widest text-muted-foreground">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {days.map((k) => {
                const list = byDay.get(k) ?? [];
                const past = k < today;
                return (
                  <div key={k} onClick={() => !past && list.length === 0 && create(k)}
                    className={`group border-b border-r border-border p-1.5 ${mode === "week" ? "min-h-56" : "min-h-28"} ${inRange(k) ? "" : "bg-muted/40"} ${!past && list.length === 0 ? "cursor-pointer hover:bg-muted/60" : ""}`}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className={`text-xs ${k === today ? "rounded-full bg-primary px-1.5 text-primary-foreground" : past ? "text-muted-foreground" : "text-foreground"}`}>{+k.slice(8)}</span>
                      {!past && <button type="button" aria-label={`New post on ${k}`} onClick={(e) => { e.stopPropagation(); create(k); }} className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100 focus:opacity-100"><Plus className="h-3.5 w-3.5" /></button>}
                    </div>
                    <div className="space-y-1">
                      {list.slice(0, 3).map((p) => <Chip key={p.id} p={p} onOpen={setOpen} />)}
                      {list.length > 3 && <button type="button" onClick={(e) => { e.stopPropagation(); setDayList(k); }} className="text-[11px] text-primary hover:underline">+{list.length - 3} more</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Mobile list */}
          <ul className="mt-4 space-y-3 md:hidden">
            {days.filter((k) => inRange(k) && (byDay.has(k) || k === today)).map((k) => (
              <li key={k} className="rounded-2xl border border-border bg-card p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{keyLabel(k, { weekday: "short", month: "short", day: "numeric" })}{k === today ? " · Today" : ""}</p>
                  {k >= today && <button type="button" onClick={() => create(k)} className="inline-flex items-center gap-1 text-xs text-primary"><Plus className="h-3.5 w-3.5" /> New post</button>}
                </div>
                <div className="mt-2 space-y-1">{(byDay.get(k) ?? []).map((p) => <Chip key={p.id} p={p} onOpen={setOpen} />)}</div>
              </li>
            ))}
          </ul></>}
          {(ok.scheduled.hasMore || ok.sent.hasMore) && <p className="mt-3 text-xs text-muted-foreground">Showing the 50 most recent scheduled and sent posts.</p>}
        </>
      )}

      <Dialog open={!!dayList} onOpenChange={(o) => !o && setDayList(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dayList ? keyLabel(dayList, { dateStyle: "full" }) : ""}</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] space-y-1 overflow-y-auto">{(dayList ? byDay.get(dayList) ?? [] : []).map((p) => <Chip key={p.id} p={p} onOpen={(x) => { setDayList(null); setOpen(x); }} />)}</div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{open?.status === "scheduled" ? "Scheduled post" : "Sent post"}</DialogTitle></DialogHeader>
          {open && (
            <div className="space-y-3 text-sm">
              <p className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-muted p-3 text-foreground">{open.text || "(no text)"}</p>
              {!!open.thumbs?.length && <div className="flex flex-wrap gap-2">{open.thumbs.map((t) => <img key={t} src={t} alt="" className="h-16 w-16 rounded-lg object-cover" />)}</div>}
              <p><span className="text-muted-foreground">Channel: </span>{open.channelName} ({open.service})</p>
              <p><span className="text-muted-foreground">Status: </span>{open.status === "scheduled" ? "Scheduled" : "Sent"}</p>
              <p><span className="text-muted-foreground">{open.status === "scheduled" ? "Scheduled for" : "Sent"}: </span>{fmtTime(open)} ({tz})</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
