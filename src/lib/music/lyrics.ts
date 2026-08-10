export interface LyricLine {
  time: number;
  text: string;
}

const LRC_LINE = /^\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\](.*)$/;

/** Decode common HTML entities found in QQ lyric payloads. */
export const decodeLyricEntities = (raw: string) =>
  raw
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "");

export const parseLrc = (lrc: string): LyricLine[] => {
  const lines: LyricLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const match = raw.trim().match(LRC_LINE);
    if (!match) continue;
    const minutes = Number(match[1]);
    const seconds = Number(match[2]);
    const fraction = match[3] ?? "0";
    const ms =
      fraction.length <= 2
        ? Number(fraction) * (fraction.length === 1 ? 100 : 10)
        : Number(fraction.padEnd(3, "0").slice(0, 3));
    const text = decodeLyricEntities(match[4] ?? "").trim();
    if (!text) continue;
    lines.push({
      time: minutes * 60 + seconds + ms / 1000,
      text,
    });
  }
  return lines.sort((a, b) => a.time - b.time);
};

export const getLyricAtTime = (
  lines: LyricLine[],
  time: number,
): LyricLine | null => {
  if (!lines.length) return null;
  let current: LyricLine | null = null;
  for (const line of lines) {
    if (line.time <= time + 0.05) current = line;
    else break;
  }
  return current;
};
