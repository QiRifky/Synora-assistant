import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function MenuToggleIcon({ open, duration = 300, className, ...props }: ComponentProps<"svg"> & { open: boolean; duration?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" className={cn("size-5", className)} {...props}>
      <path d={open ? "M6 6L18 18M6 18L18 6" : "M4 8H20M4 16H20"} />
    </svg>
  );
}