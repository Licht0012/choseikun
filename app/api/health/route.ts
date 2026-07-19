import { getDb } from "@/db";
import { jsonResponse } from "@/lib/http";

export async function GET() {
  const db = await getDb();
  const result = await db.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  return jsonResponse({ ok: result?.ok === 1 });
}
