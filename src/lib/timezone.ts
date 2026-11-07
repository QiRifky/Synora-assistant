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
