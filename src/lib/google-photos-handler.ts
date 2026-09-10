import { fetchGooglePhotosPage } from "./google-photos";
import { isAllowedGooglePhotosShareUrl, rewriteAlbumMediaUrls } from "./google-photos-share";

function jsonResponse(body: unknown, status = 200, extraHeaders?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, max-age=0",
      ...extraHeaders,
    },
  });
}

export async function handleGooglePhotosRequest(request: Request) {
  const url = new URL(request.url);
  const shareUrl = url.searchParams.get("shareUrl");
  const cursor = url.searchParams.get("cursor");
  const loadedCount = Number.parseInt(url.searchParams.get("loadedCount") || "0", 10);

  if (!shareUrl) {
    return jsonResponse({ error: "缺少 Google Photos 分享链接" }, 400);
  }

  if (!isAllowedGooglePhotosShareUrl(shareUrl)) {
    return jsonResponse({ error: "未允许的相册链接" }, 403);
  }

  try {
    const data = rewriteAlbumMediaUrls(
      await fetchGooglePhotosPage({
        shareUrl,
        cursor,
        loadedCount: Number.isNaN(loadedCount) ? 0 : loadedCount,
      }),
    );

    return jsonResponse(data, 200, {
      "Cache-Control": cursor ? "public, s-maxage=3600" : "public, s-maxage=300",
      "CDN-Cache-Control": cursor ? "public, max-age=3600" : "public, max-age=300",
    });
  } catch (error) {
    return jsonResponse(
      {
        error: "获取相册数据失败",
        message: error instanceof Error ? error.message : "未知错误",
      },
      500,
    );
  }
}
