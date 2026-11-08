import GlassFolder, { type ArtRecipe, type FolderFile } from "@/components/ui/glass-folder-cards";

const ART: ArtRecipe = { style: "streak", colors: ["#f2f2f2", "#cfdcf3", "#0b63f6", "#111111", "#6b7280", "#e5e5e5"], scale: 0.7, warp: 1.5, angle: -0.5, gloss: 0.2, veins: 0 };

export type FolderGroup = { key: string; label: string; items: string[] };

/**
 * Groups items into glass folders. Default: choosing a folder filters the list below.
 * `openOnClick`: a single click/tap on a folder opens it (with a press effect).
 */
export function FolderShelf({ groups, selected, onSelect, allLabel = "All", openOnClick = false }: {
  groups: FolderGroup[];
  selected: string | null;
  onSelect: (key: string | null) => void;
  allLabel?: string;
  openOnClick?: boolean;
}) {
  if (groups.length === 0) return null;
  return (
    <div className="mt-6">
      <div className="grid grid-cols-1 justify-items-center gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {groups.map((g, i) => {
          const files: FolderFile[] = (g.items.length ? g.items : ["Empty"]).slice(0, 5).map((name) => ({ name: name.slice(0, 40) || "Untitled" }));
          const on = selected === g.key;
          const folder = (
            <GlassFolder
              label={g.label}
              meta={`${g.items.length} item${g.items.length === 1 ? "" : "s"}`}
              art={ART}
              seed={i * 7 + 3}
              files={files}
              action="none"
              width={220}
              appearDelay={i * 60}
              onFileSelect={() => (openOnClick ? undefined : onSelect(g.key))}
            />
          );
          if (openOnClick) {
            return (
              <div key={g.key} className="flex min-w-0 flex-col items-center gap-3">
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${g.label}`}
                  onClickCapture={(e) => {
                    e.stopPropagation();
                    onSelect(g.key);
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(g.key); } }}
                  className="cursor-pointer rounded-2xl transition-transform duration-300 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]"
                >
                  {folder}
                </div>
                <p className="text-xs text-muted-foreground">{g.label}</p>
              </div>
            );
          }
          return (
            <div key={g.key} className="flex min-w-0 flex-col items-center gap-3">
              {folder}
              <button
                type="button"
                onClick={() => onSelect(on ? null : g.key)}
                aria-pressed={on}
                className={`inline-flex h-9 items-center rounded-full border px-4 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-muted"}`}
              >
                {on ? "Showing" : "Show"} {g.label}
              </button>
            </div>
          );
        })}
      </div>
      {selected && !openOnClick && (
        <div className="mt-6 flex justify-center">
          <button type="button" onClick={() => onSelect(null)} className="text-sm text-primary underline-offset-4 hover:underline">Show {allLabel.toLowerCase()}</button>
        </div>
      )}
    </div>
  );
}
