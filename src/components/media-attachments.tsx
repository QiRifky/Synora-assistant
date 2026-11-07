import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { ImagePlus, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { getMediaAvailability, getMediaUsage } from "@/lib/media.functions";
import { MEDIA_BUCKET, validateMedia, resizeDimensions, type MediaAttachment } from "@/lib/media";
import {
  COMPRESS_MAX_SIDE, COMPRESS_QUALITY, COMPRESS_SKIP_BYTES, GLOBAL_MAX_FILES,
  checkMediaAgainstLimits, describeLimits, effectiveMediaLimits, formatBytes,
  type ChannelInfo, type MediaFileInfo,
} from "@/lib/media-limits";

export type AttachedMedia = MediaAttachment & { file: File; preview: string; note?: string | null };

async function upload(file: File, progress: (n: number) => void): Promise<AttachedMedia> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Please sign in again before uploading.");
  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const path = `${data.user.id}/${crypto.randomUUID()}.${extension}`;
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) throw new Error("Please sign in again before uploading.");
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${import.meta.env['VITE_SUPABASE_URL']}/storage/v1/object/${MEDIA_BUCKET}/${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${session.session?.access_token}`);
    xhr.setRequestHeader("apikey", import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY']);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) progress(Math.round(e.loaded / e.total * 100)); };
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Couldn't upload ${file.name}. Please try again.`));
    xhr.onerror = () => reject(new Error(`Couldn't upload ${file.name}. Check your connection.`));
    xhr.send(file);
  });
  return { file, path, type: file.type === "video/mp4" ? "video" : "image", preview: URL.createObjectURL(file) };
}

// Shrinks images before upload: max 1440 px on the longest side, JPG/WebP at
// ~80% quality, PNG kept only when it has transparency. Never upscales, never
// touches videos, and skips files already below 500 KB.
async function compressImage(file: File): Promise<{ file: File; note: string | null }> {
  if (!file.type.startsWith("image/") || file.size < COMPRESS_SKIP_BYTES) return { file, note: null };
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, COMPRESS_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return { file, note: null };
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    let type = file.type;
    if (file.type === "image/png") {
      const pixels = context.getImageData(0, 0, width, height).data;
      let transparent = false;
      for (let i = 3; i < pixels.length; i += 40) { if ((pixels[i] ?? 255) < 255) { transparent = true; break; } }
      if (!transparent) type = "image/jpeg";
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, COMPRESS_QUALITY));
    if (!blob || blob.size >= file.size) return { file, note: null };
    const name = type === file.type ? file.name : file.name.replace(/\.png$/i, ".jpg");
    return { file: new File([blob], name, { type }), note: `${formatBytes(file.size)} → ${formatBytes(blob.size)}` };
  } catch {
    return { file, note: null };
  }
}

export function MediaAttachments({ value, onChange, onBusy, disabled = false, imagesOnly = false, retainedPaths, channels, onViolation, studio = false }: {
  value: AttachedMedia[]; onChange: (v: AttachedMedia[]) => void; onBusy: (v: boolean) => void; disabled?: boolean; imagesOnly?: boolean; retainedPaths?: Set<string>; studio?: boolean;
  channels?: ChannelInfo[]; onViolation?: (message: string | null) => void;
}) {
  const checkAvailability = useServerFn(getMediaAvailability);
  const loadUsage = useServerFn(getMediaUsage);
  const picker = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<{ usedBytes: number; quotaBytes: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ name: string; percent: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AttachedMedia | null>(null);

  const limits = effectiveMediaLimits(channels ?? []);
  const toInfo = (m: { file: File; type: "image" | "video" }): MediaFileInfo => ({ name: m.file.name, size: m.file.size, kind: m.type });

  const refreshUsage = useCallback(() => { loadUsage().then(setUsage).catch(() => {}); }, [loadUsage]);
  useEffect(() => { checkAvailability().then((r) => setAvailable(r.available)).catch(() => setAvailable(false)); }, [checkAvailability]);
  useEffect(() => { refreshUsage(); }, [refreshUsage]);

  // Re-check existing files whenever the channel selection or files change;
  // report violations so the form can block saving. Files are never auto-deleted.
  const violation = checkMediaAgainstLimits(value.map(toInfo), limits);
  useEffect(() => { onViolation?.(violation); }, [violation, onViolation]);

  function working(v: boolean) { lock.current = v; setBusy(v); onBusy(v); }

  async function add(files: File[]) {
    if (lock.current || disabled) return;
    setError(null);
    const typeErrors = files.map((f) => f.size === 0 ? `${f.name} is empty.` : validateMedia({ name: f.name, size: 1, type: f.type }, imagesOnly)).filter(Boolean);
    if (typeErrors.length) { setError(typeErrors.join(" ")); return; }
    if (!available) { setError("Media uploads are unavailable until public storage is enabled by your workspace owner."); return; }
    working(true);
    try {
      // Compress first, then check channel limits on the compressed files.
      const prepared: { file: File; note: string | null }[] = [];
      for (const file of files) {
        setProgress({ name: file.name, percent: 0 });
        prepared.push(await compressImage(file));
      }
      const incoming = prepared.map((p) => ({ name: p.file.name, size: p.file.size, kind: (p.file.type === "video/mp4" ? "video" : "image") as "image" | "video" }));
      const limitError = checkMediaAgainstLimits([...value.map(toInfo), ...incoming], limits);
      if (limitError) { setError(limitError); return; }
      const addedBytes = prepared.reduce((sum, p) => sum + p.file.size, 0);
      if (usage && usage.usedBytes + addedBytes > usage.quotaBytes) {
        setError("Your 100 MB media storage is full. Remove old files or delete old drafts to free space.");
        return;
      }
      const next = [...value];
      for (const p of prepared) {
        setProgress({ name: p.file.name, percent: 0 });
        next.push({ ...(await upload(p.file, (percent) => setProgress({ name: p.file.name, percent }))), note: p.note });
        onChange([...next]);
      }
      refreshUsage();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't upload media. Please try again."); }
    finally { setProgress(null); working(false); }
  }

  async function remove(item: AttachedMedia) {
    if (lock.current || disabled) return;
    working(true); setError(null);
    try {
      if (!retainedPaths?.has(item.path)) {
        const { error: failure } = await supabase.storage.from(MEDIA_BUCKET).remove([item.path]);
        if (failure) throw new Error(`Couldn't remove ${item.file.name}. Please try again.`);
      }
      URL.revokeObjectURL(item.preview);
      onChange(value.filter((m) => m.path !== item.path));
      refreshUsage();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't remove media."); }
    finally { working(false); }
  }

  async function replace(file: File) {
    if (!editing || lock.current || disabled) return;
    const original = editing;
    const validation = validateMedia(file, true);
    if (validation) { setError(validation); return; }
    working(true); setError(null);
    let replacement: AttachedMedia | null = null;
    try {
      const prepared = await compressImage(file);
      const limitError = checkMediaAgainstLimits([...value.filter((m) => m.path !== original.path).map(toInfo), { name: prepared.file.name, size: prepared.file.size, kind: "image" }], limits);
      if (limitError) { setError(limitError); return; }
      replacement = { ...(await upload(prepared.file, (percent) => setProgress({ name: prepared.file.name, percent }))), note: prepared.note };
      if (!retainedPaths?.has(original.path)) {
        const { error: failure } = await supabase.storage.from(MEDIA_BUCKET).remove([original.path]);
        if (failure) throw new Error("Couldn't replace the original image. Please try again.");
      }
      URL.revokeObjectURL(original.preview);
      onChange(value.map((m) => m.path === original.path ? replacement ?? m : m));
      setEditing(null);
      refreshUsage();
    } catch (e) {
      if (replacement) {
        await supabase.storage.from(MEDIA_BUCKET).remove([replacement.path]);
        URL.revokeObjectURL(replacement.preview);
      }
      setError(e instanceof Error ? e.message : "Couldn't upload the edited image.");
    } finally { setProgress(null); working(false); }
  }

  const activeMax = value.some((m) => m.type === "video") ? limits.maxVideos : limits.maxImages;

  if (studio) {
    return <div className="space-y-3">
      <input ref={picker} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Photo file" disabled={busy || disabled} onChange={(e) => { void add(Array.from(e.target.files ?? []).slice(0, 1)); e.target.value = ""; }} />
      {value.length === 0 ? (
        <button type="button" disabled={busy || disabled || available === false}
          onClick={() => picker.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void add(Array.from(e.dataTransfer.files).slice(0, 1)); }}
          className="flex min-h-[320px] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-muted/30 px-6 py-12 text-center transition-colors hover:border-primary hover:bg-muted/60 disabled:opacity-60">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"><ImagePlus className="h-7 w-7" aria-hidden /></span>
          <span className="text-lg font-medium text-foreground">{busy ? "Uploading your photo…" : "Upload a photo to start"}</span>
          <span className="max-w-sm text-sm text-muted-foreground">Drag a photo here or click to choose one. JPG, PNG or WebP, up to {formatBytes(limits.imageMaxBytes)}.</span>
        </button>
      ) : value.map((m) => <div key={m.path} className="rounded-2xl border border-border p-3">
        <img src={m.preview} alt={m.file.name} className="mx-auto max-h-[420px] w-full rounded-xl object-contain" />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 truncate text-xs text-muted-foreground" title={m.file.name}>{m.file.name}{m.note ? ` · ${m.note}` : ""}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy || disabled} onClick={() => setEditing(m)}><Pencil /> Crop</Button>
            <Button type="button" variant="outline" size="sm" disabled={busy || disabled} onClick={() => void remove(m)}><X /> Remove photo</Button>
          </div>
        </div>
      </div>)}
      {progress && <div role="status" className="space-y-1"><p className="break-words text-xs text-muted-foreground">Uploading {progress.name} · {progress.percent}%</p><progress className="h-2 w-full accent-primary" max={100} value={progress.percent} aria-label="Upload progress" /></div>}
      {available === false && <p role="alert" className="text-xs text-destructive">Photo uploads are unavailable right now.</p>}
      {violation && <p role="alert" className="text-sm text-destructive">{violation}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {editing && <ImageEditor media={editing} busy={busy || disabled} onClose={() => { if (!busy) setEditing(null); }} onSave={replace} />}
    </div>;
  }

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button type="button" variant="outline" disabled={busy || disabled || value.length >= GLOBAL_MAX_FILES} onClick={() => picker.current?.click()}><ImagePlus /> Add media</Button>
      <span className="text-xs text-muted-foreground">{value.length}/{activeMax} files · max {formatBytes(limits.imageMaxBytes)} each</span>
    </div>
    <input ref={picker} className="sr-only" type="file" multiple accept={imagesOnly ? "image/jpeg,image/png,image/webp" : "image/jpeg,image/png,image/webp,video/mp4"} aria-label="Media files" disabled={busy || disabled} onChange={(e) => { void add(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
    <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void add(Array.from(e.dataTransfer.files)); }} className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
      Drop {imagesOnly ? "JPG, PNG or WebP images" : "JPG, PNG, WebP or MP4 files"} here
    </div>
    {channels && <p className="text-xs text-muted-foreground">{describeLimits(limits)}</p>}
    {limits.unchecked.map((name) => <p key={name} className="text-xs text-muted-foreground">Limits for this channel are not checked: {name}</p>)}
    {usage && <p className="text-xs text-muted-foreground">Storage used: {formatBytes(usage.usedBytes)} of {formatBytes(usage.quotaBytes)}</p>}
    {available === false && <p role="alert" className="text-xs text-destructive">Public media storage is not enabled. Uploads are unavailable.</p>}
    {progress && <div role="status" className="space-y-1"><p className="break-words text-xs text-muted-foreground">Uploading {progress.name} · {progress.percent}%</p><progress className="h-2 w-full accent-primary" max={100} value={progress.percent} aria-label="Upload progress" /></div>}
    {value.length > 0 && <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {value.map((m) => <li key={m.path} className="min-w-0 rounded-lg border border-border p-2">
        {m.type === "image" ? <img src={m.preview} alt={m.file.name} className="aspect-square w-full rounded-md object-contain" /> : <video src={m.preview} controls preload="metadata" className="aspect-square w-full rounded-md object-contain" />}
        <p className="mt-2 truncate text-xs text-muted-foreground" title={m.file.name}>{m.file.name}</p>
        {m.note && <p className="text-xs text-muted-foreground">{m.note}</p>}
        <div className="mt-2 flex gap-2">
          {m.type === "image" && <Button type="button" variant="outline" size="sm" disabled={busy || disabled} onClick={() => setEditing(m)}><Pencil /> Edit</Button>}
          <Button type="button" variant="ghost" size="icon" title={`Remove ${m.file.name}`} aria-label={`Remove ${m.file.name}`} disabled={busy || disabled} onClick={() => void remove(m)}><X /></Button>
        </div>
      </li>)}
    </ul>}
    {violation && <p role="alert" className="text-sm text-destructive">{violation}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {editing && <ImageEditor media={editing} busy={busy || disabled} onClose={() => { if (!busy) setEditing(null); }} onSave={replace} />}
  </div>;
}

function ImageEditor({ media, busy, onClose, onSave }: { media: AttachedMedia; busy: boolean; onClose: () => void; onSave: (file: File) => Promise<void> }) {
  const image = useRef<HTMLImageElement>(null);
  const [ratio, setRatio] = useState("free");
  const [width, setWidth] = useState(1080);
  const [crop, setCrop] = useState<Crop>();
  const [pixels, setPixels] = useState<PixelCrop>();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const aspect = ratio === "free" ? undefined : { "1:1": 1, "4:5": 4 / 5, "16:9": 16 / 9, "9:16": 9 / 16 }[ratio];
  function reset(value: string) {
    setRatio(value); setPixels(undefined);
    const el = image.current;
    const nextAspect = { "1:1": 1, "4:5": 4 / 5, "16:9": 16 / 9, "9:16": 9 / 16 }[value];
    if (el && nextAspect) setCrop(centerCrop(makeAspectCrop({ unit: "%", width: 90 }, nextAspect, el.width, el.height), el.width, el.height));
    else setCrop(undefined);
  }
  async function save() {
    const el = image.current;
    if (!el || !el.naturalWidth || busy || processing) return;
    setProcessing(true); setError(null);
    try {
      const sx = el.naturalWidth / el.width, sy = el.naturalHeight / el.height;
      const area = pixels && pixels.width > 0 && pixels.height > 0 ? pixels : crop?.unit === "%" ? { x: crop.x * el.width / 100, y: crop.y * el.height / 100, width: crop.width * el.width / 100, height: crop.height * el.height / 100 } : { x: 0, y: 0, width: el.width, height: el.height };
      const output = resizeDimensions(area.width * sx, area.height * sy, width);
      const canvas = document.createElement("canvas");
      canvas.width = output.width; canvas.height = output.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image editing is unavailable in this browser.");
      context.drawImage(el, area.x * sx, area.y * sy, area.width * sx, area.height * sy, 0, 0, output.width, output.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, media.file.type, 0.92));
      if (!blob || blob.type !== media.file.type) throw new Error("This browser cannot preserve the original image format.");
      await onSave(new File([blob], media.file.name, { type: media.file.type }));
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't edit the image."); }
    finally { setProcessing(false); }
  }
  return <Dialog open onOpenChange={(open) => { if (!open && !processing) onClose(); }}>
    <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle>Edit image</DialogTitle><DialogDescription>{media.file.name}</DialogDescription></DialogHeader>
      <div className="flex flex-wrap gap-3">
        <label className="text-sm text-muted-foreground">Crop ratio<select aria-label="Crop ratio" className="ml-2 rounded-md border border-border bg-background p-2 text-foreground" value={ratio} disabled={busy || processing} onChange={(e) => reset(e.target.value)}>{["free", "1:1", "4:5", "16:9", "9:16"].map((r) => <option key={r} value={r}>{r === "free" ? "Free" : r}</option>)}</select></label>
        <label className="text-sm text-muted-foreground">Max width<select aria-label="Max width" className="ml-2 rounded-md border border-border bg-background p-2 text-foreground" value={width} disabled={busy || processing} onChange={(e) => setWidth(Number(e.target.value))}><option value={1080}>1080 px</option><option value={1440}>1440 px</option><option value={0}>Original</option></select></label>
      </div>
      <div className="flex justify-center overflow-hidden"><ReactCrop {...(crop ? { crop } : {})} onChange={(c) => setCrop(c)} onComplete={(c) => setPixels(c)} {...(aspect ? { aspect } : {})} disabled={busy || processing}><img ref={image} src={media.preview} alt="Crop image" className="max-h-[45dvh] max-w-full object-contain" /></ReactCrop></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter><Button type="button" variant="outline" disabled={busy || processing} onClick={onClose}>Cancel</Button><Button type="button" disabled={busy || processing} onClick={() => void save()}>{busy || processing ? "Saving image…" : "Apply changes"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
