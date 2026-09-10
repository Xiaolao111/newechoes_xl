import { SITE_URL } from "../../src/consts";
import { handleGooglePhotosRequest } from "../../src/lib/google-photos-handler";

const ALLOWED_ORIGINS = new Set([SITE_URL, "http://localhost:4321", "http://127.0.0.1:4321"]);

function withCors(request: Request, response: Response) {
  const headers = new Headers(response.headers);
  const origin = request.headers.get("origin");

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }

  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

export const onRequestOptions = async (context: { request: Request }) => {
  return withCors(context.request, new Response(null, { status: 204 }));
};

export const onRequestGet = async (context: { request: Request }) => {
  return withCors(context.request, await handleGooglePhotosRequest(context.request));
};
