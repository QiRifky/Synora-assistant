import { describe, expect, it } from "vitest";
import { MAX_MEDIA_BYTES, validateMedia, validateMediaCount, ownsMedia, resizeDimensions, postAssets, mediaInput } from "@/lib/media";

describe("Media attachment rules", () => {
  it("accepts exactly 20 MB but rejects larger images and videos with name and size", () => {
    expect(MAX_MEDIA_BYTES).toBe(20971520);
    for (const [type, name] of [["image/png", "photo.png"], ["video/mp4", "clip.mp4"]]) {
      expect(validateMedia({ name: name ?? "", type: type ?? "", size: 20971520 })).toBeNull();
      expect(validateMedia({ name: name ?? "", type: type ?? "", size: Math.round(24.2 * 1048576) })).toBe(`${name} is 24.2 MB. The maximum is 20 MB.`);
    }
  });
  it("accepts only JPG PNG WebP MP4 and rejects mismatched extensions", () => {
    for (const [type, name] of [["image/jpeg", "a.jpg"], ["image/png", "a.png"], ["image/webp", "a.webp"], ["video/mp4", "a.mp4"]]) expect(validateMedia({ name: name ?? "", type: type ?? "", size: 100 })).toBeNull();
    expect(validateMedia({ name: "a.gif", type: "image/gif", size: 100 })).not.toBeNull();
    expect(validateMedia({ name: "a.exe", type: "image/png", size: 100 })).not.toBeNull();
  });
  it("limits attachments to eight in browser and server input", () => {
    expect(validateMediaCount(8)).toBeNull();
    expect(validateMediaCount(9)).not.toBeNull();
    const item = { path: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.png", type: "image" };
    expect(mediaInput.safeParse(Array(8).fill(item)).success).toBe(true);
    expect(mediaInput.safeParse(Array(9).fill(item)).success).toBe(false);
  });
  it("rejects another user's media and traversal paths", () => {
    const owner = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const path = `${owner}/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.png`;
    expect(ownsMedia(path, owner)).toBe(true);
    expect(ownsMedia(path, "cccccccc-cccc-cccc-cccc-cccccccccccc")).toBe(false);
    expect(ownsMedia(`${owner}/../other.png`, owner)).toBe(false);
  });
  it("limits resized width to 1080 or 1440 without upscaling and preserves original", () => {
    expect(resizeDimensions(2160, 1080, 1080)).toEqual({ width: 1080, height: 540 });
    expect(resizeDimensions(2880, 1440, 1440)).toEqual({ width: 1440, height: 720 });
    expect(resizeDimensions(2160, 1080, 0)).toEqual({ width: 2160, height: 1080 });
    expect(resizeDimensions(500, 250, 1080)).toEqual({ width: 500, height: 250 });
  });
  it("sends documented image and video assets", () => {
    expect(postAssets([{ type: "image", url: "https://example.org/a.png" }, { type: "video", url: "https://example.org/a.mp4" }])).toEqual([{ image: { url: "https://example.org/a.png" } }, { video: { url: "https://example.org/a.mp4" } }]);
  });
  it("rejects video for ideas", () => {
    expect(validateMedia({ name: "a.mp4", type: "video/mp4", size: 100 }, true)).not.toBeNull();
    expect(validateMedia({ name: "a.png", type: "image/png", size: 100 }, true)).toBeNull();
  });
});
