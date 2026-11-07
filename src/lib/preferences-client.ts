import { getPreferences, type Preferences } from "@/lib/settings.functions";

// One shared fetch per page session; refreshed after Settings saves.
let pending: Promise<Preferences | null> | null = null;

export function loadPreferences(): Promise<Preferences | null> {
  pending ??= getPreferences().then((r) => (r.ok ? r.prefs : null)).catch(() => null);
  return pending;
}

export function setCachedPreferences(p: Preferences) {
  pending = Promise.resolve(p);
}
