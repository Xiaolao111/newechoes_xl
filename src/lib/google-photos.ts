const RPC_ID = "snAcKc";

type NodeFetch = (input: URL | string, init?: RequestInit) => Promise<Response>;

export type GooglePhotoItem = {
  index: number;
  id: string;
  mediaType: "photo" | "video";
  baseUrl: string;
  width: number | null;
  height: number | null;
  takenAt: string | null;
  durationMs: number | null;
  thumbUrl: string;
  displayUrl: string;
  previewUrl: string;
  originalLikeUrl: string | null;
  videoUrl: string | null;
};

export type GooglePhotoAlbum = {
  id: string | null;
  title: string | null;
  coverUrl: string | null;
};

type CursorPayload = {
  albumId: string;
  shareKey: string | null;
  token: string;
  fSid: string;
  bl: string;
  requestId: number;
};

type InitData = [
  unknown,
  unknown[][],
  string,
  unknown[],
  unknown[],
  number,
];

type GlobalData = {
  FdrFJe: string;
  cfb2h: string;
};

const REQUEST_TIMEOUT_MS = 25000;

const imageUrl = (baseUrl: string, params: string) => `${baseUrl}=${params}`;

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function fetchWithTimeout(url: URL | string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const targetUrl = new URL(url);
  const customFetch = (globalThis as { __googlePhotosNodeFetch?: NodeFetch }).__googlePhotosNodeFetch;

  try {
    const response = customFetch
      ? await customFetch(targetUrl, {
          ...options,
          signal: controller.signal,
        })
      : await fetch(url, {
          ...options,
          signal: controller.signal,
        });

    const redirectStatus = response.status;
    const location = response.headers.get("location");
    if (location && [301, 302, 303, 307, 308].includes(redirectStatus)) {
      return fetchWithTimeout(new URL(location, targetUrl), {
        ...options,
        method: redirectStatus === 303 ? "GET" : options.method,
        body: redirectStatus === 303 ? undefined : options.body,
      });
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Google Photos 请求超时，请确认本机代理可访问 Google");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

const encodeCursor = (cursor: CursorPayload) =>
  bytesToBase64Url(new TextEncoder().encode(JSON.stringify(cursor)));

const decodeCursor = (cursor: string): CursorPayload =>
  JSON.parse(new TextDecoder().decode(base64UrlToBytes(cursor)));

const toPhotoItems = (items: unknown[][], startIndex = 0): GooglePhotoItem[] => {
  return items
    .map((item, itemIndex) => {
      const media = item[1] as unknown[] | undefined;
      const metadata = item[9] as Record<string, unknown> | undefined;
      const videoMetadata = metadata?.["76647426"] as unknown[] | undefined;
      const baseUrl = media?.[0];
      const width = typeof media?.[1] === "number" ? media[1] : null;
      const height = typeof media?.[2] === "number" ? media[2] : null;
      const takenMs = typeof item[2] === "number" ? item[2] : null;
      const durationMs = typeof videoMetadata?.[0] === "number" ? videoMetadata[0] : null;
      const mediaType: GooglePhotoItem["mediaType"] = durationMs ? "video" : "photo";

      if (typeof item[0] !== "string" || typeof baseUrl !== "string") {
        return null;
      }

      if (!baseUrl.startsWith("https://lh3.googleusercontent.com/")) {
        return null;
      }

      return {
        index: startIndex + itemIndex + 1,
        id: item[0],
        mediaType,
        baseUrl,
        width,
        height,
        takenAt: takenMs ? new Date(takenMs).toISOString() : null,
        durationMs,
        thumbUrl: imageUrl(baseUrl, "w600"),
        displayUrl: imageUrl(baseUrl, "w1600"),
        previewUrl: imageUrl(baseUrl, "w2400"),
        originalLikeUrl:
          mediaType === "photo" && width && height ? imageUrl(baseUrl, `w${width}-h${height}`) : null,
        videoUrl: mediaType === "video" ? imageUrl(baseUrl, "dv") : null,
      };
    })
    .filter((item): item is GooglePhotoItem => Boolean(item));
};

const toAlbum = (album: unknown[]): GooglePhotoAlbum => ({
  id: typeof album?.[0] === "string" ? album[0] : null,
  title: typeof album?.[1] === "string" ? album[1] : null,
  coverUrl: typeof album?.[3] === "string" ? album[3] : null,
});

export async function fetchSharedAlbumHtml(shareUrl: string) {
  const response = await fetchWithTimeout(shareUrl, {
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Google Photos request failed: ${response.status} ${response.statusText}`);
  }

  return {
    html: await response.text(),
    resolvedUrl: response.url,
  };
}

function extractBalanced(source: string, start: number) {
  const open = source[start];
  const close = open === "{" ? "}" : open === "[" ? "]" : null;
  if (!close) {
    return null;
  }

  let depth = 0;
  let inString: '"' | "'" | null = null;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = char;
      continue;
    }

    if (char === open) {
      depth += 1;
    } else if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  return null;
}

function findTopLevelProperty(objectLiteral: string, name: string) {
  const needle = `${name}:`;
  let inString: '"' | "'" | null = null;
  let escaped = false;
  let depth = 0;

  for (let index = 0; index < objectLiteral.length; index += 1) {
    const char = objectLiteral[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = char;
      continue;
    }

    if (char === "{" || char === "[") {
      depth += 1;
      continue;
    }

    if (char === "}" || char === "]") {
      depth -= 1;
      continue;
    }

    if (depth === 1 && objectLiteral.startsWith(needle, index)) {
      const before = objectLiteral[index - 1];
      if (!before || /[\s,{]/.test(before)) {
        return index + needle.length;
      }
    }
  }

  return -1;
}

function skipWhitespace(source: string, start: number) {
  let index = start;
  while (index < source.length && /\s/.test(source[index] ?? "")) {
    index += 1;
  }
  return index;
}

function parseJsLiteral(source: string) {
  return JSON.parse(source.replace(/\bundefined\b/g, "null").replace(/,\s*([\]}])/g, "$1"));
}

export function parseInitData(html: string): InitData {
  const callbacks: { data: unknown[] }[] = [];
  const callbackPattern = /AF_initDataCallback\(/g;

  let match;
  while ((match = callbackPattern.exec(html))) {
    const objectStart = skipWhitespace(html, match.index + match[0].length);
    if (html[objectStart] !== "{") {
      continue;
    }

    const objectLiteral = extractBalanced(html, objectStart);
    if (!objectLiteral) {
      continue;
    }

    const dataOffset = findTopLevelProperty(objectLiteral, "data");
    if (dataOffset < 0) {
      continue;
    }

    const dataStart = skipWhitespace(objectLiteral, dataOffset);
    if (objectLiteral[dataStart] !== "[") {
      continue;
    }

    const dataLiteral = extractBalanced(objectLiteral, dataStart);
    if (!dataLiteral) {
      continue;
    }

    try {
      const data = parseJsLiteral(dataLiteral);
      if (Array.isArray(data)) {
        callbacks.push({ data });
      }
    } catch {
      continue;
    }
  }

  const albumData = callbacks.find(({ data }) => {
    return Array.isArray(data?.[1]) && Array.isArray(data?.[3]);
  });

  if (!albumData) {
    throw new Error("Could not find Google Photos album data in page payload");
  }

  return albumData.data as InitData;
}

export function parseGlobalData(html: string): GlobalData {
  const fSid = html.match(/"FdrFJe"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1];
  const bl = html.match(/"cfb2h"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1];

  if (!fSid || !bl) {
    throw new Error("Could not find Google Photos global data in page payload");
  }

  return {
    FdrFJe: JSON.parse(`"${fSid}"`),
    cfb2h: JSON.parse(`"${bl}"`),
  };
}

export function parseBatchExecuteResponse(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (!line.startsWith("[")) {
      continue;
    }

    let payload;
    try {
      payload = JSON.parse(line);
    } catch {
      continue;
    }

    const entry = payload.find((item: unknown[]) => item?.[0] === "wrb.fr" && item?.[1] === RPC_ID);
    if (entry?.[2]) {
      return JSON.parse(entry[2]);
    }
  }

  throw new Error("Could not parse Google Photos page response");
}

async function fetchAlbumPage(cursor: CursorPayload) {
  const endpoint = new URL("https://photos.google.com/_/PhotosUi/data/batchexecute");
  endpoint.search = new URLSearchParams({
    rpcids: RPC_ID,
    "source-path": `/share/${cursor.albumId}`,
    "f.sid": cursor.fSid,
    bl: cursor.bl,
    hl: "en-US",
    "soc-app": "165",
    "soc-platform": "1",
    "soc-device": "1",
    _reqid: String(cursor.requestId),
    rt: "c",
  }).toString();

  const body = new URLSearchParams({
    "f.req": JSON.stringify([
      [[RPC_ID, JSON.stringify([cursor.albumId, cursor.token, null, cursor.shareKey]), null, "generic"]],
    ]),
  });

  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      "x-same-domain": "1",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Google Photos page request failed: ${response.status} ${response.statusText}`);
  }

  return parseBatchExecuteResponse(await response.text()) as InitData;
}

export async function fetchGooglePhotosPage({
  shareUrl,
  cursor,
  loadedCount = 0,
}: {
  shareUrl: string;
  cursor?: string | null;
  loadedCount?: number;
}) {
  if (cursor) {
    const cursorPayload = decodeCursor(cursor);
    const pageData = await fetchAlbumPage(cursorPayload);
    const nextToken = pageData[2] || "";

    return {
      album: toAlbum(pageData[3]),
      photos: toPhotoItems(pageData[1], loadedCount),
      nextCursor: nextToken
        ? encodeCursor({
            ...cursorPayload,
            token: nextToken,
            requestId: cursorPayload.requestId + 100000,
          })
        : null,
    };
  }

  const { html, resolvedUrl } = await fetchSharedAlbumHtml(shareUrl);
  const initData = parseInitData(html);
  const globalData = parseGlobalData(html);
  const albumId = initData[3]?.[0];

  if (typeof albumId !== "string") {
    throw new Error("Could not find Google Photos album id");
  }

  let shareKey: string | null = null;
  try {
    shareKey = resolvedUrl ? new URL(resolvedUrl, shareUrl).searchParams.get("key") : null;
  } catch {
    shareKey = null;
  }
  const nextToken = initData[2] || "";

  return {
    album: toAlbum(initData[3]),
    photos: toPhotoItems(initData[1], 0),
    nextCursor: nextToken
      ? encodeCursor({
          albumId,
          shareKey,
          token: nextToken,
          fSid: globalData.FdrFJe,
          bl: globalData.cfb2h,
          requestId: 100000,
        })
      : null,
  };
}
