"use client";

import * as React from "react";
import { Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FolderIcon = {
  src?: string;
  node?: React.ReactNode;
  background?: string;
  label?: string;
};

export type IconFolderProps = {
  title?: string;
  tags?: string[];
  icons?: FolderIcon[];
  theme?: "dark" | "light";
  defaultOpen?: boolean;
  spread?: number;
  showPill?: boolean;
  className?: string;
};

// Supply brand marks through `icons`; the generic default needs no remote assets.
export const DEFAULT_ICONS: FolderIcon[] = [
  { label: "Channels", node: <Folder aria-hidden="true" /> },
];

const pathL = (w: number, h: number) => {
  const r = 16, d = 24, tw = w * 0.42, s = 40;
  return `M0 ${r}A${r} ${r} 0 0 1 ${r} 0L${tw} 0C${tw + s * 0.55} 0 ${tw + s * 0.45} ${d} ${tw + s} ${d}L${w - r} ${d}A${r} ${r} 0 0 1 ${w} ${d + r}L${w} ${h - r}A${r} ${r} 0 0 1 ${w - r} ${h}L${r} ${h}A${r} ${r} 0 0 1 0 ${h - r}Z`;
};
const pathR = (w: number, h: number) => {
  const r = 16, d = 24, x = w * 0.6, s = 40;
  return `M0 ${d + r}A${r} ${r} 0 0 1 ${r} ${d}L${x - s} ${d}C${x - s * 0.45} ${d} ${x - s * 0.55} 0 ${x} 0L${w - r} 0A${r} ${r} 0 0 1 ${w} ${r}L${w} ${h - r}A${r} ${r} 0 0 1 ${w - r} ${h}L${r} ${h}A${r} ${r} 0 0 1 0 ${h - r}Z`;
};

function useShape(ref: React.RefObject<HTMLDivElement | null>, make: (w: number, h: number) => string) {
  const [shape, setShape] = React.useState("");
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setShape(make(el.offsetWidth, el.offsetHeight));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, make]);
  return shape;
}

function Tile({ icon }: { icon: FolderIcon }) {
  return (
    <span className="icon-folder-tile" style={icon.background ? { background: icon.background } : undefined}>
      {icon.src ? <img src={icon.src} alt="" draggable={false} className="h-full w-full object-cover" /> : icon.node}
    </span>
  );
}

export function IconFolder({
  title = "Channels", tags, icons = DEFAULT_ICONS, theme = "light",
  defaultOpen = false, spread = 70, showPill = true, className,
}: IconFolderProps) {
  const labels = tags ?? icons.flatMap((icon) => icon.label ? [icon.label] : []);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const frontRef = React.useRef<HTMLDivElement>(null);
  const backRef = React.useRef<HTMLDivElement>(null);
  const [shown, setShown] = React.useState(false);
  const [open, setOpen] = React.useState(defaultOpen);
  const [hover, setHover] = React.useState(false);
  const [highlight, setHighlight] = React.useState<number | null>(null);
  const [width, setWidth] = React.useState(320);
  const frontD = useShape(frontRef, pathL);
  const backD = useShape(backRef, pathR);
  const wide = open || hover;

  React.useEffect(() => setOpen(defaultOpen), [defaultOpen]);
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) { setShown(true); observer.disconnect(); }
    }, { threshold: 0.3 });
    observer.observe(el);
    const resize = new ResizeObserver(() => setWidth(el.offsetWidth));
    resize.observe(el);
    return () => { observer.disconnect(); resize.disconnect(); };
  }, []);

  const gap = Math.min(spread * (wide ? 1.15 : 1), Math.max(0, width - 104) / Math.max(1, icons.length - 1));
  return (
    <div ref={rootRef} className={cn("icon-folder", className)} data-theme={theme} data-shown={shown} data-open={wide}>
      <div ref={backRef} className="icon-folder-back" style={{ clipPath: backD ? `path('${backD}')` : undefined }} aria-hidden="true">
        <svg className="absolute inset-0 h-full w-full" aria-hidden="true"><path d={backD} fill="none" stroke="var(--border)" strokeWidth="2" /></svg>
      </div>
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {icons.map((icon, i) => {
          const k = i - (icons.length - 1) / 2;
          const rotation = k * (icons.length > 1 ? 25 / (icons.length - 1) : 0) * (wide ? 1.2 : 1);
          return (
            <div key={icon.label ?? i} className="icon-folder-icon" style={{
              transform: `translate3d(${k * gap}px, ${k * k * 4 - (wide ? 18 : 0)}px, 0) rotate(${rotation}deg)`,
              zIndex: highlight === i ? 5 : undefined,
              transitionDelay: `${i * 0.035}s`,
            }}>
              <div className="icon-folder-icon-inner" onPointerEnter={(e) => { if (e.pointerType === "mouse") setHighlight(i); }} onPointerLeave={() => setHighlight(null)} style={{ transform: highlight === i ? `translateY(-18px) rotate(${-rotation}deg)` : undefined }}>
                <Tile icon={icon} />
                {icon.label && <span className="icon-folder-tooltip" data-visible={highlight === i}>{icon.label}</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div ref={frontRef} className="icon-folder-front" style={{ clipPath: frontD ? `path('${frontD}')` : undefined }}>
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true"><path d={frontD} fill="none" stroke="var(--border)" strokeWidth="2" /></svg>
        <h3 className="relative m-0 px-5 pt-9 font-display text-2xl leading-8">{title}</h3>
        <ul className="relative mx-5 mt-3 flex flex-wrap gap-1.5" aria-label="Platforms">
          {labels.map((label) => <li key={label} className="icon-folder-tag">{label}</li>)}
        </ul>
        {showPill && <span className="icon-folder-pill" aria-hidden="true">{icons.map((icon, i) => <span key={icon.label ?? i}><Tile icon={icon} /></span>)}</span>}
      </div>
      <Button variant="ghost" className="icon-folder-toggle" aria-label={`${title}: ${labels.join(", ")}`} aria-expanded={wide}
        onClick={() => setOpen((value) => !value)}
        onPointerEnter={(e) => { if (e.pointerType === "mouse") setHover(true); }}
        onPointerLeave={() => { setHover(false); setHighlight(null); }} />
    </div>
  );
}

export default IconFolder;