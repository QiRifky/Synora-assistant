import { describe, expect, it, vi } from "vitest";
import { CLEANUP_SCHEDULE, eligibleForCleanup, deleteClaimedMedia } from "@/lib/media-cleanup";

describe("Hourly media cleanup", () => {
  const now = Date.parse("2026-11-07T12:00:00Z");
  it("runs every hour", () => { expect(CLEANUP_SCHEDULE).toBe("0 * * * *"); });
  it("deletes only files strictly older than 24 hours", () => {
    expect(eligibleForCleanup("2026-11-06T11:59:59Z", false, now)).toBe(true);
    expect(eligibleForCleanup("2026-11-06T12:00:00Z", false, now)).toBe(false);
    expect(eligibleForCleanup("2026-11-07T11:00:00Z", false, now)).toBe(false);
  });
  it.each(["draft", "idea", "queue", "schedule"])("never deletes files linked to a saved %s", () => {
    expect(eligibleForCleanup("2026-10-01T00:00:00Z", true, now)).toBe(false);
  });
  it("fails safe when timestamps are invalid", () => { expect(eligibleForCleanup("bad", false, now)).toBe(false); });
  it("reports only successfully deleted files", async () => {
    expect(await deleteClaimedMedia(["one", "two"], async () => true)).toBe(2);
    expect(await deleteClaimedMedia(["one"], async () => false)).toBe(0);
    const remove = vi.fn();
    expect(await deleteClaimedMedia([], remove)).toBe(0);
    expect(remove).not.toHaveBeenCalled();
  });
});