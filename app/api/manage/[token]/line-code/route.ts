import { getDb } from "@/db";
import { findEventByAdminToken } from "@/lib/event-data";
import { jsonResponse } from "@/lib/http";
import { digestSecret, randomLinkCode } from "@/lib/security";

export async function POST(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const event = await findEventByAdminToken(token);
  if (!event) return jsonResponse({ error: "管理ページが見つかりません。" }, 404);

  const code = randomLinkCode();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const db = await getDb();
  await db
    .prepare(
      "UPDATE events SET line_link_code_hash = ?, line_link_expires_at = ?, updated_at = ? WHERE id = ?",
    )
    .bind(await digestSecret(code), expiresAt, new Date().toISOString(), event.id)
    .run();
  return jsonResponse({ code, expiresAt, command: `調整くん 連携 ${code}` });
}
