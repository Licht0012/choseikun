import { getBindings } from "@/db";
import { jsonResponse, readJson } from "@/lib/http";
import {
  clearCookie,
  constantTimeEqual,
  createSignedToken,
  isAdminRequest,
  serializeCookie,
  sha256Hex,
} from "@/lib/security";

interface LoginInput {
  password?: string;
}

export async function GET(request: Request) {
  return jsonResponse({ authenticated: await isAdminRequest(request) });
}

export async function POST(request: Request) {
  const body = await readJson<LoginInput>(request);
  const password = body?.password?.normalize("NFKC") || "";
  const expected = getBindings().APP_ADMIN_PASSWORD || "choseikun-local";
  const [actualHash, expectedHash] = await Promise.all([sha256Hex(password), sha256Hex(expected)]);
  if (!password || !constantTimeEqual(actualHash, expectedHash)) {
    return jsonResponse({ error: "管理者パスワードが違います。" }, 401);
  }

  const maxAge = 60 * 60 * 12;
  const token = await createSignedToken("admin", maxAge);
  return jsonResponse(
    { authenticated: true },
    200,
    { "set-cookie": serializeCookie("choseikun_admin", token, maxAge, new URL(request.url).protocol === "https:") },
  );
}

export async function DELETE() {
  return jsonResponse({ authenticated: false }, 200, { "set-cookie": clearCookie("choseikun_admin") });
}
