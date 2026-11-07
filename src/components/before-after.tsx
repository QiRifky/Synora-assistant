import { useState } from "react";

function Placeholder({ tag, align }: { tag: string; align: "left" | "right" }) {
  return (
    <div className={`flex h-full w-full flex-col justify-center gap-2 bg-muted px-8 ${align === "left" ? "items-start text-left" : "items-end text-right"}`}>
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{tag}</span>
      <span className="text-sm text-muted-foreground">Example photo coming soon</span>
    </div>
  );
}

// Draggable before/after comparison. Plain HTML/CSS with a range input, so it
// works with keyboard and touch without any library. No animation, so it is
// calm for prefers-reduced-motion users too.
export function BeforeAfter({ before, after, style }: { before: string | null; after: string | null; style: string }) {
  const [pos, setPos] = useState(50);
  return (
    <figure>
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-muted shadow-soft">
        {before
          ? <img src={before} alt="Product photo before Magic Photo" width={800} height={600} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          : <div className="absolute inset-0"><Placeholder tag="Before" align="left" /></div>}
        <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
          {after
            ? <img src={after} alt={`Product photo after Magic Photo, ${style} style`} width={800} height={600} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            : <div className="absolute inset-0"><Placeholder tag={`After · ${style}`} align="right" /></div>}
        </div>
        <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%` }} aria-hidden>
          <div className="absolute inset-y-0 -left-px w-0.5 bg-primary" />
          <div className="absolute top-1/2 -left-4 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-xs text-primary shadow-soft">⇔</div>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label={`Compare before and after, ${style} style`}
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        />
      </div>
      <figcaption className="mt-3 text-center text-xs uppercase tracking-widest text-muted-foreground">{style} style</figcaption>
    </figure>
  );
}
