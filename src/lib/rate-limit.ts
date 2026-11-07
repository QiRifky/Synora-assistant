/**
 * Minutes until Buffer allows requests again, from Retry-After / rate-limit reset
 * headers or a GraphQL extension value. Returns null when Buffer gives no hint.
 */
export function retryAfterMinutes(headers: Headers, extensionValue?: unknown, now = Date.now()): number | null {
  const toMin = (ms: number) => (Number.isFinite(ms) && ms > 0 ? Math.max(1, Math.ceil(ms / 60_000)) : null);
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
  if (typeof extensionValue === "number") return toMin(extensionValue * 1000);
  return null;
}
