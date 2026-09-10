import type { APIRoute } from "astro";
import { installGooglePhotosNodeProxy } from "@/lib/google-photos-proxy";
import {
  isAllowedGoogleMediaUrl,
  readGoogleMediaUrlParam,
  resolveGooglePhotosMediaUpstream,
} from "@/lib/google-photos-share";

installGooglePhotosNodeProxy();

export const prerender = false;

async function proxyResponse(response: Response) {
  const headers = new Headers();
  headers.set("Content-Type", response.headers.get("Content-Type") || "application/octet-stream");
  headers.set("Cache-Control", response.headers.get("Cache-Control") || "public, max-age=86400");

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

export const GET: APIRoute = async ({ request }) => {
  const mediaUrl = readGoogleMediaUrlParam(new URL(request.url));

  if (!mediaUrl || !isAllowedGoogleMediaUrl(mediaUrl)) {
    return new Response("Forbidden", { status: 403 });
  }

  const upstreamBase = process.env.GOOGLE_PHOTOS_API_BASE?.trim();

  try {
    if (upstreamBase) {
      const target = resolveGooglePhotosMediaUpstream(upstreamBase, mediaUrl);
      return proxyResponse(await fetch(target));
    }

    const response = await fetch(mediaUrl, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
        referer: "https://photos.google.com/",
        accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return new Response("Bad gateway", { status: 502 });
    }

    return proxyResponse(response);
  } catch {
    return new Response("Bad gateway", { status: 502 });
  }
};
