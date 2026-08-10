import React, { useEffect, useState } from "react";
import {
  getMusicPlayerState,
  loadMusicPlaylist,
  next,
  pause,
  play,
  previous,
  seek,
  selectTrack,
  subscribeMusicPlayer,
  type MusicPlayerState,
} from "@/lib/music/player";

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
};

const MusicPlaylist: React.FC = () => {
  const [player, setPlayer] = useState<MusicPlayerState>(getMusicPlayerState());

  useEffect(() => {
    const unsubscribe = subscribeMusicPlayer(setPlayer);
    void loadMusicPlaylist();
    return () => {
      unsubscribe();
    };
  }, []);

  const { playlist, track, currentIndex, isPlaying, currentTime, duration, error } =
    player;

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/70 sm:p-8">
        <div className="grid gap-7 sm:grid-cols-[12rem_1fr] sm:items-center">
          <img
            src={track.cover}
            alt={`${track.title} 封面`}
            className="aspect-square w-full max-w-48 rounded-2xl object-cover shadow-xl"
          />

          <div className="min-w-0">
            <p className="mb-2 text-xs tracking-[0.22em] text-amber-700 dark:text-amber-300">
              NOW PLAYING
            </p>
            <h2 className="truncate text-3xl font-bold">{track.title}</h2>
            <p className="mt-1 text-gray-500 dark:text-gray-400">{track.artist}</p>

            <div className="mt-6">
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={1}
                value={Math.min(currentTime, duration || 0)}
                onChange={(event) => seek(Number(event.target.value))}
                aria-label="播放进度"
                className="w-full accent-amber-700"
              />
              <div className="mt-1 flex justify-between font-mono text-xs text-gray-500">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => void previous()}
                className="grid size-11 place-items-center rounded-full border border-gray-200 transition hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                aria-label="上一首"
              >
                <svg viewBox="0 0 24 24" className="size-5 fill-current">
                  <path d="M6 5v14M18 6l-9 6 9 6V6z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => (isPlaying ? pause() : void play())}
                className="grid size-14 place-items-center rounded-full bg-gray-900 text-white shadow-lg transition hover:-translate-y-0.5 dark:bg-white dark:text-gray-900"
                aria-label={isPlaying ? "暂停" : "播放"}
              >
                {isPlaying ? (
                  <svg viewBox="0 0 24 24" className="size-6 fill-current">
                    <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="size-6 fill-current">
                    <path d="M8 5v14l11-7L8 5z" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={() => void next()}
                className="grid size-11 place-items-center rounded-full border border-gray-200 transition hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                aria-label="下一首"
              >
                <svg viewBox="0 0 24 24" className="size-5 fill-current">
                  <path d="M18 5v14M6 6l9 6-9 6V6z" />
                </svg>
              </button>
            </div>

            {error && (
              <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">{error}</p>
            )}
            {track.sourceUrl && (
              <a
                href={track.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex text-sm text-gray-500 underline-offset-4 hover:underline dark:text-gray-400"
              >
                在 QQ 音乐打开
              </a>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">{playlist.title}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {playlist.description}
            </p>
          </div>
          {playlist.sourceUrl && (
            <a
              href={playlist.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-amber-700 underline-offset-4 hover:underline dark:text-amber-300"
            >
              打开原歌单
            </a>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
          {playlist.tracks.map((item, index) => {
            const active = index === currentIndex;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => void selectTrack(index)}
                className={`grid w-full grid-cols-[3rem_3.5rem_1fr_auto] items-center gap-3 border-b border-gray-100 p-3 text-left transition last:border-b-0 dark:border-gray-800 ${
                  active
                    ? "bg-amber-50 dark:bg-amber-950/30"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800/70"
                }`}
              >
                <span className="text-center font-mono text-sm text-gray-400">
                  {active && isPlaying ? "♪" : String(index + 1).padStart(2, "0")}
                </span>
                <img
                  src={item.cover}
                  alt=""
                  className="aspect-square w-14 rounded-lg object-cover"
                />
                <span className="min-w-0">
                  <strong className="block truncate">{item.title}</strong>
                  <span className="block truncate text-sm text-gray-500 dark:text-gray-400">
                    {item.artist}
                  </span>
                </span>
                <span className="hidden text-xs text-gray-400 sm:block">
                  {active ? "正在播放" : "播放"}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default MusicPlaylist;

