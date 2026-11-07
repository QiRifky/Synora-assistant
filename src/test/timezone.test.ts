import { describe, expect, it } from "vitest";
import { zonedToDate } from "@/lib/timezone";

describe("zonedToDate", () => {
  it("interprets the picked time in the chosen time zone", () => {
    expect(zonedToDate("2026-11-10T09:00", "Asia/Bangkok")?.toISOString()).toBe("2026-11-10T02:00:00.000Z");
    expect(zonedToDate("2026-07-01T12:00", "America/New_York")?.toISOString()).toBe("2026-07-01T16:00:00.000Z");
  });
  it("rejects unknown zones", () => {
    expect(zonedToDate("2026-11-10T09:00", "Mars/Base")).toBeNull();
  });
});
