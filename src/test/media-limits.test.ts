import { describe, expect, it } from "vitest";
import {
  CHANNEL_MEDIA_RULES, GLOBAL_MAX_BYTES, GLOBAL_MAX_FILES, USER_QUOTA_BYTES,
  checkMediaAgainstLimits, describeLimits, effectiveMediaLimits,
} from "@/lib/media-limits";

const MB = 1024 * 1024;
const img = (name: string, size: number) => ({ name, size, kind: "image" as const });
const vid = (name: string, size: number) => ({ name, size, kind: "video" as const });

describe("Channel media limits", () => {
  it("keeps the global outer limits at 8 files and 20 MB, with a 100 MB per-user quota", () => {
    expect(GLOBAL_MAX_FILES).toBe(8);
    expect(GLOBAL_MAX_BYTES).toBe(20 * MB);
    expect(USER_QUOTA_BYTES).toBe(100 * MB);
  });
  it("matches the requested per-channel table", () => {
    expect(CHANNEL_MEDIA_RULES["twitter"]).toMatchObject({ maxImages: 4, maxVideos: 1, imageMaxBytes: 5 * MB });
    expect(CHANNEL_MEDIA_RULES["facebook"]).toMatchObject({ maxImages: 10, maxVideos: 1 });
    expect(CHANNEL_MEDIA_RULES["threads"]).toMatchObject({ maxImages: 20, maxVideos: 1 });
    expect(CHANNEL_MEDIA_RULES["pinterest"]).toMatchObject({ maxImages: 1, maxVideos: 1, imageMaxBytes: 10 * MB });
    expect(CHANNEL_MEDIA_RULES["tiktok"]).toMatchObject({ maxImages: 10, maxVideos: 1 });
    expect(CHANNEL_MEDIA_RULES["mastodon"]).toMatchObject({ maxImages: 4, maxVideos: 1 });
    expect(CHANNEL_MEDIA_RULES["instagram"]).toMatchObject({ maxImages: 10, maxVideos: 1, imageMaxBytes: 8 * MB, videoMaxBytes: 300 * MB });
  });
  it("applies the strictest limit among selected channels and names its cause", () => {
    const limits = effectiveMediaLimits([
      { service: "facebook", name: "My Page" },
      { service: "twitter", name: "My X" },
    ]);
    expect(limits.maxImages).toBe(4);
    expect(limits.causedBy.maxImages).toBe("My X");
    expect(limits.imageMaxBytes).toBe(5 * MB);
    const files = [img("a.png", 100), img("b.png", 100), img("c.png", 100), img("d.png", 100), img("e.png", 100)];
    expect(checkMediaAgainstLimits(files, limits)).toBe("My X allows up to 4 images.");
  });
  it("falls back to global limits and flags unchecked services", () => {
    const limits = effectiveMediaLimits([{ service: "bluesky", name: "Sky" }]);
    expect(limits.maxImages).toBe(8);
    expect(limits.unchecked).toEqual(["Sky"]);
  });
  it("never allows mixing images and video", () => {
    const limits = effectiveMediaLimits([]);
    expect(checkMediaAgainstLimits([img("a.png", 100), vid("b.mp4", 100)], limits)).toContain("can't be mixed");
  });
  it("enforces per-channel image size on the compressed file", () => {
    const limits = effectiveMediaLimits([{ service: "twitter", name: "My X" }]);
    expect(checkMediaAgainstLimits([img("big.png", 6 * MB)], limits)).toContain("The maximum is 5 MB");
    expect(checkMediaAgainstLimits([img("ok.png", 4 * MB)], limits)).toBeNull();
  });
  it("caps video count at one per channel", () => {
    const limits = effectiveMediaLimits([{ service: "tiktok", name: "TT" }]);
    expect(checkMediaAgainstLimits([vid("a.mp4", 100), vid("b.mp4", 100)], limits)).toBe("TT allows only 1 video.");
  });
  it("describes the active limits for the media area", () => {
    expect(describeLimits(effectiveMediaLimits([{ service: "twitter", name: "Twitter" }]))).toBe("Twitter: up to 4 images or 1 video · images 5 MB each");
  });
});
