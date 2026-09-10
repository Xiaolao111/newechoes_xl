import { isAllowedGoogleMediaUrl, readGoogleMediaUrlParam } from "../../src/lib/google-photos-share";

async function proxyGoogleMedia(request: Request) {
  const mediaUrl = readGoogleMediaUrlParam(new URL(request.url));

  if (!mediaUrl || !isAllowedGoogleMediaUrl(mediaUrl)) {
    return new Response("Forbidden", { status: 403 });
  }

  const upstream = await fetch(mediaUrl, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
      referer: "https://photos.google.com/",
      accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
    redirect: "follow",
  });

  if (!upstream.ok) {
    return new Response("Bad gateway", { status: 502 });
  }

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("Content-Type") || "application/octet-stream");
  headers.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
  headers.set("Access-Control-Allow-Origin", "*");

  return new Response(upstream.body, {
    status: 200,
    headers,
  });
}

export const onRequestGet = async (context: { request: Request }) => {
  return proxyGoogleMedia(context.request);
};
