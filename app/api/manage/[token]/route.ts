import { getDb } from "@/db";
import { buildPublicEvent, findEventByAdminToken } from "@/lib/event-data";
import { absoluteBaseUrl, jsonResponse, readJson } from "@/lib/http";
import { cleanText } from "@/lib/validation";

interface UpdateInput {
  name?: string;
  memo?: string;
  deadlineDate?: string;
  reminderEnabled?: boolean;
}

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const event = await findEventByAdminToken(token);
  if (!event) return jsonResponse({ error: "管理ページが見つかりません。" }, 404);
  return jsonResponse({
    event: await buildPublicEvent(event),
    management: {
      shareUrl: `${absoluteBaseUrl(request)}/e/${event.slug}`,
      lineGroupName: event.line_group_name,
      lineConnected: Boolean(event.line_group_id),
      reminderSentAt: event.reminder_sent_at,
    },
  });
}

export async function PUT(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const event = await findEventByAdminToken(token);
  if (!event) return jsonResponse({ error: "管理ページが見つかりません。" }, 404);
  const body = await readJson<UpdateInput>(request);
  if (!body) return jsonResponse({ error: "入力内容を確認してください。" }, 400);

  const name = cleanText(body.name, 100) || event.name;
  const memo = typeof body.memo === "string" ? cleanText(body.memo, 500) : event.memo;
  const deadlineDate = cleanText(body.deadlineDate, 10) || event.deadline_date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadlineDate)) return jsonResponse({ error: "入力期限日を確認してください。" }, 400);

  const db = await getDb();
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE events
         SET name = ?, memo = ?, deadline_date = ?, reminder_enabled = ?,
             reminder_sent_at = CASE WHEN deadline_date <> ? THEN NULL ELSE reminder_sent_at END,
             updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        name,
        memo,
        deadlineDate,
        body.reminderEnabled === false ? 0 : 1,
        deadlineDate,
        new Date().toISOString(),
        event.id,
      ),
  ];
  await db.batch(statements);
  const updated = await findEventByAdminToken(token);
  return jsonResponse({ event: updated ? await buildPublicEvent(updated) : null, saved: true });
}
