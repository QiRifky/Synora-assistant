import type { ReactNode } from "react";

/**
 * Sidebar icons drawn with native SVG animation (same technique as the Discover compass).
 * The sidebar restarts them with `svg.setCurrentTime(0)` when the whole menu row is hovered.
 */
type Shape =
  | { d: string }
  | { rect: [number, number, number, number, number] }
  | { circle: [number, number, number] };

const SETTINGS_GEAR =
  "M21.011 14.0965C21.5329 13.9558 21.7939 13.8854 21.8969 13.7508C22 13.6163 22 13.3998 22 12.9669V11.0332C22 10.6003 22 10.3838 21.8969 10.2493C21.7938 10.1147 21.5329 10.0443 21.011 9.90358C19.0606 9.37759 17.8399 7.33851 18.3433 5.40087C18.4817 4.86799 18.5509 4.60156 18.4848 4.44529C18.4187 4.28902 18.2291 4.18134 17.8497 3.96596L16.125 2.98673C15.7528 2.77539 15.5667 2.66972 15.3997 2.69222C15.2326 2.71472 15.0442 2.90273 14.6672 3.27873C13.208 4.73448 10.7936 4.73442 9.33434 3.27864C8.95743 2.90263 8.76898 2.71463 8.60193 2.69212C8.43489 2.66962 8.24877 2.77529 7.87653 2.98663L6.15184 3.96587C5.77253 4.18123 5.58287 4.28891 5.51678 4.44515C5.45068 4.6014 5.51987 4.86787 5.65825 5.4008C6.16137 7.3385 4.93972 9.37763 2.98902 9.9036C2.46712 10.0443 2.20617 10.1147 2.10308 10.2492C2 10.3838 2 10.6003 2 11.0332V12.9669C2 13.3998 2 13.6163 2.10308 13.7508C2.20615 13.8854 2.46711 13.9558 2.98902 14.0965C4.9394 14.6225 6.16008 16.6616 5.65672 18.5992C5.51829 19.1321 5.44907 19.3985 5.51516 19.5548C5.58126 19.7111 5.77092 19.8188 6.15025 20.0341L7.87495 21.0134C8.24721 21.2247 8.43334 21.3304 8.6004 21.3079C8.76746 21.2854 8.95588 21.0973 9.33271 20.7213C10.7927 19.2644 13.2088 19.2643 14.6689 20.7212C15.0457 21.0973 15.2341 21.2853 15.4012 21.3078C15.5682 21.3303 15.7544 21.2246 16.1266 21.0133L17.8513 20.034C18.2307 19.8187 18.4204 19.711 18.4864 19.5547C18.5525 19.3984 18.4833 19.132 18.3448 18.5991C17.8412 16.6616 19.0609 14.6226 21.011 14.0965Z";

function draw(begin: number, dur: number) {
  return (
    <animate attributeName="stroke-dashoffset" values="1;0" begin={`${begin}s`} dur={`${dur}s`} fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.16 1 0.3 1" />
  );
}

function SmilIcon({ shapes, className, spin, size = 14 }: { shapes: Shape[]; className?: string | undefined; spin?: boolean; size?: number }) {
  const els: ReactNode[] = shapes.map((s, i) => {
    const common = { key: i, pathLength: 1, strokeDasharray: "1 1", strokeDashoffset: 0 } as const;
    const anim = draw(i * 0.08, 0.6);
    if ("d" in s) return <path {...common} d={s.d}>{anim}</path>;
    if ("rect" in s) {
      const [x, y, w, h, rx] = s.rect;
      return <rect {...common} x={x} y={y} width={w} height={h} rx={rx}>{anim}</rect>;
    }
    const [cx, cy, r] = s.circle;
    return <circle {...common} cx={cx} cy={cy} r={r}>{anim}</circle>;
  });
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <g>
        {spin && <animateTransform attributeName="transform" type="rotate" values="-90 12 12;0 12 12" dur="0.7s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.16 1 0.3 1" />}
        {els}
      </g>
    </svg>
  );
}

type P = { className?: string; strokeWidth?: number };
const make = (shapes: Shape[], spin = false) => ({ className }: P) => <SmilIcon shapes={shapes} className={className} spin={spin} />;

export const OverviewNavIcon = make([{ rect: [3, 3, 7, 9, 1] }, { rect: [14, 3, 7, 5, 1] }, { rect: [14, 12, 7, 9, 1] }, { rect: [3, 16, 7, 5, 1] }]);
export const CreateNavIcon = make([
  { d: "M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14" },
  { d: "m7.5 4.27 9 5.15" }, { d: "M3.29 7 12 12l8.71-5" }, { d: "M12 22V12" }, { d: "M16 16h6" }, { d: "M19 13v6" },
]);
export const PostsNavIcon = make([
  { d: "M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" },
  { d: "M7 7h8" }, { d: "M7 11h10" }, { d: "M7 15h6" },
]);
export const PhotoNavIcon = make([{ rect: [3, 3, 18, 18, 2] }, { circle: [9, 9, 2] }, { d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" }]);
export const IdeasNavIcon = make([
  { d: "M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" },
  { d: "M9 18h6" }, { d: "M10 22h4" },
]);
export const PlanShipNavIcon = make([
  { d: "M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" }, { d: "M16 2v4" }, { d: "M8 2v4" }, { d: "M3 10h5" },
  { circle: [16, 16, 6] }, { d: "M16 14v2.3l1.5 1.2" },
]);
export const DraftsNavIcon = make([
  { d: "M12.5 22H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v9.5" }, { d: "M14 2v4a2 2 0 0 0 2 2h4" },
  { d: "M13.378 15.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z" },
]);
export const CalendarNavIcon = make([
  { rect: [3, 4, 18, 18, 2] }, { d: "M8 2v4" }, { d: "M16 2v4" }, { d: "M3 10h18" },
  { d: "M8 14h.01" }, { d: "M12 14h.01" }, { d: "M16 14h.01" }, { d: "M8 18h.01" }, { d: "M12 18h.01" }, { d: "M16 18h.01" },
]);
export const SetupNavIcon = make([
  { d: "M10 5H3" }, { d: "M21 5h-7" }, { d: "M14 3v4" }, { d: "M8 12H3" }, { d: "M21 12h-9" }, { d: "M8 10v4" },
  { d: "M12 19H3" }, { d: "M21 19h-5" }, { d: "M16 17v4" },
]);
export const ChannelsNavIcon = make([
  { circle: [12, 12, 2] }, { d: "M16.247 7.761a6 6 0 0 1 0 8.478" }, { d: "M7.753 16.239a6 6 0 0 1 0-8.478" },
  { d: "M19.075 4.933a10 10 0 0 1 0 14.134" }, { d: "M4.925 19.067a10 10 0 0 1 0-14.134" },
]);
export const SettingsNavIcon = make([{ d: SETTINGS_GEAR }, { circle: [12, 12, 3.5] }], true);
