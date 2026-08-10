import type { APIRoute } from "astro";
import http from "node:http";
import https from "node:https";

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });

const isDirectMediaUrl = (value: string) => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    if (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") {
      return false;
    }
    if (parsed.searchParams.get("type") === "url") return false;
    if (
      parsed.pathname.includes("/api") &&
      parsed.searchParams.has("server")
    ) {
      return false;
    }
    // Reject bare CDN roots like https://aqqmusic.tc.qq.com/
    if (parsed.pathname === "/" || parsed.pathname === "") return false;
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const extractUrl = (payload: unknown): string => {
  if (typeof payload === "string") {
    const value = payload.trim();
    if (isDirectMediaUrl(value)) return value;
    if (value.startsWith("{") || value.startsWith("[")) {
      try {
        return extractUrl(JSON.parse(value));
      } catch {
        return "";
      }
    }
    return "";
  }
  if (!payload || typeof payload !== "object") return "";
  const root = payload as Record<string, unknown>;
  for (const candidate of [root.url, root.data]) {
    if (typeof candidate === "string" && isDirectMediaUrl(candidate.trim())) {
      return candidate.trim();
    }
  }
  if (root.data && typeof root.data === "object") {
    const data = root.data as Record<string, unknown>;
    if (typeof data.url === "string" && isDirectMediaUrl(data.url.trim())) {
      return data.url.trim();
    }
  }
  return "";
};

/**
 * Use Node http(s) instead of fetch().
 * Undici fetch either follows the 302 (CDN then returns 403) or, with
 * redirect:"manual", hides cross-origin Location as an opaque redirect.
 */
const requestOnce = (
  target: string,
  authToken?: string,
): Promise<{ status: number; location: string; body: string }> =>
  new Promise((resolve, reject) => {
    const parsed = new URL(target);
    const lib = parsed.protocol === "https:" ? https : http;
    const headers: Record<string, string> = {
      Accept: "*/*",
      "User-Agent": "xiaolao-blog-music/1.0",
    };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method: "GET",
        headers,
        timeout: 8_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            location: String(res.headers.location ?? "").trim(),
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });

export const GET: APIRoute = async ({ url }) => {
  const songmid = url.searchParams.get("id")?.trim();
  if (!songmid) {
    return json({ error: "missing id", url: "" }, 400);
  }

  const apiBase = process.env.QQ_MUSIC_API_BASE?.replace(/\/+$/, "");
  const authToken = process.env.QQ_MUSIC_API_TOKEN?.trim() || undefined;
  if (!apiBase) {
    return json(
      {
        error: "QQ_MUSIC_API_BASE_not_configured",
        url: "",
        hint: "服务器未配置 QQ_MUSIC_API_BASE",
      },
      503,
    );
  }

  try {
    const endpoint = new URL(`${apiBase}/api`);
    endpoint.searchParams.set("server", "tencent");
    endpoint.searchParams.set("type", "url");
    endpoint.searchParams.set("id", songmid);
    if (authToken) endpoint.searchParams.set("auth", authToken);

    const response = await requestOnce(endpoint.toString(), authToken);

    if (response.status >= 300 && response.status < 400) {
      if (isDirectMediaUrl(response.location)) {
        return json({ id: songmid, url: response.location });
      }
      return json(
        {
          error: "invalid_redirect",
          url: "",
          hint:
            response.location
              ? "自建 API 跳转地址无效（Cookie 可能过期或无 VIP 播放权）"
              : "自建 API 返回了空跳转地址",
          location: response.location || undefined,
        },
        502,
      );
    }

    if (response.status < 200 || response.status >= 300) {
      const hint =
        response.status === 403
          ? "Meting-API 返回 403：检查 auth token，或确认 2500 服务正常"
          : response.status === 401
            ? "Meting-API 未授权：请配置 QQ_MUSIC_API_TOKEN"
            : `自建 API 返回 ${response.status}`;
      return json(
        { error: `upstream_${response.status}`, url: "", hint },
        502,
      );
    }

    let playUrl = "";
    const text = response.body.trim();
    try {
      playUrl = extractUrl(JSON.parse(text));
    } catch {
      playUrl = isDirectMediaUrl(text) ? text : "";
    }

    if (!playUrl) {
      return json(
        {
          error: "empty_play_url",
          hint: "Cookie 可能过期、掉 VIP，或该曲无播放权限；请到 Meting 后台更新 QQ Cookie",
          url: "",
        },
        502,
      );
    }

    return json({ id: songmid, url: playUrl });
  } catch (error) {
    console.error("Play URL request failed:", error);
    return json(
      {
        error: "play_url_fetch_failed",
        url: "",
        hint: "无法连接自建 QQ Music API，请检查 QQ_MUSIC_API_BASE 与 2500 端口服务",
      },
      502,
    );
  }
};
