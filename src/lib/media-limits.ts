// Channel-specific media limits. Edit this table to change the rules.
// Values cross-checked against Buffer's help pages (see project notes); where
// Buffer was more permissive than this table, the stricter value here wins.
export const GLOBAL_MAX_FILES = 8;
export const GLOBAL_MAX_BYTES = 20 * 1024 * 1024;
export const USER_QUOTA_BYTES = 100 * 1024 * 1024;
export const COMPRESS_SKIP_BYTES = 500 * 1024;
export const COMPRESS_MAX_SIDE = 1440;
export const COMPRESS_QUALITY = 0.8;

const MB = 1024 * 1024;

export type ChannelMediaRule = {
  maxImages: number;
  maxVideos: number;
  imageMaxBytes: number | null;
  videoMaxBytes: number | null;
};

// Keyed by Buffer's lowercase service name.
export const CHANNEL_MEDIA_RULES: Record<string, ChannelMediaRule> = {
  twitter: { maxImages: 4, maxVideos: 1, imageMaxBytes: 5 * MB, videoMaxBytes: null },
  facebook: { maxImages: 10, maxVideos: 1, imageMaxBytes: null, videoMaxBytes: null },
  threads: { maxImages: 20, maxVideos: 1, imageMaxBytes: null, videoMaxBytes: null },
  pinterest: { maxImages: 1, maxVideos: 1, imageMaxBytes: 10 * MB, videoMaxBytes: null },
  tiktok: { maxImages: 10, maxVideos: 1, imageMaxBytes: null, videoMaxBytes: null },
  mastodon: { maxImages: 4, maxVideos: 1, imageMaxBytes: null, videoMaxBytes: null },
  instagram: { maxImages: 10, maxVideos: 1, imageMaxBytes: 8 * MB, videoMaxBytes: 300 * MB },
};

export type MediaKind = "image" | "video";
export type MediaFileInfo = { name: string; size: number; kind: MediaKind };
export type ChannelInfo = { service: string; name: string };

export type EffectiveMediaLimits = {
  maxImages: number;
  maxVideos: number;
  imageMaxBytes: number;
  videoMaxBytes: number;
  // Channel name responsible for each strictest limit, for messages like "Twitter allows up to 4 images."
  causedBy: { maxImages: string | null; maxVideos: string | null; imageMaxBytes: string | null; videoMaxBytes: string | null };
  // Selected services with no table entry: only the global limits apply to them.
  unchecked: string[];
};

export function effectiveMediaLimits(channels: ChannelInfo[]): EffectiveMediaLimits {
  const result: EffectiveMediaLimits = {
    maxImages: GLOBAL_MAX_FILES,
    maxVideos: 1,
    imageMaxBytes: GLOBAL_MAX_BYTES,
    videoMaxBytes: GLOBAL_MAX_BYTES,
    causedBy: { maxImages: null, maxVideos: null, imageMaxBytes: null, videoMaxBytes: null },
    unchecked: [],
  };
  for (const channel of channels) {
    const rule = CHANNEL_MEDIA_RULES[channel.service.toLowerCase()];
    if (!rule) {
      if (!result.unchecked.includes(channel.name)) result.unchecked.push(channel.name);
      continue;
    }
    if (rule.maxImages < result.maxImages) { result.maxImages = rule.maxImages; result.causedBy.maxImages = channel.name; }
    if (rule.maxVideos <= result.maxVideos) { result.maxVideos = rule.maxVideos; result.causedBy.maxVideos = channel.name; }
    if (rule.imageMaxBytes !== null && rule.imageMaxBytes < result.imageMaxBytes) { result.imageMaxBytes = rule.imageMaxBytes; result.causedBy.imageMaxBytes = channel.name; }
    if (rule.videoMaxBytes !== null && rule.videoMaxBytes < result.videoMaxBytes) { result.videoMaxBytes = rule.videoMaxBytes; result.causedBy.videoMaxBytes = channel.name; }
  }
  return result;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace(/\.0$/, "")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Human-readable summary, e.g. "Twitter: up to 4 images · 5 MB each".
export function describeLimits(limits: EffectiveMediaLimits): string {
  const parts: string[] = [];
  const who = limits.causedBy.maxImages ?? limits.causedBy.maxVideos;
  const prefix = who ? `${who}: ` : "";
  parts.push(`up to ${limits.maxImages} image${limits.maxImages === 1 ? "" : "s"} or ${limits.maxVideos} video`);
  if (limits.imageMaxBytes < GLOBAL_MAX_BYTES) parts.push(`images ${formatBytes(limits.imageMaxBytes)} each`);
  if (limits.videoMaxBytes < GLOBAL_MAX_BYTES) parts.push(`video ${formatBytes(limits.videoMaxBytes)}`);
  return prefix + parts.join(" · ");
}

// Returns a clear error when the files break the limits, otherwise null.
// Never mixes images and video in one post.
export function checkMediaAgainstLimits(files: MediaFileInfo[], limits: EffectiveMediaLimits): string | null {
  if (files.length > GLOBAL_MAX_FILES) return `The maximum is ${GLOBAL_MAX_FILES} files per post.`;
  const images = files.filter((f) => f.kind === "image");
  const videos = files.filter((f) => f.kind === "video");
  if (images.length > 0 && videos.length > 0) return "Images and video can't be mixed in one post. Remove one type.";
  if (images.length > limits.maxImages) {
    const who = limits.causedBy.maxImages;
    return who ? `${who} allows up to ${limits.maxImages} image${limits.maxImages === 1 ? "" : "s"}.` : `The maximum is ${limits.maxImages} images.`;
  }
  if (videos.length > limits.maxVideos) {
    const who = limits.causedBy.maxVideos;
    return who ? `${who} allows only ${limits.maxVideos} video.` : `The maximum is ${limits.maxVideos} video.`;
  }
  for (const file of files) {
    const max = file.kind === "image" ? limits.imageMaxBytes : limits.videoMaxBytes;
    if (file.size > max) {
      const who = file.kind === "image" ? limits.causedBy.imageMaxBytes : limits.causedBy.videoMaxBytes;
      const base = `${file.name} is ${formatBytes(file.size)}. The maximum is ${formatBytes(max)}.`;
      return who ? `${base} (${who})` : base;
    }
  }
  return null;
}
