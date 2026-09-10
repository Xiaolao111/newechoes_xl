import http from "node:http";
import https from "node:https";
import tls from "node:tls";
import { execFileSync } from "node:child_process";

type NodeFetch = (input: URL | string, init?: RequestInit) => Promise<Response>;

function detectProxyUrl(): string | null {
  const fromEnv =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.ALL_PROXY ||
    process.env.all_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy;

  if (fromEnv) {
    return fromEnv;
  }

  if (process.platform !== "darwin") {
    return null;
  }

  try {
    const output = execFileSync("scutil", ["--proxy"], { encoding: "utf8" });
    const enabled = /HTTPSEnable\s*:\s*1/.test(output);
    const host = output.match(/HTTPSProxy\s*:\s*(\S+)/)?.[1];
    const port = output.match(/HTTPSPort\s*:\s*(\d+)/)?.[1];
    if (enabled && host && port) {
      return `http://${host}:${port}`;
    }
  } catch {
    return null;
  }

  return null;
}

function headersToRecord(headers?: HeadersInit): Record<string, string> {
  if (!headers) {
    return {};
  }

  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  return { ...headers };
}

function requestViaProxy(
  targetUrl: URL,
  proxyUrl: URL,
  options: RequestInit,
  signal: AbortSignal,
): Promise<Response> {
  const method = (options.method || "GET").toUpperCase();
  const body =
    typeof options.body === "string" || options.body instanceof Buffer
      ? options.body
      : options.body
        ? String(options.body)
        : undefined;

  return new Promise((resolve, reject) => {
    const connectReq = http.request({
      host: proxyUrl.hostname,
      port: Number(proxyUrl.port || 80),
      method: "CONNECT",
      path: `${targetUrl.hostname}:443`,
      headers: {
        Host: `${targetUrl.hostname}:443`,
      },
    });

    const fail = (error: unknown) => {
      connectReq.destroy();
      reject(error);
    };

    const onAbort = () => {
      fail(Object.assign(new Error("Aborted"), { name: "AbortError" }));
    };

    if (signal.aborted) {
      onAbort();
      return;
    }

    signal.addEventListener("abort", onAbort, { once: true });

    connectReq.on("error", fail);
    connectReq.on("connect", (connectResponse, socket) => {
      if (connectResponse.statusCode !== 200) {
        socket.destroy();
        fail(new Error(`代理 CONNECT 失败: ${connectResponse.statusCode}`));
        return;
      }

      const tlsSocket = tls.connect({
        socket,
        servername: targetUrl.hostname,
      });

      tlsSocket.on("error", fail);

      const request = https.request(
        {
          host: targetUrl.hostname,
          path: `${targetUrl.pathname}${targetUrl.search}`,
          method,
          headers: {
            ...headersToRecord(options.headers),
            host: targetUrl.hostname,
          },
          createConnection: () => tlsSocket,
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk) => chunks.push(chunk as Buffer));
          response.on("end", () => {
            signal.removeEventListener("abort", onAbort);
            const location = response.headers.location;
            const webResponse = new Response(Buffer.concat(chunks), {
              status: response.statusCode || 502,
              headers: {
                ...response.headers,
                location: Array.isArray(location) ? location[0] : location,
              } as HeadersInit,
            });
            Object.defineProperty(webResponse, "url", {
              value: targetUrl.toString(),
            });
            resolve(webResponse);
          });
          response.on("error", fail);
        },
      );

      request.on("error", fail);
      if (body) {
        request.write(body);
      }
      request.end();
    });

    connectReq.end();
  });
}

export function installGooglePhotosNodeProxy() {
  const nodeFetch: NodeFetch = async (input, init = {}) => {
    const proxy = detectProxyUrl();
    const targetUrl = new URL(typeof input === "string" ? input : input.toString());

    if (!proxy) {
      return fetch(input, init);
    }

    const controller = new AbortController();
    const onAbort = () => controller.abort();
    init.signal?.addEventListener("abort", onAbort, { once: true });

    try {
      return await requestViaProxy(targetUrl, new URL(proxy), init, controller.signal);
    } finally {
      init.signal?.removeEventListener("abort", onAbort);
    }
  };

  (globalThis as { __googlePhotosNodeFetch?: NodeFetch }).__googlePhotosNodeFetch = nodeFetch;
}
