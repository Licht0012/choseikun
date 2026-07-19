import { getBindings, getDb } from "@/db";
import { jsonResponse } from "@/lib/http";
import { constantTimeEqual, sha256Hex } from "@/lib/security";

function tomorrowInJapan(): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(tomorrow);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatJapaneseDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${value}T12:00:00+09:00`));
}

export async function POST(request: Request) {
  const bindings = getBindings();
  const expectedSecret = bindings.REMINDER_CRON_SECRET || "";
  const receivedSecret = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const [receivedHash, expectedHash] = await Promise.all([sha256Hex(receivedSecret), sha256Hex(expectedSecret)]);
  if (!expectedSecret || !receivedSecret || !constantTimeEqual(receivedHash, expectedHash)) {
    return jsonResponse({ error: "認証できません。" }, 401);
  }
  if (!bindings.LINE_CHANNEL_ACCESS_TOKEN) return jsonResponse({ error: "LINEが未設定です。" }, 503);

  const db = await getDb();
  const targetDate = tomorrowInJapan();
  const events = await db
    .prepare(
      `SELECT id, slug, name, deadline_date, line_group_id
       FROM events
       WHERE deadline_date = ? AND reminder_enabled = 1
         AND line_group_id IS NOT NULL AND reminder_sent_at IS NULL`,
    )
    .bind(targetDate)
    .all<{ id: string; slug: string; name: string; deadline_date: string; line_group_id: string }>();

  const sent: string[] = [];
  const failed: string[] = [];
  const baseUrl = (bindings.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/$/, "");
  for (const event of events.results) {
    const reservedAt = new Date().toISOString();
    const reservation = await db
      .prepare("UPDATE events SET reminder_sent_at = ? WHERE id = ? AND reminder_sent_at IS NULL")
      .bind(reservedAt, event.id)
      .run();
    if (!reservation.meta.changes) continue;

    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${bindings.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: event.line_group_id,
        messages: [
          {
            type: "text",
            text: `【調整くん】回答期限は明日です\n\nイベント：${event.name}\n期限：${formatJapaneseDate(event.deadline_date)} 23:59\n\nまだの方は回答をお願いします。\n${baseUrl}/e/${event.slug}`,
          },
        ],
      }),
    });
    if (response.ok) {
      sent.push(event.id);
    } else {
      failed.push(event.id);
      await db.prepare("UPDATE events SET reminder_sent_at = NULL WHERE id = ?").bind(event.id).run();
    }
  }

  return jsonResponse({ targetDate, sent: sent.length, failed: failed.length }, failed.length ? 207 : 200);
}

export async function GET() {
  return jsonResponse({ ok: true, message: "調整くんのリマインダーです。" });
}
