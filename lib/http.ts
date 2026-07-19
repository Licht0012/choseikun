import { getBindings } from "@/db";

export function jsonResponse(data: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("content-type", "application/json; charset=utf-8");
  responseHeaders.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { status, headers: responseHeaders });
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function absoluteBaseUrl(request: Request): string {
  const configured = getBindings().PUBLIC_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");
  return new URL(request.url).origin;
}
