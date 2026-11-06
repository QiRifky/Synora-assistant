export const CLEANUP_SCHEDULE = "0 * * * *";
export const MEDIA_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const SENT_MEDIA_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function eligibleForCleanup(createdAt: string, linked: boolean, now: number) {
  const created = Date.parse(createdAt);
  return !linked && Number.isFinite(created) && created < now - MEDIA_MAX_AGE_MS;
}

// Files attached to posts already sent in Buffer ("publish" references) become
// eligible once the save is more than 7 days old.
export function eligibleSentMedia(createdAt: string, now: number) {
  const created = Date.parse(createdAt);
  return Number.isFinite(created) && created < now - SENT_MEDIA_MAX_AGE_MS;
}

export async function deleteClaimedMedia(paths: string[], remove: (paths: string[]) => Promise<boolean>) {
  if (!paths.length) return 0;
  return await remove(paths) ? paths.length : 0;
}
