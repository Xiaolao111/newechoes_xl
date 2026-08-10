import type { APIRoute } from "astro";
import { QQ_MUSIC_PLAYLIST_ID } from "@/lib/music/playlist";

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, max-age=3600",
    },
  });

const extractLrc = (payload: unknown): string => {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return "";
  const root = payload as Record<string, unknown>;
  if (typeof root.lyric === "string") return root.lyric;
  if (typeof root.lrc === "string") return root.lrc;
  if (typeof root.data === "string") return root.data;
  if (root.data && typeof root.data === "object") {
    const data = root.data as Record<string, unknown>;
    if (typeof data.lyric === "string") return data.lyric;
    if (typeof data.lrc === "string") return data.lrc;
  }
  return "";
};

const fetchViaSelfHosted = async (
  songmid: string,
  apiBase: string,
  authToken?: string,
): Promise<string> => {
  const endpoint = new URL(`${apiBase}/api`);
  endpoint.searchParams.set("server", "tencent");
  endpoint.searchParams.set("type", "lrc");
  endpoint.searchParams.set("id", songmid);
  if (authToken) endpoint.searchParams.set("auth", authToken);

  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(8_000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return "";
  return extractLrc(await response.json());
};

const fetchOfficialLyric = async (songmid: string): Promise<string> => {
  const endpoint = new URL(
    "https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg",
  );
  endpoint.searchParams.set("songmid", songmid);
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("nobase64", "1");
  endpoint.searchParams.set("g_tk", "5381");
  endpoint.searchParams.set("loginUin", "0");
  endpoint.searchParams.set("hostUin", "0");
  endpoint.searchParams.set("inCharset", "utf8");
  endpoint.searchParams.set("outCharset", "utf-8");
  endpoint.searchParams.set("platform", "yqq.json");
  endpoint.searchParams.set("needNewCode", "0");

  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(8_000),
    headers: {
      Accept: "application/json",
      Referer: "https://y.qq.com/portal/player.html",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });
  if (!response.ok) return "";
  const payload = (await response.json()) as {
    code?: number;
    lyric?: string;
  };
  if (payload.code !== 0 || typeof payload.lyric !== "string") return "";
  return payload.lyric;
};

export const GET: APIRoute = async ({ url }) => {
  const songmid = url.searchParams.get("id")?.trim();
  if (!songmid) {
    return json({ error: "missing id", lyric: "" }, 400);
  }

  const apiBase = process.env.QQ_MUSIC_API_BASE?.replace(/\/+$/, "");
  const authToken = process.env.QQ_MUSIC_API_TOKEN;

  try {
    let lyric = "";
    if (apiBase) {
      lyric = await fetchViaSelfHosted(songmid, apiBase, authToken);
    }
    if (!lyric) {
      lyric = await fetchOfficialLyric(songmid);
    }

    return json({
      id: songmid,
      playlistId: QQ_MUSIC_PLAYLIST_ID,
      lyric,
    });
  } catch (error) {
    console.error("Lyric request failed:", error);
    return json({ id: songmid, lyric: "", error: "lyric_fetch_failed" }, 502);
  }
};
