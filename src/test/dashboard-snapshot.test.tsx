import { act, fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DASHBOARD_COOLDOWN_MS, dashboardPostBudgets, nextScheduledPost, snapshotIsStale, type DashboardSnapshot } from "@/lib/dashboard-shared";

const mocks = vi.hoisted(() => ({ read: vi.fn(), activity: vi.fn(), refresh: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/dashboard.functions", () => ({ getDashboardSnapshot: mocks.read, getDashboardData: mocks.activity }));
vi.mock("@/lib/buffer.functions", () => ({ refreshDashboardSnapshot: mocks.refresh }));
import { DashboardOverview } from "@/components/dashboard-overview";
const snapshot: DashboardSnapshot = { channels: [], counts: { draft: { count: 0, hasMore: false }, scheduled: { count: 0, hasMore: false }, sent: { count: 0, hasMore: false } }, posts: [] };
const saved = { snapshot, updatedAt: new Date().toISOString(), cooldownUntil: null };
const mount = () => render(<DashboardOverview banner={(action) => <div>{action}</div>} onOpen={vi.fn()} userId="owner" />);
beforeEach(() => { vi.clearAllMocks(); mocks.read.mockResolvedValue({ ok: true, ...saved }); mocks.activity.mockResolvedValue({ ok: true, activity: [] }); });
afterEach(cleanup);
describe("Dashboard saved-data rules", () => {
  it("makes zero Buffer refresh calls on entry, focus and visibility changes", async () => {
    mount(); await screen.findByText("Nothing scheduled. A quiet week.");
    fireEvent(window, new Event("focus")); fireEvent(document, new Event("visibilitychange"));
    expect(mocks.refresh).toHaveBeenCalledTimes(0);
  });
  it("reads the saved snapshot again on remount without Buffer", async () => {
    const first = mount(); await screen.findByText("Nothing scheduled. A quiet week."); first.unmount();
    mount(); await screen.findByText("Nothing scheduled. A quiet week.");
    expect(mocks.read).toHaveBeenCalledTimes(2); expect(mocks.refresh).toHaveBeenCalledTimes(0);
  });
  it("never issues a duplicate refresh while running", async () => {
    let finish: ((value: unknown) => void) | undefined;
    mocks.refresh.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    mount(); const button = await screen.findByRole("button", { name: "Refresh from Buffer" });
    await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
    fireEvent.click(button); fireEvent.click(button); expect(mocks.refresh).toHaveBeenCalledTimes(1);
    await act(async () => finish?.({ ...saved, status: "ok", cooldownUntil: new Date(Date.now() + DASHBOARD_COOLDOWN_MS).toISOString() }));
    expect(button.hasAttribute("disabled")).toBe(false);
  });
  it("keeps a saved snapshot on 429 and does not automatically retry", async () => {
    mocks.refresh.mockResolvedValue({ ...saved, status: "busy", cooldownUntil: new Date(Date.now()+30_000).toISOString() });
    mount(); const button = await screen.findByRole("button", { name: "Refresh from Buffer" });
    await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false)); fireEvent.click(button);
    await screen.findByText("Buffer is busy right now. Showing your last saved data.");
    expect(screen.getByText("Nothing scheduled. A quiet week.")).toBeTruthy();
    expect(button.hasAttribute("disabled")).toBe(true); expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
  it("activity failure does not prevent snapshot cards", async () => {
    mocks.activity.mockRejectedValue(new Error("unavailable")); mount();
    await screen.findByText("Couldn't load activity right now."); expect(screen.getByText("Nothing scheduled. A quiet week.")).toBeTruthy();
  });
  it("refresh has no wait after success", () => { expect(DASHBOARD_COOLDOWN_MS).toBe(0); });
  it("marks saved data stale only after 24 hours", () => {
    const at = "2026-11-08T00:00:00Z"; const now = Date.parse(at);
    expect(snapshotIsStale(at, now + 86_400_000)).toBe(false);
    expect(snapshotIsStale(at, now + 86_400_001)).toBe(true);
  });
  it("requests no more than 50 posts across organizations and statuses", () => {
    for (const orgs of [1,2,3,20]) expect(dashboardPostBudgets(orgs).reduce((sum,n) => sum+n,0)).toBe(50);
    expect(dashboardPostBudgets(0)).toEqual([]);
  });
  it("selects the next future scheduled post, not a sent or past post", () => {
    const post = { id: "", text: "", channelName: "", service: "", dueAt: null, sentAt: null, createdAt: null };
    expect(nextScheduledPost([{ ...post, id:"past", status:"scheduled", dueAt:"2026-11-07T00:00:00Z" }, { ...post,id:"later",status:"scheduled",dueAt:"2026-11-10T00:00:00Z" }, { ...post,id:"next",status:"scheduled",dueAt:"2026-11-09T00:00:00Z" }, { ...post,id:"sent",status:"sent",dueAt:"2026-11-08T01:00:00Z" }], Date.parse("2026-11-08T00:00:00Z"))?.id).toBe("next");
  });
});