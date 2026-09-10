import type { APIRoute } from "astro";
import { handleGooglePhotosRequest } from "@/lib/google-photos-handler";
import { installGooglePhotosNodeProxy } from "@/lib/google-photos-proxy";
import { resolveGooglePhotosUpstream } from "@/lib/google-photos-share";

installGooglePhotosNodeProxy();

export const prerender = false;

async function proxyToUpstream(request: Request, upstreamBase: string) {
  const incoming = new URL(request.url);
  const target = resolveGooglePhotosUpstream(upstreamBase, incoming.search);

  const response = await fetch(target, {
    headers: {
      accept: "application/json",
    },
  });

  return new Response(await response.arrayBuffer(), {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "application/json",
      "Cache-Control": response.headers.get("Cache-Control") || "no-store, max-age=0",
    },
  });
}

export const GET: APIRoute = async ({ request }) => {
  const upstream = process.env.GOOGLE_PHOTOS_API_BASE?.trim();

  if (upstream) {
    try {
      return await proxyToUpstream(request, upstream);
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "获取相册数据失败",
          message: error instanceof Error ? error.message : "无法连接海外相册接口",
        }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store, max-age=0",
          },
        },
      );
    }
  }

  return handleGooglePhotosRequest(request);
};
