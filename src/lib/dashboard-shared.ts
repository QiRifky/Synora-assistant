import type { BufferChannel, BufferPost, PostStatus } from "@/lib/buffer.functions";

export const DASHBOARD_COOLDOWN_MS = 5 * 60_000;
export const DASHBOARD_STALE_MS = 24 * 60 * 60_000;
export const DASHBOARD_POST_LIMIT = 50;
export type DashboardSnapshot = {
  channels: BufferChannel[];
  counts: Record<PostStatus, { count: number; hasMore: boolean }>;
  posts: (BufferPost & { status: PostStatus })[];
};
export type SavedDashboard = { snapshot: DashboardSnapshot | null; updatedAt: string | null; cooldownUntil: string | null };
export type DashboardRefreshResult = SavedDashboard & { status: "ok" | "busy" | "error" | "reconnect" | "cooldown" };
export function snapshotIsStale(at: string | null, now = Date.now()) {
  return at !== null && now - Date.parse(at) > DASHBOARD_STALE_MS;
}
export function nextScheduledPost(posts: DashboardSnapshot["posts"], now = Date.now()) {
  return posts.filter((p) => p.status === "scheduled" && p.dueAt && Date.parse(p.dueAt) > now)
    .sort((a, b) => Date.parse(a.dueAt ?? "") - Date.parse(b.dueAt ?? ""))[0] ?? null;
}
// Split a hard 50-item budget across organization/status aliases; no pagination.
export function dashboardPostBudgets(organizations: number) {
  const slots = organizations * 3;
  return Array.from({ length: slots }, (_, i) => Math.floor(DASHBOARD_POST_LIMIT / slots) + (i < DASHBOARD_POST_LIMIT % slots ? 1 : 0));
}