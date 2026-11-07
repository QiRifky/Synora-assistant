import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LogOut } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteMySynoraData, disconnectBuffer, getBufferConnectionStatus, type BufferChannel, type ConnectionStatus } from "@/lib/buffer.functions";
import { MAGIC_STYLE_KEYS, savePreferences, type Preferences } from "@/lib/settings.functions";
import { loadPreferences, setCachedPreferences } from "@/lib/preferences-client";
import { browserTimeZone, listTimeZones } from "@/lib/timezone";
import synoraLogo from "@/assets/synora-logo.png.asset.json";

const STYLE_LABELS: Record<Preferences["magicStyle"], string> = {
  auto: "Auto", punchier: "Punchier", friendly: "Friendly", professional: "Professional",
  funny: "Funny", inspiring: "Inspiring", storytelling: "Storytelling", emojis: "Add emojis",
};
const MAGIC_STYLE_KEY = "synora-magic-style";
const card = "rounded-2xl border border-border bg-card p-5";
const h2 = "text-sm uppercase tracking-widest text-muted-foreground";
const field = "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground";
const btn = "inline-flex h-9 items-center gap-2 rounded-full border border-border px-4 text-sm text-foreground hover:bg-muted disabled:opacity-50";
const primary = "inline-flex h-9 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50";
const danger = "inline-flex h-9 items-center rounded-full border border-destructive px-4 text-sm text-destructive hover:bg-muted disabled:opacity-50";

export function SettingsView({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <>
      <h1 className="font-display text-3xl text-foreground">Settings</h1>
      <div className="mt-6 space-y-6">
        <section className={card}>
          <h2 className={h2}>Account</h2>
          <label className="mt-3 block text-sm text-muted-foreground">
            Email
            <input value={email} readOnly className={field} aria-label="Email" />
          </label>
          <button onClick={onSignOut} className={`${btn} mt-4`}><LogOut className="h-4 w-4" /> Sign out</button>
        </section>
        <BufferConnection onSignOut={onSignOut} />
        <PreferencesSection />
        <PrivacySection onSignOut={onSignOut} />
        <section className={card}>
          <h2 className={h2}>About</h2>
          <img src={synoraLogo.url} alt="Synora" className="mt-3 h-7 w-auto" />
          <p className="mt-1 text-sm text-muted-foreground">Synora never publishes without your confirmation.</p>
          <p className="mt-3 text-sm"><Link to="/privacy" className="text-primary underline underline-offset-4">Privacy</Link> · <Link to="/terms" className="text-primary underline underline-offset-4">Terms</Link></p>
        </section>
      </div>
    </>
  );
}

function BufferConnection({ onSignOut }: { onSignOut: () => void }) {
  const statusFn = useServerFn(getBufferConnectionStatus);
  const disconnect = useServerFn(disconnectBuffer);
  const [st, setSt] = useState<ConnectionStatus | "error" | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { statusFn().then(setSt).catch(() => setSt("error")); }, [statusFn]);

  async function run() {
    setBusy(true); setErr(null);
    try {
      const r = await disconnect();
      if (r.ok) { setOpen(false); onSignOut(); return; }
      setErr("Couldn't disconnect Buffer. Please try again.");
    } catch { setErr("Couldn't disconnect Buffer. Please try again."); }
    setBusy(false);
  }

  return (
    <section className={card}>
      <h2 className={h2}>Buffer connection</h2>
      {st === null && <div className="mt-3 h-12 animate-pulse rounded-xl bg-muted" />}
      {st === "error" && <p role="alert" className="mt-3 text-sm text-destructive">Couldn't check your Buffer connection. Please reload the page.</p>}
      {st && st !== "error" && (
        <div className="mt-3 space-y-2 text-sm">
          <p className="text-foreground">Status: <span className="font-medium">{st.status === "connected" ? "Connected" : "Reconnect needed"}</span></p>
          {st.status === "reconnect" && (
            <a href="/api/public/buffer/start" className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">Reconnect Buffer</a>
          )}
          <p className="text-muted-foreground">
            Channels: {st.channelCount === null ? "not loaded yet — open the Channels page to load them" : st.channelCount}
          </p>
        </div>
      )}
      <button onClick={() => setOpen(true)} className={`${danger} mt-4`}>Disconnect Buffer</button>
      <p className="mt-3 text-xs text-muted-foreground">To fully remove Synora's access, also remove it in Buffer under Settings &gt; API.</p>
      {err && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
      <AlertDialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Buffer?</AlertDialogTitle>
            <AlertDialogDescription>Synora will delete its stored Buffer access and sign you out. Nothing in your Buffer account is changed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); run(); }}>{busy ? "Disconnecting…" : "Disconnect"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function PreferencesSection() {
  const statusFn = useServerFn(getBufferConnectionStatus);
  const save = useServerFn(savePreferences);
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [channels, setChannels] = useState<BufferChannel[] | null>(null);
  const [tzQuery, setTzQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const zones = useMemo(listTimeZones, []);
  const browserTz = useMemo(browserTimeZone, []);

  useEffect(() => {
    loadPreferences().then((p) => { if (p) setPrefs(p); else setLoadFailed(true); });
    // Already-cached channels only; this page never calls Buffer.
    statusFn().then((r) => setChannels(r.channels ?? [])).catch(() => setChannels([]));
  }, [statusFn]);

  const tz = prefs?.timeZone ?? browserTz;
  const filtered = useMemo(() => {
    const q = tzQuery.trim().toLowerCase();
    const list = q ? zones.filter((z) => z.toLowerCase().includes(q)) : zones;
    return list.includes(tz) ? list : [tz, ...list];
  }, [zones, tzQuery, tz]);

  async function onSave() {
    if (!prefs) return;
    setBusy(true); setMsg(null);
    try {
      const r = await save({ data: prefs });
      if (r.ok) {
        setCachedPreferences(prefs);
        window.localStorage.setItem(MAGIC_STYLE_KEY, prefs.magicStyle);
        setMsg({ ok: true, text: "Preferences saved." });
      } else setMsg({ ok: false, text: "Couldn't save your preferences. Please try again." });
    } catch { setMsg({ ok: false, text: "Couldn't save your preferences. Please try again." }); }
    setBusy(false);
  }

  return (
    <section className={card}>
      <h2 className={h2}>Preferences</h2>
      {!prefs && !loadFailed && <div className="mt-3 h-40 animate-pulse rounded-xl bg-muted" />}
      {loadFailed && <p role="alert" className="mt-3 text-sm text-destructive">Couldn't load your preferences. Please reload the page.</p>}
      {prefs && (
        <div className="mt-3 space-y-4">
          <label className="block text-sm text-muted-foreground">
            Default Magic Caption style
            <select className={field} value={prefs.magicStyle} onChange={(e) => setPrefs({ ...prefs, magicStyle: e.target.value as Preferences["magicStyle"] })}>
              {MAGIC_STYLE_KEYS.map((k) => <option key={k} value={k}>{STYLE_LABELS[k]}</option>)}
            </select>
          </label>
          <label className="block text-sm text-muted-foreground">
            Default channel for New post
            <select className={field} value={prefs.defaultChannelId ?? ""} disabled={channels === null}
              onChange={(e) => setPrefs({ ...prefs, defaultChannelId: e.target.value || null })}>
              <option value="">{channels === null ? "Loading channels…" : channels.length ? "No default" : "No default (open Channels to load your list)"}</option>
              {(channels ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.service})</option>)}
              {prefs.defaultChannelId && channels && !channels.some((c) => c.id === prefs.defaultChannelId) && <option value={prefs.defaultChannelId}>Saved channel (not loaded)</option>}
            </select>
          </label>
          <div className="text-sm text-muted-foreground">
            Time zone for scheduling
            <input className={field} placeholder="Search time zones" value={tzQuery} onChange={(e) => setTzQuery(e.target.value)} aria-label="Search time zones" />
            <select className={field} value={tz} size={5} aria-label="Time zone"
              onChange={(e) => setPrefs({ ...prefs, timeZone: e.target.value })}>
              {filtered.map((z) => <option key={z} value={z}>{z}{z === browserTz ? " (this browser)" : ""}</option>)}
            </select>
            <p className="mt-1 text-xs">Selected: {tz}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className={primary} disabled={busy} onClick={onSave}>{busy ? "Saving…" : "Save"}</button>
            {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.text}</p>}
          </div>
        </div>
      )}
    </section>
  );
}

function PrivacySection({ onSignOut }: { onSignOut: () => void }) {
  const del = useServerFn(deleteMySynoraData);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    if (typed !== "DELETE") return;
    setBusy(true); setErr(null);
    try {
      const r = await del({ data: { confirm: "DELETE" } });
      if (r.ok) { window.localStorage.removeItem(MAGIC_STYLE_KEY); setOpen(false); onSignOut(); return; }
      setErr("Some data couldn't be deleted. Please try again.");
    } catch { setErr("Couldn't delete your data. Please try again."); }
    setBusy(false);
  }

  return (
    <section className={card}>
      <h2 className={h2}>Privacy and data</h2>
      <p className="mt-3 text-sm"><Link to="/privacy" className="text-primary underline underline-offset-4">Privacy</Link> · <Link to="/terms" className="text-primary underline underline-offset-4">Terms</Link></p>
      <button onClick={() => { setTyped(""); setOpen(true); }} className={`${danger} mt-4`}>Delete my Synora data</button>
      <p className="mt-2 text-xs text-muted-foreground">Removes your Synora preferences, uploaded files, usage counters and stored Buffer access. Nothing in your Buffer account is deleted.</p>
      {err && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
      <AlertDialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your Synora data?</AlertDialogTitle>
            <AlertDialogDescription>This removes your preferences, uploaded files, usage counters and stored Buffer access, then signs you out. Your posts, ideas and channels in Buffer stay untouched. Type DELETE to confirm.</AlertDialogDescription>
          </AlertDialogHeader>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} className={field} aria-label="Type DELETE to confirm" placeholder="DELETE" autoComplete="off" />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy || typed !== "DELETE"} onClick={(e) => { e.preventDefault(); run(); }}>{busy ? "Deleting…" : "Delete my data"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
