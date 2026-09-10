import React, { useEffect, useState } from "react";
import {
  getMusicPlayerState,
  loadMusicPlaylist,
  next,
  previous,
  subscribeMusicPlayer,
  togglePlayback,
  type MusicPlayerState,
} from "@/lib/music/player";

const IconPrev = () => (
  <svg viewBox="0 0 24 24" className="size-[15px]" fill="none" aria-hidden="true">
    <path
      d="M7 6v12M18.5 6.5v11L9.5 12l9-5.5z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  </svg>
);

const IconPlay = () => (
  <svg viewBox="0 0 24 24" className="size-[15px]" fill="none" aria-hidden="true">
    <path
      d="M8.5 6.2v11.6L18.5 12 8.5 6.2z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  </svg>
);

const IconPause = () => (
  <svg viewBox="0 0 24 24" className="size-[15px]" fill="none" aria-hidden="true">
    <path
      d="M8 6.5h2.4v11H8zM13.6 6.5H16v11h-2.4z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const IconNext = () => (
  <svg viewBox="0 0 24 24" className="size-[15px]" fill="none" aria-hidden="true">
    <path
      d="M17 6v12M5.5 6.5v11L14.5 12l-9-5.5z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  </svg>
);

const HeaderMusicBar: React.FC = () => {
  const [player, setPlayer] = useState<MusicPlayerState>(getMusicPlayerState());

  useEffect(() => {
    const unsubscribe = subscribeMusicPlayer(setPlayer);
    void loadMusicPlaylist();
    return unsubscribe;
  }, []);

  const { isPlaying, track, currentLyric, error } = player;
  const lyricText =
    currentLyric?.text ||
    (isPlaying ? `${track.title} · ${track.artist}` : "");

  return (
    <div
      className="header-music-bar ml-2 flex min-w-0 max-w-[min(42vw,22rem)] items-center overflow-hidden sm:ml-3"
      data-playing={isPlaying ? "true" : "false"}
      title={error ?? undefined}
    >
      {isPlaying ? (
        <div className="header-music-bar__nowplaying flex min-w-0 items-center gap-2">
          <button
            type="button"
            className="header-music-bar__btn shrink-0"
            onClick={() => void togglePlayback()}
            aria-label="暂停"
          >
            <IconPause />
          </button>
          <a
            href="/music"
            className="header-music-bar__lyric group relative min-w-0 overflow-hidden"
            aria-label={`正在播放：${track.title}`}
          >
            <span
              key={`${track.id}-${lyricText}`}
              className="header-music-bar__lyric-text"
            >
              {lyricText}
            </span>
          </a>
          <button
            type="button"
            className="header-music-bar__btn header-music-bar__btn--skip shrink-0"
            onClick={() => void next()}
            aria-label="下一首"
          >
            <IconNext />
          </button>
        </div>
      ) : (
        <div className="header-music-bar__controls flex items-center gap-0.5">
          <button
            type="button"
            className="header-music-bar__btn header-music-bar__btn--skip"
            onClick={() => void previous()}
            aria-label="上一首"
          >
            <IconPrev />
          </button>
          <button
            type="button"
            className="header-music-bar__btn"
            onClick={() => void togglePlayback()}
            aria-label="播放"
          >
            <IconPlay />
          </button>
          <button
            type="button"
            className="header-music-bar__btn header-music-bar__btn--skip"
            onClick={() => void next()}
            aria-label="下一首"
          >
            <IconNext />
          </button>
        </div>
      )}
    </div>
  );
};

export default HeaderMusicBar;
