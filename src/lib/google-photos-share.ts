import { GOOGLE_PHOTOS_WORKER_ORIGIN } from "../consts";

function normalizePath(pathname: string) {
  return pathname.replace(/\/+$/, "") || "/";
}

export function isAllowedGooglePhotosShareUrl(shareUrl: string) {
  let incoming: URL;
  try {
    incoming = new URL(shareUrl);
  } catch {
    return false;
  }

  const path = normalizePath(incoming.pathname);

  if (incoming.hostname === "photos.app.goo.gl") {
    return path.length > 1;
  }

  if (incoming.hostname === "photos.google.com") {
    return path.startsWith("/share") || path.startsWith("/album");
  }

  return false;
}

export function resolveGooglePhotosUpstream(base: string, search: string) {
  const trimmed = base.trim().replace(/\/+$/, "");
  const target = trimmed.includes("/api/google-photos")
    ? new URL(trimmed)
    : new URL("/api/google-photos", `${trimmed}/`);
  target.search = search;
  return target;
}

export function isAllowedGoogleMediaUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".googleusercontent.com");
  } catch {
    return false;
  }
}

function toBase64Url(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

export function readGoogleMediaUrlParam(requestUrl: URL) {
  const encoded = requestUrl.searchParams.get("u");
  if (encoded) {
    try {
      return fromBase64Url(encoded);
    } catch {
      return null;
    }
  }

  return requestUrl.searchParams.get("url");
}

export function rewriteGoogleMediaUrl(url: string, origin = GOOGLE_PHOTOS_WORKER_ORIGIN) {
  return `${origin.replace(/\/+$/, "")}/api/google-photos-media?u=${toBase64Url(url)}`;
}

const MEDIA_KEYS = ["thumbUrl", "displayUrl", "previewUrl", "originalLikeUrl", "videoUrl"] as const;

export function rewriteAlbumMediaUrls<T extends { album?: { coverUrl?: string | null }; photos: Array<Record<string, unknown>> }>(
  data: T,
): T {
  const rewrite = (value: unknown) =>
    typeof value === "string" && isAllowedGoogleMediaUrl(value) ? rewriteGoogleMediaUrl(value) : value;

  return {
    ...data,
    album: data.album
      ? {
          ...data.album,
          coverUrl: rewrite(data.album.coverUrl) as string | null | undefined,
        }
      : data.album,
    photos: data.photos.map((photo) => {
      const next = { ...photo };
      for (const key of MEDIA_KEYS) {
        next[key] = rewrite(next[key]);
      }
      return next;
    }),
  };
}

export function resolveGooglePhotosMediaUpstream(base: string, mediaUrl: string) {
  const trimmed = base.trim().replace(/\/+$/, "");
  const origin = trimmed.replace(/\/api\/google-photos(?:-media)?$/, "");
  return new URL(rewriteGoogleMediaUrl(mediaUrl, origin));
}
