import type { APIRoute } from "astro";
import {
  PLACEHOLDER_PLAYLIST,
  QQ_MUSIC_PLAYLIST_ID,
  QQ_MUSIC_SHARE_URL,
  type MusicPlaylist,
  type MusicTrack,
} from "@/lib/music/playlist";

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // Playlist metadata can cache briefly; play URLs are fetched separately.
      "Cache-Control": "private, max-age=60",
    },
  });

const albumCover = (albummid: string) =>
  `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albummid}.jpg`;

const songPage = (songmid: string) =>
  `https://y.qq.com/n/ryqq/songDetail/${songmid}`;

const artistName = (value: unknown) => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((artist) =>
        typeof artist === "string"
          ? artist
          : ((artist as { name?: string; title?: string })?.name ??
            (artist as { title?: string })?.title ??
            ""),
      )
      .filter(Boolean)
      .join(" / ");
  }
  return "";
};

/** Meting often returns its own /api?type=url proxy, not a CDN stream. */
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
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const normalizeExternalPlaylist = (
  payload: unknown,
  playlistId: string,
): MusicPlaylist | null => {
  const root = payload as Record<string, unknown>;
  const possibleData = root?.data ?? root?.playlist ?? payload;
  const nested = possibleData as Record<string, unknown>;
  const rawTracks = Array.isArray(possibleData)
    ? possibleData
    : Array.isArray(nested?.tracks)
      ? nested.tracks
      : Array.isArray(nested?.songs)
        ? nested.songs
        : [];

  const tracks = rawTracks
    .map((raw, index): MusicTrack | null => {
      const item = raw as Record<string, unknown>;
      const title = String(item.title ?? item.name ?? "").trim();
      const rawAudioUrl = String(
        item.url ?? item.audioUrl ?? item.playUrl ?? "",
      ).trim();
      const audioUrl = isDirectMediaUrl(rawAudioUrl) ? rawAudioUrl : "";
      if (!title) return null;

      const album = (item.album ?? {}) as Record<string, unknown>;
      const id = String(
        item.id ?? item.songmid ?? item.mid ?? `${playlistId}-${index}`,
      );
      return {
        id,
        title,
        artist:
          artistName(item.author ?? item.artist ?? item.singer) || "QQ 音乐",
        cover: String(
          item.pic ??
            item.cover ??
            item.image ??
            album.picUrl ??
            PLACEHOLDER_PLAYLIST.tracks[
              index % PLACEHOLDER_PLAYLIST.tracks.length
            ]!.cover,
        ),
        audioUrl,
        sourceUrl:
          typeof item.link === "string" ? item.link : songPage(id),
      };
    })
    .filter((track): track is MusicTrack => track !== null);

  if (!tracks.length) return null;
  return {
    id: playlistId,
    title: String(nested?.name ?? nested?.title ?? "我的 QQ 音乐歌单"),
    description: "数据来自自建 QQ Music API",
    sourceUrl: `https://y.qq.com/n/ryqq/playlist/${playlistId}`,
    tracks,
  };
};

const fetchOfficialPlaylist = async (
  playlistId: string,
): Promise<MusicPlaylist | null> => {
  const endpoint = new URL(
    "https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg",
  );
  endpoint.searchParams.set("type", "1");
  endpoint.searchParams.set("json", "1");
  endpoint.searchParams.set("utf8", "1");
  endpoint.searchParams.set("onlysong", "0");
  endpoint.searchParams.set("disstid", playlistId);
  endpoint.searchParams.set("format", "json");

  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(10_000),
    headers: {
      Accept: "application/json",
      Referer: `https://y.qq.com/n/ryqq/playlist/${playlistId}`,
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });
  if (!response.ok) {
    throw new Error(`QQ playlist API returned ${response.status}`);
  }

  const payload = (await response.json()) as {
    code?: number;
    cdlist?: Array<{
      dissname?: string;
      desc?: string;
      logo?: string;
      songlist?: Array<{
        songmid?: string;
        songname?: string;
        albummid?: string;
        album?: { mid?: string };
        singer?: Array<{ name?: string; title?: string }>;
      }>;
    }>;
  };

  const cd = payload.cdlist?.[0];
  const songs = cd?.songlist ?? [];
  if (!songs.length) return null;

  const tracks: MusicTrack[] = songs
    .map((song): MusicTrack | null => {
      const songmid = String(song.songmid ?? "").trim();
      const title = String(song.songname ?? "").trim();
      if (!songmid || !title) return null;
      const albummid = String(song.albummid ?? song.album?.mid ?? "").trim();
      return {
        id: songmid,
        title: title.replace(/\s*\([^)]*广告曲[^)]*\)/g, "").trim() || title,
        artist: artistName(song.singer) || "QQ 音乐",
        cover: albummid
          ? albumCover(albummid)
          : PLACEHOLDER_PLAYLIST.tracks[0]!.cover,
        audioUrl: "",
        sourceUrl: songPage(songmid),
      };
    })
    .filter((track): track is MusicTrack => track !== null);

  if (!tracks.length) return null;

  return {
    id: playlistId,
    title: cd?.dissname || "博客歌单",
    description: "来自 QQ 音乐 · 配置自建 API 后可站内播放",
    sourceUrl: `https://y.qq.com/n/ryqq/playlist/${playlistId}`,
    tracks,
  };
};

const fetchPlayUrlViaSelfHosted = async (
  songmid: string,
  apiBase: string,
  authToken?: string,
): Promise<string> => {
  const endpoint = new URL(`${apiBase}/api`);
  endpoint.searchParams.set("server", "tencent");
  endpoint.searchParams.set("type", "url");
  endpoint.searchParams.set("id", songmid);
  if (authToken) endpoint.searchParams.set("auth", authToken);

  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(8_000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return "";

  const payload = (await response.json()) as
    | string
    | { url?: string; data?: string | { url?: string } };

  if (typeof payload === "string") return payload;
  if (typeof payload.url === "string") return payload.url;
  if (typeof payload.data === "string") return payload.data;
  if (payload.data && typeof payload.data === "object" && payload.data.url) {
    return payload.data.url;
  }
  return "";
};

const enrichWithPlayUrls = async (
  playlist: MusicPlaylist,
  apiBase: string,
  authToken?: string,
): Promise<MusicPlaylist> => {
  const tracks = await Promise.all(
    playlist.tracks.map(async (track) => {
      if (track.audioUrl) return track;
      try {
        const audioUrl = await fetchPlayUrlViaSelfHosted(
          track.id,
          apiBase,
          authToken,
        );
        return audioUrl ? { ...track, audioUrl } : track;
      } catch {
        return track;
      }
    }),
  );
  return { ...playlist, tracks };
};

export const GET: APIRoute = async () => {
  const apiBase = process.env.QQ_MUSIC_API_BASE?.replace(/\/+$/, "");
  const playlistId =
    process.env.QQ_MUSIC_PLAYLIST_ID?.trim() || QQ_MUSIC_PLAYLIST_ID;
  const authToken = process.env.QQ_MUSIC_API_TOKEN;

  // Prefer self-hosted Meting-style playlist payload when available.
  if (apiBase) {
    try {
      const endpoint = new URL(`${apiBase}/api`);
      endpoint.searchParams.set("server", "tencent");
      endpoint.searchParams.set("type", "playlist");
      endpoint.searchParams.set("id", playlistId);
      if (authToken) endpoint.searchParams.set("auth", authToken);

      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(10_000),
        headers: { Accept: "application/json" },
      });
      if (response.ok) {
        const playlist = normalizeExternalPlaylist(
          await response.json(),
          playlistId,
        );
        if (playlist) {
          return json({
            source: "qq-music-api",
            shareUrl: QQ_MUSIC_SHARE_URL,
            playlist,
          });
        }
      }
    } catch (error) {
      console.error("Self-hosted QQ Music playlist request failed:", error);
    }
  }

  try {
    let playlist = await fetchOfficialPlaylist(playlistId);
    if (!playlist) throw new Error("Official QQ playlist returned no tracks");

    if (apiBase) {
      playlist = await enrichWithPlayUrls(playlist, apiBase, authToken);
    }

    const playable = playlist.tracks.filter((track) => track.audioUrl).length;
    return json({
      source: playable ? "qq-music-hybrid" : "qq-music-meta",
      shareUrl: QQ_MUSIC_SHARE_URL,
      playableCount: playable,
      playlist,
    });
  } catch (error) {
    console.error("QQ Music playlist request failed:", error);
    return json({
      source: "snapshot",
      fallback: true,
      shareUrl: QQ_MUSIC_SHARE_URL,
      playlist: PLACEHOLDER_PLAYLIST,
    });
  }
};
