/**
 * Minutes until Buffer allows requests again, from Retry-After / rate-limit reset
 * headers or a GraphQL extension value. Returns null when Buffer gives no hint.
 */
export function retryAfterMinutes(headers: Headers, extensionValue?: unknown, now = Date.now()): number | null {
  // Preserve sub-minute waits for the countdown; round longer waits up.
  const toMin = (ms: number) => (Number.isFinite(ms) && ms > 0 ? (ms < 60_000 ? ms / 60_000 : Math.ceil(ms / 60_000)) : null);
  const ra = headers.get("retry-after");
  if (ra) {
    const secs = Number(ra);
    if (Number.isFinite(secs)) return toMin(secs * 1000);
    const date = Date.parse(ra);
    if (!Number.isNaN(date)) return toMin(date - now);
  }
  const reset = headers.get("x-ratelimit-reset") ?? headers.get("ratelimit-reset");
  if (reset) {
    const n = Number(reset);
    if (Number.isFinite(n)) {
      // Large values are epoch seconds; small ones are seconds remaining.
      return toMin(n > 1_000_000_000 ? n * 1000 - now : n * 1000);
    }
  }
  // Buffer documents RateLimit's t parameter as seconds until reset.
  const windows = headers.get("ratelimit")?.matchAll(/\bt\s*=\s*(\d+(?:\.\d+)?)/g);
  if (windows) {
    const seconds = Array.from(windows, (match) => Number(match[1]));
    if (seconds.length) return toMin(Math.max(...seconds) * 1000);
  }
  if (typeof extensionValue === "number") return toMin(extensionValue * 1000);
  return null;
}

export function rateLimitWaitMessage(minutes: number): string {
  if (minutes < 1) return "Try again in a few seconds";
  if (minutes > 60) return "Try again later";
  const rounded = Math.ceil(minutes);
  return `Try again in about ${rounded} minute${rounded === 1 ? "" : "s"}`;
}

export function remainingWaitSeconds(deadline: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function waitCountdown(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${minutes}:${String(secs).padStart(2, "0")}`;
}
