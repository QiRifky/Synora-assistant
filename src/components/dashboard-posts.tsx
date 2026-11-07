import { useEffect, useMemo, useRef, useState } from "react";
import { loadPreferences } from "@/lib/preferences-client";
import { browserTimeZone, formatInZone, isValidTimeZone, zonedToDate } from "@/lib/timezone";
import { useServerFn } from "@tanstack/react-start";
import {
  createBufferPosts, editBufferDraft, deleteBufferDraft, getBufferChannels, getBufferIdeas, createBufferIdea,
  type BufferChannel, type ChannelsResult, type IdeasResult, type WriteResult,
} from "@/lib/buffer.functions";
import { charLimit } from "@/lib/trends.functions";
import { magicCaption } from "@/lib/magic.functions";
import { Sparkles, Undo2 } from "lucide-react";
import { MediaAttachments, type AttachedMedia } from "@/components/media-attachments";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type Prefill = { text: string; ideaId?: string | undefined; when?: string | undefined; key: number };

const input = "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground";
const btn = "inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50";
const primary = "inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50";
const btnSmall = "inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-4 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50";

const MAGIC_STYLES = [
  ["auto", "Auto"],
  ["punchier", "Punchier"],
  ["friendly", "Friendly"],
  ["professional", "Professional"],
  ["funny", "Funny"],
  ["inspiring", "Inspiring"],
  ["storytelling", "Storytelling"],
  ["emojis", "Add emojis"],
] as const;
type MagicStyle = (typeof MAGIC_STYLES)[number][0];
const MAGIC_STYLE_KEY = "synora-magic-style";

function MagicBar({ text, setText, limit, limitNote }: { text: string; setText: (v: string) => void; limit: number; limitNote?: string | undefined }) {
  const run = useServerFn(magicCaption);
  const [style, setStyle] = useState<MagicStyle>("auto");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prev, setPrev] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(MAGIC_STYLE_KEY);
    if (saved && MAGIC_STYLES.some(([v]) => v === saved)) { setStyle(saved as MagicStyle); return; }
    // No browser choice yet: use the default style saved in Settings.
    let live = true;
    loadPreferences().then((p) => { if (live && p) setStyle(p.magicStyle); });
    return () => { live = false; };
  }, []);

  function pickStyle(v: MagicStyle) {
    setStyle(v);
    window.localStorage.setItem(MAGIC_STYLE_KEY, v);
  }

  async function go() {
    setBusy(true); setError(null);
    try {
      const r = await run({ data: { text: text.trim(), style, limit } });
      if (r.ok) { setPrev(text); setText(r.text); }
      else setError(r.error);
    } catch { setError("Couldn't rewrite the caption right now. Please try again."); }
    setBusy(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Style
          <select value={style} onChange={(e) => pickStyle(e.target.value as MagicStyle)} aria-label="Style"
            className="h-9 max-w-full rounded-full border border-border bg-background px-3 text-xs text-foreground">
            {MAGIC_STYLES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </label>
        <span className={`text-xs ${limit > 0 && text.length > limit ? "text-destructive" : "text-muted-foreground"}`}>
          {text.length}{limit > 0 ? `/${limit}` : " characters"}{limitNote ? ` (${limitNote})` : ""}
        </span>
        {prev !== null && (
          <button type="button" className={btnSmall} onClick={() => { setText(prev); setPrev(null); }}>
            <Undo2 className="h-3.5 w-3.5" aria-hidden /> Undo
          </button>
        )}
        <button type="button" className={btnSmall} disabled={busy || !text.trim()} onClick={go}>
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> {busy ? "Rewriting…" : "Magic Caption"}
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Reconnect() {
  return <a href="/api/public/buffer/start" className={`${primary} mt-3`}>Reconnect Buffer</a>;
}

function Outcome({ res, names, success }: { res: WriteResult | null; names?: Map<string, string>; success?: string }) {
  if (!res) return null;
  if (res.status === "reconnect") return <div className="mt-3"><p className="text-sm text-muted-foreground">Your Buffer connection has expired.</p><Reconnect /></div>;
  if (res.status === "error") return <p role="alert" className="mt-3 text-sm text-destructive">{res.message ?? "Couldn't reach Buffer. Please try again."}</p>;
  return (
    <ul className="mt-3 space-y-1">
      {res.results.map((r, i) => (
        <li key={i} role={r.ok ? "status" : "alert"} className={`text-sm ${r.ok ? "text-foreground" : "text-destructive"}`}>
          {names?.get(r.channelId) ? `${names.get(r.channelId)}: ` : ""}{r.ok ? (success ?? r.message) : r.message}
        </li>
      ))}
    </ul>
  );
}

export function NewPost({ prefill, onDone }: { prefill: Prefill | null; onDone: () => void }) {
  const loadChannels = useServerFn(getBufferChannels);
  const create = useServerFn(createBufferPosts);
  const [channels, setChannels] = useState<ChannelsResult | null>(null);
  const [text, setText] = useState(prefill?.text ?? "");
  const [ideaId, setIdeaId] = useState(prefill?.ideaId);
  const [selected, setSelected] = useState<string[]>([]);
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [res, setRes] = useState<WriteResult | null>(null);
  const [lastAction, setLastAction] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const busyRef = useRef(false);
  const [media, setMedia] = useState<AttachedMedia[]>([]);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaViolation, setMediaViolation] = useState<string | null>(null);
  const [retainedPaths, setRetainedPaths] = useState<Set<string>>(new Set());

  const [tz, setTz] = useState(browserTimeZone);
  useEffect(() => {
    let live = true;
    Promise.all([loadChannels({ data: {} }), loadPreferences()]).then(([ch, prefs]) => {
      if (!live) return;
      setChannels(ch);
      if (prefs?.timeZone && isValidTimeZone(prefs.timeZone)) setTz(prefs.timeZone);
      if (prefs?.defaultChannelId && ch.status === "ok" && ch.channels.some((c) => c.id === prefs.defaultChannelId)) {
        setSelected((cur) => (cur.length ? cur : [prefs.defaultChannelId!]));
      }
    }).catch(() => { if (live) setChannels({ status: "error" }); });
    return () => { live = false; };
  }, [loadChannels]);
  useEffect(() => {
    if (!prefill) return;
    if (prefill.when) setWhen(prefill.when);
    if (prefill.text || !prefill.when) { setText(prefill.text); setIdeaId(prefill.ideaId); }
    setRes(null);
  }, [prefill]);

  const list: BufferChannel[] = channels?.status === "ok" ? channels.channels : [];
  const names = useMemo(() => new Map(list.map((c) => [c.id, c.name])), [list]);
  const chosen = list.filter((c) => selected.includes(c.id));
  const limit = chosen.length ? Math.min(...chosen.map((c) => charLimit(c.service))) : 0;
  const tightest = chosen.find((c) => charLimit(c.service) === limit);
  const over = limit > 0 && text.length > limit;
  const dueDate = when ? zonedToDate(when, tz) : null;
  const dueValid = !!dueDate && !Number.isNaN(dueDate.getTime()) && dueDate.getTime() > Date.now() + 60_000;
  const canSend = !!text.trim() && chosen.length > 0 && !over && !busy && !mediaBusy && !mediaViolation;

  const canPublish = (!!text.trim() || media.length > 0) && chosen.length > 0 && !over && !busy && !mediaBusy && !mediaViolation;

  async function send(action: "draft" | "queue" | "schedule" | "publish") {
    if (busyRef.current) return;
    if (action === "publish" ? !canPublish : (!canSend || (action === "schedule" && !dueValid))) return;
    busyRef.current = true;
    setBusy(action); setRes(null); setLastAction(action);
    try {
      const r = await create({ data: {
        channelIds: selected, text: text.trim(), action,
        ...(action === "schedule" && dueDate ? { dueAt: dueDate.toISOString() } : {}),
        ...(ideaId ? { ideaId } : {}),
        media: media.map(({ path, type }) => ({ path, type })),
      } });
      setRes(r);
      if (r.status === "ok" && r.results.some((x) => x.ok)) {
        setRetainedPaths((prev) => new Set([...prev, ...media.map((m) => m.path)]));
        if (r.results.every((x) => x.ok)) {
          for (const m of media) URL.revokeObjectURL(m.preview);
          setMedia([]); setText(""); setIdeaId(undefined); setWhen("");
        }
        onDone();
      }
    } catch { setRes({ status: "error" }); }
    busyRef.current = false;
    setBusy(null);
  }
  const successMsg = { publish: "Sent to Buffer for immediate publishing.", draft: "Saved as a draft in Buffer.", queue: "Added to your Buffer queue.", schedule: `Scheduled for ${dueDate ? formatInZone(dueDate, tz) : ""} (${tz}).` }[lastAction as "draft"];

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-sm uppercase tracking-widest text-muted-foreground">New post</h2>
      {channels === null && <div className="mt-3 h-24 animate-pulse rounded-xl bg-muted" />}
      {channels?.status === "reconnect" && <Reconnect />}
      {channels?.status === "error" && <p className="mt-3 text-sm text-destructive">Couldn't load your channels. Please refresh.</p>}
      {channels?.status === "ok" && list.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Connect a channel in Buffer first.</p>}
      {channels?.status === "ok" && list.length > 0 && (
        <div className="mt-3 space-y-3">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} className={input} placeholder="What do you want to share?" aria-label="Post text" />
          <MagicBar text={text} setText={setText} limit={limit} limitNote={tightest ? `limit for ${tightest.name}` : undefined} />
          <MediaAttachments value={media} onChange={setMedia} onBusy={setMediaBusy} disabled={!!busy || confirm || confirmPublish} retainedPaths={retainedPaths} channels={chosen.map((c) => ({ service: c.service, name: c.name }))} onViolation={setMediaViolation} />
          <fieldset>
            <legend className="text-xs uppercase tracking-widest text-muted-foreground">Channels</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {list.map((c) => {
                const on = selected.includes(c.id);
                return (
                  <label key={c.id} className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${on ? "border-primary bg-muted text-foreground" : "border-border text-muted-foreground"}`}>
                    <input type="checkbox" className="accent-primary" checked={on}
                      onChange={() => setSelected(on ? selected.filter((x) => x !== c.id) : [...selected, c.id])} />
                    {c.name} <span className="text-xs uppercase">{c.service}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-end gap-2">
            <button className={btn} disabled={!canSend} onClick={() => send("draft")}>{busy === "draft" ? "Saving…" : "Save as draft"}</button>
            <button className={btn} disabled={!canSend} onClick={() => send("queue")}>{busy === "queue" ? "Adding…" : "Add to queue"}</button>
            <label className="text-xs text-muted-foreground">
              Date and time ({tz})
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={`${input} mt-1 h-10 py-0`} aria-label="Schedule date and time" />
            </label>
            <button className={primary} disabled={!canSend || !dueValid} onClick={() => setConfirm(true)}>{busy === "schedule" ? "Scheduling…" : "Schedule"}</button>
            <button className={primary} disabled={!canPublish} onClick={() => setConfirmPublish(true)}>{busy === "publish" ? "Publishing…" : "Publish now"}</button>
          </div>
          {when && !dueValid && <p className="text-xs text-destructive">Pick a time at least a minute from now.</p>}
          {ideaId && <p className="text-xs text-muted-foreground">Started from a Buffer idea.</p>}
        </div>
      )}
      <Outcome res={res} names={names} success={successMsg} />
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Schedule this post?</AlertDialogTitle>
            <AlertDialogDescription>Buffer will publish it automatically at the time below.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 text-sm">
            <p className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border p-3 text-foreground">{text}</p>
            <p><span className="text-muted-foreground">Channels: </span>{chosen.map((c) => `${c.name} (${c.service})`).join(", ")}</p>
            <p><span className="text-muted-foreground">When: </span>{dueDate ? formatInZone(dueDate, tz) : ""} ({tz})</p>
            {media.length > 0 && <p><span className="text-muted-foreground">Media: </span>{media.map((m) => m.file.name).join(", ")}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => send("schedule")}>Yes, schedule</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmPublish} onOpenChange={setConfirmPublish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish now?</AlertDialogTitle>
            <AlertDialogDescription>This will be posted immediately and publicly.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 text-sm">
            {text.trim() && <p className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border p-3 text-foreground">{text}</p>}
            <p><span className="text-muted-foreground">Channels: </span>{chosen.map((c) => `${c.name} (${c.service})`).join(", ")}</p>
            {media.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {media.map((m) => m.type === "video"
                  ? <video key={m.path} src={m.preview} muted className="h-16 w-16 rounded-lg border border-border object-cover" />
                  : <img key={m.path} src={m.preview} alt={m.file.name} className="h-16 w-16 rounded-lg border border-border object-cover" />)}
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={!canPublish} onClick={() => send("publish")}>Publish now</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export function DraftActions({ id, text, onChanged }: { id: string; text: string; onChanged: () => void }) {
  const edit = useServerFn(editBufferDraft);
  const del = useServerFn(deleteBufferDraft);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(text);
  const [busy, setBusy] = useState<string | null>(null);
  const [res, setRes] = useState<WriteResult | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  async function run(kind: "save" | "delete") {
    setBusy(kind); setRes(null);
    try {
      const r = kind === "save" ? await edit({ data: { id, text: value.trim() } }) : await del({ data: { id } });
      setRes(r);
      if (r.status === "ok" && r.results[0]?.ok) { setEditing(false); onChanged(); }
    } catch { setRes({ status: "error" }); }
    setBusy(null);
  }

  return (
    <div className="mt-3">
      {editing && <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={5} className={input} aria-label="Edit draft" />}
      <div className="mt-2 flex flex-wrap gap-2">
        {editing ? (
          <>
            <button className={btn} disabled={!!busy || !value.trim()} onClick={() => run("save")}>{busy === "save" ? "Saving…" : "Save changes"}</button>
            <button className={btn} disabled={!!busy} onClick={() => { setEditing(false); setValue(text); }}>Cancel</button>
          </>
        ) : (
          <button className={btn} disabled={!!busy} onClick={() => setEditing(true)}>Edit</button>
        )}
        <button className={btn} disabled={!!busy} onClick={() => setConfirmDel(true)}>{busy === "delete" ? "Deleting…" : "Delete"}</button>
      </div>
      <Outcome res={res} />
      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>It will be removed from Buffer. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => run("delete")}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function IdeasView({ onUse }: { onUse: (text: string, ideaId: string) => void }) {
  const load = useServerFn(getBufferIdeas);
  const create = useServerFn(createBufferIdea);
  const [res, setRes] = useState<IdeasResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<WriteResult | null>(null);
  const [media, setMedia] = useState<AttachedMedia[]>([]);
  const [mediaBusy, setMediaBusy] = useState(false);

  function refresh(force: boolean) {
    setLoading(true);
    load({ data: { force } }).then(setRes).catch(() => setRes({ status: "error" })).finally(() => setLoading(false));
  }
  useEffect(() => { refresh(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (busy || mediaBusy) return;
    setBusy(true); setOut(null);
    try {
      const r = await create({ data: { title: title.trim(), text: text.trim(), media: media.map(({ path, type }) => ({ path, type })) } });
      setOut(r);
      if (r.status === "ok" && r.results[0]?.ok) { for (const m of media) URL.revokeObjectURL(m.preview); setMedia([]); setTitle(""); setText(""); refresh(true); }
    } catch { setOut({ status: "error" }); }
    setBusy(false);
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-foreground">Ideas</h1>
        <button onClick={() => refresh(true)} disabled={loading} className={btn}>{loading ? "Refreshing…" : "Refresh"}</button>
      </div>
      <form onSubmit={add} className="mt-6 space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm uppercase tracking-widest text-muted-foreground">New idea</h2>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className={input} aria-label="Idea title" maxLength={300} />
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Notes or draft text" className={input} aria-label="Idea text" />
        <MagicBar text={text} setText={setText} limit={0} />
        <MediaAttachments value={media} onChange={setMedia} onBusy={setMediaBusy} disabled={busy} imagesOnly />
        <button type="submit" className={primary} disabled={busy || mediaBusy || (!title.trim() && !text.trim())}>{busy ? "Saving…" : "Save idea"}</button>
        <Outcome res={out} />
      </form>
      {!res && <div className="mt-6 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>}
      {res?.status === "reconnect" && <div className="mt-6"><p className="text-sm text-muted-foreground">Your Buffer connection has expired.</p><Reconnect /></div>}
      {res?.status === "error" && <p role="alert" className="mt-6 text-sm text-destructive">Couldn't load your ideas from Buffer. Try Refresh in a moment.</p>}
      {res?.status === "ok" && res.ideas.length === 0 && <p className="mt-6 text-sm text-muted-foreground">No ideas in Buffer yet. Add your first one above.</p>}
      {res?.status === "ok" && res.ideas.length > 0 && (
        <ul className="mt-6 space-y-3">
          {res.ideas.map((i) => (
            <li key={i.id} className="rounded-2xl border border-border bg-card p-4">
              {i.title && <p className="font-display text-lg text-foreground">{i.title}</p>}
              {i.text && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground line-clamp-4">{i.text}</p>}
              <button className={`${btn} mt-3`} onClick={() => onUse([i.title, i.text].filter(Boolean).join("\n\n"), i.id)}>Turn idea into draft</button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
