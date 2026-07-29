import { getDb } from "@/db";
import type { EventRecord } from "@/lib/event-data";
import type { CreateEventInput } from "@/lib/types";

interface DateRow {
  id: string;
  date: string;
  sort_order: number;
}

interface TimeRow {
  id: string;
  start_time: string;
  end_time: string;
  sort_order: number;
}

interface SlotRow {
  id: string;
  candidate_date_id: string;
  time_option_id: string;
  sort_order: number;
}

export async function updateEventConfiguration(event: EventRecord, input: CreateEventInput): Promise<void> {
  const db = await getDb();
  const [dateResult, timeResult, slotResult] = await Promise.all([
    db
      .prepare("SELECT id, date, sort_order FROM candidate_dates WHERE event_id = ? ORDER BY sort_order")
      .bind(event.id)
      .all<DateRow>(),
    db
      .prepare(
        "SELECT id, start_time, end_time, sort_order FROM time_options WHERE event_id = ? ORDER BY sort_order",
      )
      .bind(event.id)
      .all<TimeRow>(),
    db
      .prepare(
        "SELECT id, candidate_date_id, time_option_id, sort_order FROM slots WHERE event_id = ? ORDER BY sort_order",
      )
      .bind(event.id)
      .all<SlotRow>(),
  ]);

  const existingDates = new Map(dateResult.results.map((row) => [row.date, row]));
  const existingTimes = new Map(timeResult.results.map((row) => [`${row.start_time}-${row.end_time}`, row]));
  const desiredDates = input.dates.map((date, sortOrder) => ({
    id: existingDates.get(date)?.id || crypto.randomUUID(),
    date,
    sortOrder,
  }));
  const desiredTimes = input.timeOptions.map((option, sortOrder) => ({
    id: existingTimes.get(`${option.startTime}-${option.endTime}`)?.id || crypto.randomUUID(),
    startTime: option.startTime,
    endTime: option.endTime,
    sortOrder,
  }));
  const desiredDateIds = new Set(desiredDates.map((row) => row.id));
  const desiredTimeIds = new Set(desiredTimes.map((row) => row.id));
  const existingSlots = new Map(
    slotResult.results.map((row) => [`${row.candidate_date_id}:${row.time_option_id}`, row]),
  );
  const desiredSlotKeys = new Set<string>();
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
        input.name,
        input.memo || "",
        input.deadlineDate,
        input.reminderEnabled === false ? 0 : 1,
        input.deadlineDate,
        new Date().toISOString(),
        event.id,
      ),
  ];

  for (const row of desiredDates) {
    const existing = existingDates.get(row.date);
    statements.push(
      existing
        ? db.prepare("UPDATE candidate_dates SET sort_order = ? WHERE id = ?").bind(row.sortOrder, row.id)
        : db
            .prepare("INSERT INTO candidate_dates (id, event_id, date, sort_order) VALUES (?, ?, ?, ?)")
            .bind(row.id, event.id, row.date, row.sortOrder),
    );
  }

  for (const row of desiredTimes) {
    const existing = existingTimes.get(`${row.startTime}-${row.endTime}`);
    statements.push(
      existing
        ? db.prepare("UPDATE time_options SET sort_order = ? WHERE id = ?").bind(row.sortOrder, row.id)
        : db
            .prepare(
              "INSERT INTO time_options (id, event_id, start_time, end_time, label, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
            )
            .bind(row.id, event.id, row.startTime, row.endTime, `${row.startTime}〜${row.endTime}`, row.sortOrder),
    );
  }

  let slotOrder = 0;
  for (const date of desiredDates) {
    for (const time of desiredTimes) {
      const key = `${date.id}:${time.id}`;
      desiredSlotKeys.add(key);
      const existing = existingSlots.get(key);
      statements.push(
        existing
          ? db.prepare("UPDATE slots SET sort_order = ? WHERE id = ?").bind(slotOrder, existing.id)
          : db
              .prepare(
                "INSERT INTO slots (id, event_id, candidate_date_id, time_option_id, sort_order) VALUES (?, ?, ?, ?, ?)",
              )
              .bind(crypto.randomUUID(), event.id, date.id, time.id, slotOrder),
      );
      slotOrder += 1;
    }
  }

  for (const row of slotResult.results) {
    if (desiredSlotKeys.has(`${row.candidate_date_id}:${row.time_option_id}`)) continue;
    statements.push(db.prepare("DELETE FROM availability WHERE slot_id = ?").bind(row.id));
    statements.push(db.prepare("DELETE FROM slots WHERE id = ?").bind(row.id));
  }

  for (const row of dateResult.results) {
    if (!desiredDateIds.has(row.id)) statements.push(db.prepare("DELETE FROM candidate_dates WHERE id = ?").bind(row.id));
  }
  for (const row of timeResult.results) {
    if (!desiredTimeIds.has(row.id)) statements.push(db.prepare("DELETE FROM time_options WHERE id = ?").bind(row.id));
  }

  await db.batch(statements);
}
