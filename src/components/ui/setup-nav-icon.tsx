// sliders horizontal - from AnimateIcons / Lucide (https://animateicons.in)
// Author: Avijit Dey (@avijit07x)
// License: MIT. Source: https://github.com/Avijit07x/animateicons
// Requires: motion, a `cn` helper at @/lib/utils (clsx + tailwind-merge)

import { cn } from "@/lib/utils";
import type { Variants } from "motion/react";
import {
  LazyMotion,
  domMin,
  m,
  useAnimation,
  useReducedMotion,
} from "motion/react";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  type HTMLAttributes,
} from "react";

export interface SlidersHorizontalIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface SlidersHorizontalIconProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  | "color"
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration"
> {
  size?: number;
  duration?: number;
  isAnimated?: boolean;
  color?: string;
}

const SlidersHorizontalIcon = forwardRef<
  SlidersHorizontalIconHandle,
  SlidersHorizontalIconProps
>(
  (
    {
      onMouseEnter,
      onMouseLeave,
      className,
      size = 24,
      duration = 1,
      isAnimated = true,
      color,
      ...props
    },
    ref,
  ) => {
    const controls = useAnimation();
    const reduced = useReducedMotion();
    const isControlled = useRef(false);

    useImperativeHandle(ref, () => {
      isControlled.current = true;
      return {
        startAnimation: () =>
          reduced ? controls.start("normal") : controls.start("animate"),
        stopAnimation: () => controls.start("normal"),
      };
    });

    const handleEnter = useCallback(
      (e?: React.MouseEvent<HTMLDivElement>) => {
        if (!isAnimated || reduced) return;
        if (!isControlled.current) controls.start("animate");
        else onMouseEnter?.(e as React.MouseEvent<HTMLDivElement>);
      },
      [controls, reduced, isAnimated, onMouseEnter],
    );

    const handleLeave = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isControlled.current) controls.start("normal");
        else onMouseLeave?.(e as React.MouseEvent<HTMLDivElement>);
      },
      [controls, onMouseLeave],
    );

    const trackVariants: Variants = {
      normal: { opacity: 1 },
      animate: {
        opacity: [1, 0.6, 1],
        transition: {
          duration: 0.6 * duration,
          ease: "easeInOut",
        },
      },
    };

    const knobVariants: Variants = {
      normal: { x: 0 },
      animate: (i: number) => ({
        x: [0, i * 3, 0],
        transition: {
          duration: 0.7 * duration,
          ease: "easeInOut",
          delay: i * 0.05,
        },
      }),
    };

    return (
      <LazyMotion features={domMin} strict>
        <m.div
          className={cn("inline-flex items-center justify-center", className)}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          {...props}
          style={{ ...(color ? { color } : {}), ...(props.style as object) } as never}
        >
          <m.svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <m.path d="M10 5H3" variants={trackVariants} initial="normal" animate={controls} />
            <m.path d="M21 5h-7" variants={trackVariants} initial="normal" animate={controls} />
            <m.path d="M12 19H3" variants={trackVariants} initial="normal" animate={controls} />
            <m.path d="M21 19h-5" variants={trackVariants} initial="normal" animate={controls} />
            <m.path d="M21 12h-9" variants={trackVariants} initial="normal" animate={controls} />
            <m.path d="M8 12H3" variants={trackVariants} initial="normal" animate={controls} />

            <m.path d="M14 3v4" variants={knobVariants} custom={1} initial="normal" animate={controls} />
            <m.path d="M16 17v4" variants={knobVariants} custom={-1} initial="normal" animate={controls} />
            <m.path d="M8 10v4" variants={knobVariants} custom={1} initial="normal" animate={controls} />
          </m.svg>
        </m.div>
      </LazyMotion>
    );
  },
);

SlidersHorizontalIcon.displayName = "SlidersHorizontalIcon";
export { SlidersHorizontalIcon };

/** Sidebar adapter: accepts lucide-style props and ignores strokeWidth. */
export function SetupNavIcon({ className }: { className?: string; strokeWidth?: number }) {
  return <SlidersHorizontalIcon size={14} className={className} />;
}
