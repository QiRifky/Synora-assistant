import { useEffect, useMemo, useRef, useState } from "react";
import { FolderShelf } from "@/components/folder-shelf";
import { CATEGORIES, TEMPLATES, fillCaption, parseFields, type Template } from "@/lib/templates";
import { Image as ImageIcon, X } from "lucide-react";

// Static, build-time image map — no runtime generation or network calls.
const imageModules = import.meta.glob("../assets/templates/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function imageUrl(slug: string): string | null {
  const key = `../assets/templates/${slug}.webp`;
  return imageModules[key] ?? null;
}

const input =
  "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground";
const chipBase =
  "inline-flex h-9 items-center rounded-full border px-4 text-sm transition-colors";
const chipOn = "border-primary bg-primary text-primary-foreground";
const chipOff = "border-border bg-background text-foreground hover:bg-muted";

function TemplateImage({ template, className }: { template: Template; className?: string }) {
  const url = imageUrl(template.image);
  if (!url) {
    // Neutral gradient fallback with a simple inline icon.
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-muted via-accent to-muted ${className ?? ""}`}
        role="img"
        aria-label={`Illustration placeholder for ${template.title}`}
      >
        <ImageIcon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={`Illustrative photo for the "${template.title}" template`}
      width={1200}
      height={900}
      loading="lazy"
      className={`object-cover ${className ?? ""}`}
    />
  );
}

function TemplatePanel({
  template,
  onClose,
  onUse,
}: {
  template: Template;
  onClose: () => void;
  onUse: (text: string) => void;
}) {
  const fields = useMemo(() => parseFields(template.caption), [template]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const preview = fillCaption(template.caption, values);

  // Focus trap + Escape to close.
  useEffect(() => {
    closeRef.current?.focus();
    const panel = panelRef.current;
    if (!panel) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  // Lock body scroll while the panel is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(preview);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${template.title} template`}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-y-auto rounded-t-2xl border border-border bg-card p-6 shadow-xl motion-safe:animate-in motion-safe:fade-in sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{template.category}</p>
            <h2 className="mt-1 font-display text-2xl text-foreground">{template.title}</h2>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close template"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <TemplateImage template={template} className="mt-4 aspect-[4/3] w-full rounded-xl" />

        <div className="mt-5 space-y-3">
          <p className="text-sm font-medium text-foreground">Fill in the blanks</p>
          {fields.map((field) => (
            <label key={field} className="block">
              <span className="mb-1 block text-xs text-muted-foreground">{field}</span>
              <input
                value={values[field] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))}
                className={input}
                placeholder={field}
              />
            </label>
          ))}
        </div>

        <div className="mt-5">
          <p className="text-sm font-medium text-foreground">Caption preview</p>
          <p className="mt-2 whitespace-pre-wrap rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground">
            {preview}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{preview.length} characters</p>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Photo tip:</span> {template.photoTip}
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={() => onUse(preview)}
            className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground"
          >
            Use in New post
          </button>
          <button
            onClick={copyCaption}
            className="inline-flex h-11 items-center rounded-full border border-border px-6 text-sm font-medium text-foreground hover:bg-muted"
          >
            {copied ? "Copied" : "Copy caption"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TemplateLibrary({ onUse }: { onUse: (text: string) => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [open, setOpen] = useState<Template | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TEMPLATES.filter((t) => {
      if (category !== "All" && t.category !== category) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [query, category]);

  return (
    <>
      <div className="mt-6 space-y-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search templates…"
          aria-label="Search templates"
          className={input}
        />
        <FolderShelf
          groups={CATEGORIES.map((c) => ({ key: c, label: c, items: TEMPLATES.filter((t) => t.category === c).map((t) => t.title) }))}
          selected={category === "All" ? null : category}
          onSelect={(k) => setCategory(k ?? "All")}
          allLabel="All templates"
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          {["All", ...CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={`${chipBase} ${category === c ? chipOn : chipOff}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No templates found. Try another word.</p>
      ) : (
        // Hover-reveal grid: hovering one card de-emphasizes the others.
        <ul className="group mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => setOpen(t)}
                aria-label={`${t.title}, ${t.category}`}
                className="relative block h-72 w-full cursor-pointer overflow-hidden rounded-2xl text-left shadow-md transition-all duration-500 ease-in-out group-hover:scale-[0.98] group-hover:opacity-60 group-hover:blur-[2px] hover:!scale-[1.03] hover:!opacity-100 hover:!blur-none focus-visible:!scale-[1.03] focus-visible:!opacity-100 focus-visible:!blur-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:group-hover:scale-100 motion-reduce:group-hover:opacity-100 motion-reduce:group-hover:blur-none motion-reduce:hover:!scale-100"
              >
                <TemplateImage template={t} className="absolute inset-0 h-full w-full" />
                {/* Gradient overlay for text contrast over the image. */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" aria-hidden="true" />
                <div className="absolute bottom-0 left-0 p-5 text-white">
                  <p className="text-xs font-light uppercase tracking-widest opacity-80">{t.category}</p>
                  <p className="mt-1 font-display text-xl font-semibold">{t.title}</p>
                  <p className="mt-1 text-sm opacity-80">{t.description}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Images are illustrative examples, not results of Magic Photo.
      </p>

      {open && (
        <TemplatePanel
          template={open}
          onClose={() => setOpen(null)}
          onUse={(text) => {
            setOpen(null);
            onUse(text);
          }}
        />
      )}
    </>
  );
}
