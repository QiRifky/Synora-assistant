/** Browser-safe time zone helpers for the scheduler. */

export function browserTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
}

export function isValidTimeZone(tz: string): boolean {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

export function listTimeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  const list = intl.supportedValuesOf?.("timeZone") ?? [];
  return list.length ? list : ["UTC", browserTimeZone()];
}

/** Offset (ms) of `tz` from UTC at instant `at`. */
function offsetMs(tz: string, at: number): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(at)).map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts["year"]!, +parts["month"]! - 1, +parts["day"]!, +parts["hour"]!, +parts["minute"]!, +parts["second"]!);
  return asUtc - Math.floor(at / 1000) * 1000;
}

/** Converts a `YYYY-MM-DDTHH:mm` wall-clock value in `tz` to a Date. Null when invalid. */
export function zonedToDate(local: string, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m || !isValidTimeZone(tz)) return null;
  const wall = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!);
  let t = wall - offsetMs(tz, wall);
  t = wall - offsetMs(tz, t); // second pass handles DST boundaries
  return new Date(t);
}

export function formatInZone(d: Date, tz: string): string {
  return d.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short", timeZone: tz });
}

/** Calendar date key (YYYY-MM-DD) of instant `d` in `tz`. */
export function dayKeyInZone(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Adds `n` days to a YYYY-MM-DD key (pure calendar math). */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10);
}

/** Default schedule value for a day: 09:00, or the next full hour when that has passed today. */
export function defaultSlot(key: string, todayKey: string, now: Date, tz: string): string {
  if (key !== todayKey) return `${key}T09:00`;
  const hour = +new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(now);
  if (hour < 9) return `${key}T09:00`;
  return hour >= 23 ? `${addDays(key, 1)}T09:00` : `${key}T${String(hour + 1).padStart(2, "0")}:00`;
}
