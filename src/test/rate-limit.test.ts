import { describe, expect, it } from "vitest";
import { rateLimitWaitMessage, remainingWaitSeconds, retryAfterMinutes, waitCountdown } from "@/lib/rate-limit";

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
  it("converts Buffer's documented 753 seconds to 13 minutes", () => {
    expect(retryAfterMinutes(new Headers({ "retry-after": "753" }))).toBe(13);
  });
  it("preserves a 30-second wait below one minute", () => {
    expect(retryAfterMinutes(new Headers({ "retry-after": "30" }))).toBe(0.5);
  });
  it("reads Buffer's RateLimit t parameter in seconds", () => {
    expect(retryAfterMinutes(new Headers({ RateLimit: '"api";r=0;t=753' }))).toBe(13);
  });
  it("uses a few seconds below one minute", () => {
    expect(rateLimitWaitMessage(0.5)).toBe("Try again in a few seconds");
  });
  it("rounds minutes up through 60 minutes", () => {
    expect(rateLimitWaitMessage(1.1)).toBe("Try again in about 2 minutes");
    expect(rateLimitWaitMessage(60)).toBe("Try again in about 60 minutes");
  });
  it("does not show a large minute count above 60 minutes", () => {
    expect(rateLimitWaitMessage(60.1)).toBe("Try again later");
    expect(rateLimitWaitMessage(781)).toBe("Try again later");
  });
  it("keeps the cooldown active until the deadline, rounding seconds up", () => {
    expect(remainingWaitSeconds(30_000, 29_999)).toBe(1);
    expect(remainingWaitSeconds(30_000, 30_000)).toBe(0);
    expect(remainingWaitSeconds(30_000, 31_000)).toBe(0);
    expect(waitCountdown(46_860)).toBe("13:01:00");
  });
});
