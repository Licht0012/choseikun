import { getBindings } from "@/db";
import { runMonthly } from "@/lib/20261101_monthly-automation";
import { jsonResponse } from "@/lib/http";
import { constantTimeEqual, sha256Hex } from "@/lib/security";

// Optional fallback for hosts which cannot attach native Cron Triggers.
export async function POST(request: Request) {
  const secret = getBindings().REMINDER_CRON_SECRET || "";
  const provided = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!secret || !provided) return jsonResponse({error:"認証できません。"},401);
  const [expected,received] = await Promise.all([sha256Hex(secret),sha256Hex(provided)]);
  if (!constantTimeEqual(expected,received)) return jsonResponse({error:"認証できません。"},401);
  if (getBindings().MONTHLY_ENABLED !== "true") return jsonResponse({error:"毎月の自動処理は無効です。"},503);
  await runMonthly();
  return jsonResponse({ok:true});
}
