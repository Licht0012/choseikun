import { getDb } from "@/db";
import { buildPublicEvent, findEventBySlug } from "@/lib/event-data";
import { jsonResponse, readJson } from "@/lib/http";
import { constantTimeEqual, digestSecret, randomToken } from "@/lib/security";
import type { AvailabilityStatus } from "@/lib/types";
import { cleanText, isResponseOpen } from "@/lib/validation";

interface ResponseInput {
  name?: string;
  comment?: string;
  availability?: Array<{ slotId: string; status: AvailabilityStatus }>;
  editToken?: string;
}

const validStatuses = new Set<AvailabilityStatus>(["yes", "maybe", "no"]);

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const event = await findEventBySlug(slug);
  if (!event) return jsonResponse({ error: "イベントが見つかりません。" }, 404);
  const editToken = request.headers.get("x-edit-token") || "";
  if (!editToken) return jsonResponse({ response: null });
  const editTokenHash = await digestSecret(editToken);
  const db = await getDb();
  const response = await db
    .prepare("SELECT id, name, comment FROM responses WHERE event_id = ? AND edit_token_hash = ? LIMIT 1")
    .bind(event.id, editTokenHash)
    .first<{ id: string; name: string; comment: string }>();
  if (!response) return jsonResponse({ response: null });
  const answers = await db
    .prepare("SELECT slot_id, status FROM availability WHERE response_id = ?")
    .bind(response.id)
    .all<{ slot_id: string; status: AvailabilityStatus }>();
  return jsonResponse({
    response: {
      name: response.name,
      comment: response.comment,
      availability: Object.fromEntries(answers.results.map((answer) => [answer.slot_id, answer.status])),
    },
  });
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const event = await findEventBySlug(slug);
  if (!event) return jsonResponse({ error: "イベントが見つかりません。" }, 404);
  if (!isResponseOpen(event.deadline_date)) return jsonResponse({ error: "回答期限を過ぎています。" }, 409);

  const body = await readJson<ResponseInput>(request);
  const name = cleanText(body?.name, 40);
  const comment = cleanText(body?.comment, 300);
  if (!name) return jsonResponse({ error: "お名前を入力してください。" }, 400);
  const availability = Array.isArray(body?.availability)
    ? body.availability.filter((value) => value?.slotId && validStatuses.has(value.status))
    : [];

  const db = await getDb();
  const slotRows = await db
    .prepare("SELECT id FROM slots WHERE event_id = ? ORDER BY sort_order")
    .bind(event.id)
    .all<{ id: string }>();
  const slotIds = new Set(slotRows.results.map((row) => row.id));
  const answers = new Map(
    availability.filter((value) => slotIds.has(value.slotId)).map((value) => [value.slotId, value.status]),
  );
  if (answers.size !== slotIds.size) return jsonResponse({ error: "すべての候補に回答してください。" }, 400);

  let responseId: string | null = null;
  let editToken = body?.editToken || "";
  if (editToken) {
    const editTokenHash = await digestSecret(editToken);
    const existing = await db
      .prepare("SELECT id, edit_token_hash FROM responses WHERE event_id = ? AND edit_token_hash = ? LIMIT 1")
      .bind(event.id, editTokenHash)
      .first<{ id: string; edit_token_hash: string }>();
    if (existing && constantTimeEqual(existing.edit_token_hash, editTokenHash)) responseId = existing.id;
  }

  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  if (responseId) {
    statements.push(
      db
        .prepare("UPDATE responses SET name = ?, comment = ?, updated_at = ? WHERE id = ?")
        .bind(name, comment, now, responseId),
      db.prepare("DELETE FROM availability WHERE response_id = ?").bind(responseId),
    );
  } else {
    responseId = crypto.randomUUID();
    editToken = randomToken(28);
    const editTokenHash = await digestSecret(editToken);
    statements.push(
      db
        .prepare(
          "INSERT INTO responses (id, event_id, name, comment, edit_token_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(responseId, event.id, name, comment, editTokenHash, now, now),
    );
  }

  for (const [slotId, status] of answers) {
    statements.push(
      db
        .prepare("INSERT INTO availability (response_id, slot_id, status) VALUES (?, ?, ?)")
        .bind(responseId, slotId, status),
    );
  }
  await db.batch(statements);

  return jsonResponse({ editToken, event: await buildPublicEvent(event) });
}
