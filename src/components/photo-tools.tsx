import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Undo2, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MEDIA_BUCKET } from "@/lib/media";
import { getPhotoFeatures, magicPhoto, photoToPost } from "@/lib/photo.functions";
import { PHOTO_EDIT_STYLES, type PhotoEditStyle } from "@/lib/photo-shared";
import type { AttachedMedia } from "@/components/media-attachments";

const btnSmall = "inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-4 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50";

type Features = {
  captionLeft: number; captionLimit: number; editLeft: number; editLimit: number; editAvailable: boolean;
};
type CaptionDraft = { caption: string; hashtags: string[] };
type EditDraft = { path: string; url: string };

// Magic Photo and Photo to Post for the single uploaded image in New post.
// The image goes to the AI gateway only when the user taps a button.
export function PhotoTools({ media, setMedia, text, setText, limit, disabled, retainedPaths }: {
  media: AttachedMedia[];
  setMedia: (v: AttachedMedia[]) => void;
  text: string;
  setText: (v: string) => void;
  limit: number;
  disabled?: boolean;
  retainedPaths?: Set<string>;
}) {
  const loadFeatures = useServerFn(getPhotoFeatures);
  const runCaption = useServerFn(photoToPost);
  const runEdit = useServerFn(magicPhoto);

  const [features, setFeatures] = useState<Features | null>(null);
  const [busy, setBusy] = useState<"caption" | "edit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState<CaptionDraft | null>(null);
  const [prevText, setPrevText] = useState<string | null>(null);
  const [style, setStyle] = useState<PhotoEditStyle>("clean");
  const [edit, setEdit] = useState<EditDraft | null>(null);
  const [original, setOriginal] = useState<AttachedMedia | null>(null);
  const [replaced, setReplaced] = useState(false);
  const busyRef = useRef(false);

  const image = media.length === 1 && media[0]?.type === "image" ? media[0] : null;
  const imagePath = image?.path ?? null;

  const refresh = useCallback(() => {
    loadFeatures().then(setFeatures).catch(() => {});
  }, [loadFeatures]);
  useEffect(() => { if (imagePath) refresh(); }, [imagePath, refresh]);

  // Reset feature state when the attachment changes to a different image.
  useEffect(() => {
    setCaption(null); setEdit(null); setOriginal(null); setReplaced(false); setError(null); setPrevText(null);
  }, [imagePath]);

  if (!image) return null;

  const captionOut = features !== null && features.captionLeft <= 0;
  const editOut = features !== null && features.editLeft <= 0;

  async function discardEdited(path: string) {
    await supabase.storage.from(MEDIA_BUCKET).remove([path]).catch(() => {});
  }

  async function captionFor(path: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy("caption"); setError(null);
    try {
      const r = await runCaption({ data: { path, text, limit, language: navigator.language || "en" } });
      if (r.ok) { setCaption({ caption: r.caption, hashtags: r.hashtags }); }
      else setError(r.error);
    } catch { setError("Couldn't write a caption from this photo right now. Please try again."); }
    refresh();
    busyRef.current = false;
    setBusy(null);
  }

  async function editWith(nextStyle: PhotoEditStyle) {
    if (busyRef.current || !image) return;
    busyRef.current = true;
    setBusy("edit"); setError(null);
    try {
      const r = await runEdit({ data: { path: image.path, style: nextStyle } });
      if (r.ok) {
        if (edit) await discardEdited(edit.path);
        setEdit({ path: r.path, url: r.url });
      } else setError(r.error);
    } catch { setError("Couldn't improve this photo right now. Please try again."); }
    refresh();
    busyRef.current = false;
    setBusy(null);
  }

  async function useEditedPhoto() {
    if (!edit || !image) return;
    try {
      const res = await fetch(edit.url);
      const blob = await res.blob();
      const file = new File([blob], image.file.name, { type: blob.type || image.file.type });
      setOriginal(image);
      setMedia([{ path: edit.path, type: "image", file, preview: URL.createObjectURL(blob) }]);
      setEdit(null);
      setReplaced(true);
    } catch { setError("Couldn't load the improved photo. Please try again."); }
  }

  async function undoReplace() {
    if (!original) return;
    // The edited file stays in storage unlinked; hourly cleanup removes it.
    if (image && !retainedPaths?.has(image.path)) await discardEdited(image.path);
    URL.revokeObjectURL(image?.preview ?? "");
    setMedia([original]);
    setOriginal(null);
    setReplaced(false);
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btnSmall} disabled={disabled || !!busy || captionOut} onClick={() => captionFor(image.path)}>
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> {busy === "caption" ? "Writing…" : "Photo to Post"}
        </button>
        {features?.editAvailable && (
          <>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Style
              <select value={style} onChange={(e) => setStyle(e.target.value as PhotoEditStyle)} aria-label="Photo style"
                className="h-9 max-w-full rounded-full border border-border bg-background px-3 text-xs text-foreground">
                {PHOTO_EDIT_STYLES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </label>
            <button type="button" className={btnSmall} disabled={disabled || !!busy || editOut} onClick={() => editWith(style)}>
              <Wand2 className="h-3.5 w-3.5" aria-hidden /> {busy === "edit" ? "Improving…" : "Magic Photo"}
            </button>
          </>
        )}
        {features && (
          <span className="text-xs text-muted-foreground">
            {features.captionLeft} of {features.captionLimit} captions used today
            {features.editAvailable && ` · ${features.editLeft} of ${features.editLimit} photo edits used today`}
          </span>
        )}
      </div>
      {captionOut && <p className="text-xs text-muted-foreground">You've used all {features?.captionLimit} Photo to Post requests for today. Try again tomorrow.</p>}
      {features?.editAvailable && editOut && <p className="text-xs text-muted-foreground">You've used all {features.editLimit} Magic Photo edits for today. Try again tomorrow.</p>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

      {caption && (
        <div className="space-y-2 rounded-xl border border-border bg-card p-3">
          <p className="whitespace-pre-wrap text-sm text-foreground">{caption.caption}</p>
          {caption.hashtags.length > 0 && <p className="text-sm text-muted-foreground">{caption.hashtags.join(" ")}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSmall} onClick={() => { setPrevText(text); setText(caption.caption); }}>Use caption</button>
            {caption.hashtags.length > 0 && (
              <button type="button" className={btnSmall}
                onClick={() => { setPrevText(text); setText([text.trim(), caption.hashtags.join(" ")].filter(Boolean).join("\n")); }}>
                Use hashtags
              </button>
            )}
            <button type="button" className={btnSmall} disabled={!!busy || captionOut} onClick={() => captionFor(image.path)}>Try again</button>
            {prevText !== null && (
              <button type="button" className={btnSmall} onClick={() => { setText(prevText); setPrevText(null); }}>
                <Undo2 className="h-3.5 w-3.5" aria-hidden /> Undo
              </button>
            )}
            <button type="button" className={btnSmall} onClick={() => setCaption(null)}>Close</button>
          </div>
        </div>
      )}

      {edit && (
        <div className="space-y-2 rounded-xl border border-border bg-card p-3">
          <div className="grid grid-cols-2 gap-3">
            <figure>
              <img src={image.preview} alt="Original photo" className="aspect-square w-full rounded-md border border-border object-contain" />
              <figcaption className="mt-1 text-center text-xs text-muted-foreground">Before</figcaption>
            </figure>
            <figure>
              <img src={edit.url} alt="Improved photo" className="aspect-square w-full rounded-md border border-border object-contain" />
              <figcaption className="mt-1 text-center text-xs text-muted-foreground">After</figcaption>
            </figure>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSmall} onClick={useEditedPhoto}>Use this photo</button>
            <button type="button" className={btnSmall} onClick={() => { void discardEdited(edit.path); setEdit(null); }}>Keep original</button>
            <button type="button" className={btnSmall} disabled={!!busy || editOut} onClick={() => editWith(style)}>Try another style</button>
          </div>
        </div>
      )}

      {replaced && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btnSmall} disabled={disabled || !!busy || captionOut} onClick={() => captionFor(image.path)}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Write caption from photo
          </button>
          <button type="button" className={btnSmall} onClick={undoReplace}>
            <Undo2 className="h-3.5 w-3.5" aria-hidden /> Undo
          </button>
        </div>
      )}
    </div>
  );
}
