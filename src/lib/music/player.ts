import {
  PLACEHOLDER_PLAYLIST,
  type MusicPlaylist,
  type MusicTrack,
} from "./playlist";
import {
  getLyricAtTime,
  parseLrc,
  type LyricLine,
} from "./lyrics";

export interface MusicPlayerState {
  playlist: MusicPlaylist;
  track: MusicTrack;
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  lyrics: LyricLine[];
  currentLyric: LyricLine | null;
  error: string | null;
}

type Listener = (state: MusicPlayerState) => void;

let playlist = PLACEHOLDER_PLAYLIST;
let currentIndex = 0;
let audio: HTMLAudioElement | null = null;
let error: string | null = null;
let lyrics: LyricLine[] = [];
let lyricRequestId = 0;
let playlistRequest: Promise<void> | null = null;
let resolvingPlayUrl = false;
const listeners = new Set<Listener>();

const currentTrack = () => playlist.tracks[currentIndex] ?? playlist.tracks[0]!;

const snapshot = (): MusicPlayerState => {
  const currentTime = audio?.currentTime ?? 0;
  return {
    playlist,
    track: currentTrack(),
    currentIndex,
    isPlaying: audio ? !audio.paused : false,
    currentTime,
    duration: Number.isFinite(audio?.duration) ? (audio?.duration ?? 0) : 0,
    lyrics,
    currentLyric: getLyricAtTime(lyrics, currentTime),
    error,
  };
};

const emit = () => {
  const state = snapshot();
  listeners.forEach((listener) => listener(state));
};

const loadLyricsForCurrentTrack = () => {
  const track = currentTrack();
  const requestId = ++lyricRequestId;
  lyrics = [];
  emit();

  if (typeof window === "undefined" || !track.id) return;

  void fetch(`/api/music/lyric?id=${encodeURIComponent(track.id)}`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`Lyric API ${response.status}`);
      const data = (await response.json()) as { lyric?: string };
      if (requestId !== lyricRequestId) return;
      lyrics = parseLrc(data.lyric ?? "");
      emit();
    })
    .catch(() => {
      if (requestId !== lyricRequestId) return;
      lyrics = [];
      emit();
    });
};

/** QQ play URLs expire quickly; always ask the server for a fresh one. */
const fetchFreshPlayUrl = async (
  songmid: string,
): Promise<{ url: string; hint: string }> => {
  try {
    const response = await fetch(
      `/api/music/url?id=${encodeURIComponent(songmid)}`,
      { cache: "no-store" },
    );
    const data = (await response.json()) as {
      url?: string;
      hint?: string;
      error?: string;
    };
    const url = typeof data.url === "string" ? data.url.trim() : "";
    if (url) return { url, hint: "" };
    return {
      url: "",
      hint:
        data.hint ||
        data.error ||
        "无法获取播放链接，请检查自建 API / Cookie",
    };
  } catch {
    return { url: "", hint: "播放接口请求失败，请稍后重试" };
  }
};

const ensureAudio = () => {
  if (audio || typeof window === "undefined") return audio;

  audio = new Audio();
  audio.preload = "metadata";
  audio.addEventListener("play", emit);
  audio.addEventListener("pause", emit);
  audio.addEventListener("timeupdate", emit);
  audio.addEventListener("durationchange", emit);
  audio.addEventListener("ended", () => {
    void next();
  });
  audio.addEventListener("error", () => {
    // Expired CDN links are common; try one silent refresh then surface error.
    if (resolvingPlayUrl) return;
    const track = currentTrack();
    resolvingPlayUrl = true;
    void fetchFreshPlayUrl(track.id)
      .then(async ({ url: freshUrl, hint }) => {
        if (!audio || !freshUrl) {
          error =
            hint ||
            "音频加载失败：播放链接已失效或 Cookie 过期，请刷新页面或更新 QQ Cookie";
          emit();
          return;
        }
        playlist.tracks[currentIndex] = {
          ...track,
          audioUrl: freshUrl,
        };
        error = null;
        audio.src = freshUrl;
        audio.load();
        try {
          await audio.play();
        } catch {
          error = "音频加载失败，请检查网络或音源地址";
          emit();
        }
      })
      .finally(() => {
        resolvingPlayUrl = false;
      });
  });
  return audio;
};

const loadCurrentTrack = () => {
  const track = currentTrack();
  const element = ensureAudio();
  if (!element) return;

  element.pause();
  loadLyricsForCurrentTrack();

  // Prefer a known URL for instant UI; play() will refresh before starting.
  if (track.audioUrl) {
    error = null;
    element.src = track.audioUrl;
    element.load();
  } else {
    element.removeAttribute("src");
    error = null;
  }
  emit();
};

export const getMusicPlayerState = () => snapshot();

export const subscribeMusicPlayer = (listener: Listener) => {
  listeners.add(listener);
  listener(snapshot());
  return () => {
    listeners.delete(listener);
  };
};

export const play = async () => {
  const track = currentTrack();
  const element = ensureAudio();
  if (!element) return;

  try {
    error = null;
    resolvingPlayUrl = true;
    const { url: freshUrl, hint } = await fetchFreshPlayUrl(track.id);
    if (!freshUrl) {
      error =
        hint ||
        "这首歌需要自建 QQ Music API（含登录 Cookie）才能站内播放";
      emit();
      return;
    }

    playlist.tracks[currentIndex] = { ...track, audioUrl: freshUrl };
    if (element.src !== freshUrl) {
      element.src = freshUrl;
      element.load();
    }
    await element.play();
  } catch {
    error = "浏览器阻止了自动播放，请再次点击播放按钮";
    emit();
  } finally {
    resolvingPlayUrl = false;
  }
};

export const pause = () => {
  ensureAudio()?.pause();
};

export const togglePlayback = async () => {
  const element = ensureAudio();
  if (!element) return;
  if (element.paused) await play();
  else pause();
};

export const selectTrack = async (index: number, autoplay = true) => {
  if (!playlist.tracks.length) return;
  currentIndex = (index + playlist.tracks.length) % playlist.tracks.length;
  loadCurrentTrack();
  if (autoplay) await play();
};

export const previous = async () => {
  await selectTrack(currentIndex - 1);
};

export const next = async () => {
  await selectTrack(currentIndex + 1);
};

export const seek = (time: number) => {
  const element = ensureAudio();
  if (!element || !Number.isFinite(time)) return;
  element.currentTime = Math.max(0, Math.min(time, element.duration || time));
  emit();
};

export const setPlaylist = (nextPlaylist: MusicPlaylist) => {
  if (!nextPlaylist.tracks.length) return;
  const wasPlaying = audio ? !audio.paused : false;
  playlist = nextPlaylist;
  currentIndex = 0;
  loadCurrentTrack();
  if (wasPlaying) void play();
};

export const loadMusicPlaylist = () => {
  if (playlistRequest || typeof window === "undefined") {
    return playlistRequest ?? Promise.resolve();
  }

  playlistRequest = fetch("/api/music", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Music API returned ${response.status}`);
      const data = (await response.json()) as {
        playlist?: MusicPlaylist;
      };
      if (data.playlist?.tracks?.length) setPlaylist(data.playlist);
    })
    .catch(() => {
      // The bundled placeholder remains usable if the provider is unavailable.
    });

  return playlistRequest;
};

// Warm lyrics for the initial track once the player module is used in-browser.
if (typeof window !== "undefined") {
  loadLyricsForCurrentTrack();
}
