import { describe, expect, it } from "vitest";
import { retryAfterMinutes } from "@/lib/rate-limit";

describe("retryAfterMinutes", () => {
  it("reads Retry-After seconds, rounding up to minutes", () => {
    expect(retryAfterMinutes(new Headers({ "retry-after": "150" }))).toBe(3);
  });
  it("reads an epoch reset header", () => {
    const now = 1_800_000_000_000;
    expect(retryAfterMinutes(new Headers({ "x-ratelimit-reset": String(now / 1000 + 600) }), undefined, now)).toBe(10);
  });
  it("returns null when Buffer gives no hint", () => {
    expect(retryAfterMinutes(new Headers())).toBeNull();
  });
});
