import { z } from "zod";

import { GLOBAL_MAX_BYTES, GLOBAL_MAX_FILES } from "@/lib/media-limits";

export const MEDIA_BUCKET = "post-media";
export const MAX_MEDIA_BYTES = GLOBAL_MAX_BYTES;
export const MAX_MEDIA_FILES = GLOBAL_MAX_FILES;
export const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4"] as const;
export const mediaInput = z.array(z.object({
  path: z.string().max(200).regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(jpg|png|webp|mp4)$/i),
  type: z.enum(["image", "video"]),
})).max(MAX_MEDIA_FILES).default([]);
export type MediaAttachment = { path: string; type: "image" | "video" };

export function validateMedia(file: { name: string; size: number; type: string }, imagesOnly = false): string | null {
  if (file.size > MAX_MEDIA_BYTES) return `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB. The maximum is 20 MB.`;
  const extensions: Record<string, RegExp> = { "image/jpeg": /\.jpe?g$/i, "image/png": /\.png$/i, "image/webp": /\.webp$/i, "video/mp4": /\.mp4$/i };
  if (!extensions[file.type]?.test(file.name) || (imagesOnly && file.type === "video/mp4")) {
    return `${file.name}: ${imagesOnly ? "Ideas support JPG, PNG and WebP images only; Buffer's public ideas API does not support video." : "Only JPG, PNG, WebP images and MP4 video are supported."}`;
  }
  if (file.size === 0) return `${file.name} is empty.`;
  return null;
}

export function validateMediaCount(count: number): string | null {
  return count > MAX_MEDIA_FILES ? `The maximum is ${MAX_MEDIA_FILES} files per post.` : null;
}

export function ownsMedia(path: string, userId: string): boolean {
  return path.startsWith(`${userId}/`) && mediaInput.safeParse([{ path, type: "image" }]).success;
}

export function resizeDimensions(width: number, height: number, maxWidth: number): { width: number; height: number } {
  const scale = maxWidth > 0 ? Math.min(1, maxWidth / width) : 1;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function postAssets(media: { type: "image" | "video"; url: string }[]) {
  return media.map((m) => m.type === "image" ? { image: { url: m.url } } : { video: { url: m.url } });
}