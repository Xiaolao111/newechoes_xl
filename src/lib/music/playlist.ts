export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  cover: string;
  /** Empty when playable stream is unavailable without a self-hosted QQ Music API. */
  audioUrl: string;
  sourceUrl?: string;
}

export interface MusicPlaylist {
  id: string;
  title: string;
  description: string;
  sourceUrl?: string;
  tracks: MusicTrack[];
}

export const QQ_MUSIC_SHARE_URL =
  "https://c6.y.qq.com/base/fcgi-bin/u?__=hhgTVWOMHBEh";

/** Resolved from the share short link above. */
export const QQ_MUSIC_PLAYLIST_ID = "9751662138";

const albumCover = (albummid: string) =>
  `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albummid}.jpg`;

const songPage = (songmid: string) =>
  `https://y.qq.com/n/ryqq/songDetail/${songmid}`;

/**
 * Snapshot of the owner's QQ Music playlist 《博客歌单》.
 * Live `/api/music` will refresh this from QQ when possible; playable
 * `audioUrl` values still require a self-hosted QQ Music API for VIP tracks.
 */
export const PLACEHOLDER_PLAYLIST: MusicPlaylist = {
  id: QQ_MUSIC_PLAYLIST_ID,
  title: "博客歌单",
  description: "来自 QQ 音乐 · 点击歌曲可打开 QQ 音乐页面",
  sourceUrl: QQ_MUSIC_SHARE_URL,
  tracks: [
    {
      id: "0013FZ2a2kpRO2",
      title: "Play A Love Song",
      artist: "宇多田光",
      cover: albumCover("000Q2aNy2G4tJb"),
      audioUrl: "",
      sourceUrl: songPage("0013FZ2a2kpRO2"),
    },
    {
      id: "002YJoz04THQD2",
      title: "Don't Break My Heart",
      artist: "黑豹乐队",
      cover: albumCover("0024IeFv3DrGMT"),
      audioUrl: "",
      sourceUrl: songPage("002YJoz04THQD2"),
    },
    {
      id: "001WBhMz1jjBmX",
      title: "半途而废",
      artist: "王菲",
      cover: albumCover("001gn7g54ZEIKb"),
      audioUrl: "",
      sourceUrl: songPage("001WBhMz1jjBmX"),
    },
    {
      id: "002q76zt36Sc2d",
      title: "一个人",
      artist: "林忆莲",
      cover: albumCover("001PPU2o2fOzcs"),
      audioUrl: "",
      sourceUrl: songPage("002q76zt36Sc2d"),
    },
    {
      id: "003ywmf91rfYno",
      title: "黑白画映",
      artist: "张学友",
      cover: albumCover("002HkRpW29Gdwd"),
      audioUrl: "",
      sourceUrl: songPage("003ywmf91rfYno"),
    },
    {
      id: "003PNrhu08qe4s",
      title: "小小虫",
      artist: "方大同",
      cover: albumCover("002hMaer3McPaG"),
      audioUrl: "",
      sourceUrl: songPage("003PNrhu08qe4s"),
    },
    {
      id: "000ib2Pc36uOkr",
      title: "永远的诗",
      artist: "小霞",
      cover: albumCover("001Zk88l3MeuuZ"),
      audioUrl: "",
      sourceUrl: songPage("000ib2Pc36uOkr"),
    },
  ],
};
