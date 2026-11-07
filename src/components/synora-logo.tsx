import synoraLogo from "@/assets/synora-logo.png.asset.json";
import { cn } from "@/lib/utils";

/**
 * The single Synora wordmark used across the product.
 * Defaults to the landing navigation size at full opacity.
 */
export function SynoraLogo({ className }: { className?: string }) {
  return (
    <img
      src={synoraLogo.url}
      alt="Synora"
      className={cn("h-6 w-auto max-w-full shrink-0", className)}
    />
  );
}
