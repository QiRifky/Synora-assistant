import { describe, expect, it } from "vitest";
import { addDays, dayKeyInZone, defaultSlot } from "./timezone";

describe("calendar dates", () => {
  it("new post on a future day defaults to 09:00", () => {
    expect(defaultSlot("2026-11-20", "2026-11-07", new Date("2026-11-07T02:00:00Z"), "Asia/Bangkok")).toBe("2026-11-20T09:00");
  });
  it("today after 09:00 uses the next full hour in the user's zone", () => {
    expect(defaultSlot("2026-11-07", "2026-11-07", new Date("2026-11-07T03:30:00Z"), "Asia/Bangkok")).toBe("2026-11-07T11:00");
  });
  it("groups posts by the user's zone day", () => {
    expect(dayKeyInZone(new Date("2026-11-07T20:00:00Z"), "Asia/Bangkok")).toBe("2026-11-08");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
