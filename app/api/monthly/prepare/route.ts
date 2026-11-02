import { getBindings } from "@/db";
import { prepareMonthly } from "@/lib/20261101_monthly-automation";
import { monthlySchedule } from "@/lib/20261102_monthly-schedule";
import { constantTimeEqual, sha256Hex } from "@/lib/security";
import { jsonResponse, readJson } from "@/lib/http";

// Prepare a page without publishing a message or assigning a LINE recipient.
export async function POST(request: Request) {
  const secret = getBindings().REMINDER_CRON_SECRET || "";
  const provided = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!secret || !provided) return jsonResponse({error:"認証できません。"},401);
  const [expected,received] = await Promise.all([sha256Hex(secret),sha256Hex(provided)]);
  if (!constantTimeEqual(expected,received)) return jsonResponse({error:"認証できません。"},401);
  const input = await readJson<{targetMonth?:string}>(request);
  if (typeof input?.targetMonth !== "string" || !monthlySchedule(input.targetMonth)) return jsonResponse({error:"対象月を確認してください。"},400);
  const result = await prepareMonthly(input.targetMonth);
  const base = getBindings().PUBLIC_BASE_URL!.replace(/\/$/, "");
  return jsonResponse({event:{slug:result.slug,shareUrl:`${base}/e/${result.slug}`,manageUrl:result.adminToken ? `${base}/manage/${result.adminToken}` : null},schedule:monthlySchedule(input.targetMonth)});
}
