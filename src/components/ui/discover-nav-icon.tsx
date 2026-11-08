import type { SVGProps } from "react";

/** Animated compass (draws in on mount). */
export function CompassIcon({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={size} height={size} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <defs>
        <mask id="synora-compass-mask">
          <path fill="none" stroke="#fff" strokeDasharray="60" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3c4.97 0 9 4.03 9 9c0 4.97 -4.03 9 -9 9c-4.97 0 -9 -4.03 -9 -9c0 -4.97 4.03 -9 9 -9Z">
            <animate fill="freeze" attributeName="stroke-dashoffset" dur="0.6s" values="60;0" />
          </path>
          <path fill="#fff" d="M11 11l1 1l1 1l-1 -1Z" transform="rotate(-180 12 12)">
            <animate fill="freeze" attributeName="d" begin="0.6s" dur="0.3s" to="M10.2 10.2l6.8 -3.2l-3.2 6.8l-6.8 3.2Z" />
            <animateTransform fill="freeze" attributeName="transform" begin="0.6s" dur="0.5s" type="rotate" values="-180 12 12;0 12 12" />
          </path>
          <circle cx="12" cy="12" r="0">
            <animate fill="freeze" attributeName="r" begin="0.6s" dur="0.3s" to="1" />
          </circle>
        </mask>
      </defs>
      <path fill="currentColor" d="M0 0h24v24H0z" mask="url(#synora-compass-mask)" />
    </svg>
  );
}

export function DiscoverNavIcon({ className }: { className?: string; strokeWidth?: number }) {
  return <CompassIcon size={16} className={className} />;
}
