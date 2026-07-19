import { getDb } from "@/db";
import { absoluteBaseUrl, jsonResponse, readJson } from "@/lib/http";
import { digestSecret, isAdminRequest, randomToken } from "@/lib/security";
import type { CreateEventInput } from "@/lib/types";
import { validateCreateEvent } from "@/lib/validation";

function createSlug(): string {
  return randomToken(9).replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 12);
}

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) {
    return jsonResponse({ error: "管理者としてログインしてください。" }, 401);
  }

  const validation = validateCreateEvent(await readJson<CreateEventInput>(request));
  if (!validation.value) return jsonResponse({ error: validation.error }, 400);
  const input = validation.value;
  const db = await getDb();
  const eventId = crypto.randomUUID();
  const slug = createSlug();
  const adminToken = randomToken(32);
  const now = new Date().toISOString();
  const adminTokenHash = await digestSecret(adminToken);

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO events (
          id, slug, name, memo, deadline_date, admin_token_hash,
          reminder_enabled, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        eventId,
        slug,
        input.name,
        input.memo || "",
        input.deadlineDate,
        adminTokenHash,
        input.reminderEnabled === false ? 0 : 1,
        now,
        now,
      ),
  ];

  const dateIds = input.dates.map(() => crypto.randomUUID());
  input.dates.forEach((date, index) => {
    statements.push(
      db
        .prepare("INSERT INTO candidate_dates (id, event_id, date, sort_order) VALUES (?, ?, ?, ?)")
        .bind(dateIds[index], eventId, date, index),
    );
  });

  const timeOptionIds = input.timeOptions.map(() => crypto.randomUUID());
  input.timeOptions.forEach((option, index) => {
    statements.push(
      db
        .prepare(
          "INSERT INTO time_options (id, event_id, start_time, end_time, label, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(
          timeOptionIds[index],
          eventId,
          option.startTime,
          option.endTime,
          `${option.startTime}〜${option.endTime}`,
          index,
        ),
    );
  });

  let slotOrder = 0;
  dateIds.forEach((dateId) => {
    timeOptionIds.forEach((timeOptionId) => {
      statements.push(
        db
          .prepare(
            "INSERT INTO slots (id, event_id, candidate_date_id, time_option_id, sort_order) VALUES (?, ?, ?, ?, ?)",
          )
          .bind(crypto.randomUUID(), eventId, dateId, timeOptionId, slotOrder),
      );
      slotOrder += 1;
    });
  });

  try {
    await db.batch(statements);
  } catch (error) {
    console.error("Failed to create event", error);
    return jsonResponse({ error: "イベントを作成できませんでした。もう一度お試しください。" }, 500);
  }

  const baseUrl = absoluteBaseUrl(request);
  return jsonResponse(
    {
      event: {
        slug,
        shareUrl: `${baseUrl}/e/${slug}`,
        manageUrl: `${baseUrl}/manage/${adminToken}`,
      },
    },
    201,
  );
}
