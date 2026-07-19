import { getBindings } from "@/db";

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function randomToken(byteLength = 24): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export function randomLinkCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function digestSecret(value: string): Promise<string> {
  const pepper = getBindings().ACCESS_PEPPER || "local-development-pepper";
  return sha256Hex(`${pepper}:${value.normalize("NFKC").trim()}`);
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}

export function constantTimeEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export async function createSignedToken(subject: string, lifetimeSeconds: number): Promise<string> {
  const secret = getBindings().SESSION_SECRET || "local-development-session-secret";
  const payload = JSON.stringify({ subject, expiresAt: Math.floor(Date.now() / 1000) + lifetimeSeconds });
  const encodedPayload = toBase64Url(encoder.encode(payload));
  return `${encodedPayload}.${await hmac(encodedPayload, secret)}`;
}

export async function verifySignedToken(token: string | undefined, subject: string): Promise<boolean> {
  if (!token) return false;
  const [encodedPayload, receivedSignature] = token.split(".");
  if (!encodedPayload || !receivedSignature) return false;
  const secret = getBindings().SESSION_SECRET || "local-development-session-secret";
  const expectedSignature = await hmac(encodedPayload, secret);
  if (!constantTimeEqual(receivedSignature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encodedPayload))) as {
      subject: string;
      expiresAt: number;
    };
    return payload.subject === subject && payload.expiresAt > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function readCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get("cookie") || "";
  for (const entry of cookieHeader.split(";")) {
    const [key, ...valueParts] = entry.trim().split("=");
    if (key === name) return decodeURIComponent(valueParts.join("="));
  }
  return undefined;
}

export function serializeCookie(name: string, value: string, maxAge: number, secure = false): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function clearCookie(name: string): string {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}

export async function isAdminRequest(request: Request): Promise<boolean> {
  return verifySignedToken(readCookie(request, "choseikun_admin"), "admin");
}

export function eventCookieName(slug: string): string {
  return `choseikun_event_${slug.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}
