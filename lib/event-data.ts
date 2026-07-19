import { getDb } from "@/db";
import { digestSecret, eventCookieName, readCookie, verifySignedToken } from "@/lib/security";
import type { AvailabilityStatus, PublicEventView, ResponseView, SlotView } from "@/lib/types";
import { isResponseOpen } from "@/lib/validation";

export interface EventRecord {
  id: string;
  slug: string;
  name: string;
  memo: string;
  deadline_date: string;
  access_code_hash: string;
  admin_token_hash: string;
  line_group_id: string | null;
  line_group_name: string | null;
  line_link_code_hash: string | null;
  line_link_expires_at: string | null;
  reminder_enabled: number;
  reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function findEventBySlug(slug: string): Promise<EventRecord | null> {
  const db = await getDb();
  return (
    (await db.prepare("SELECT * FROM events WHERE slug = ? LIMIT 1").bind(slug).first<EventRecord>()) || null
  );
}

export async function findEventByAdminToken(token: string): Promise<EventRecord | null> {
  const tokenHash = await digestSecret(token);
  const db = await getDb();
  return (
    (await db.prepare("SELECT * FROM events WHERE admin_token_hash = ? LIMIT 1").bind(tokenHash).first<EventRecord>()) ||
    null
  );
}

export async function hasEventAccess(request: Request, event: EventRecord): Promise<boolean> {
  return verifySignedToken(readCookie(request, eventCookieName(event.slug)), `event:${event.id}`);
}

export async function buildPublicEvent(event: EventRecord): Promise<PublicEventView> {
  const db = await getDb();
  const [slotResult, responseResult, availabilityResult] = await Promise.all([
    db
      .prepare(
        `SELECT s.id, d.date, t.start_time, t.end_time, t.label, s.sort_order
         FROM slots s
         JOIN candidate_dates d ON d.id = s.candidate_date_id
         JOIN time_options t ON t.id = s.time_option_id
         WHERE s.event_id = ?
         ORDER BY s.sort_order ASC`,
      )
      .bind(event.id)
      .all<{ id: string; date: string; start_time: string; end_time: string; label: string; sort_order: number }>(),
    db
      .prepare(
        `SELECT id, name, comment, updated_at
         FROM responses
         WHERE event_id = ?
         ORDER BY created_at ASC`,
      )
      .bind(event.id)
      .all<{ id: string; name: string; comment: string; updated_at: string }>(),
    db
      .prepare(
        `SELECT a.response_id, a.slot_id, a.status
         FROM availability a
         JOIN responses r ON r.id = a.response_id
         WHERE r.event_id = ?`,
      )
      .bind(event.id)
      .all<{ response_id: string; slot_id: string; status: AvailabilityStatus }>(),
  ]);

  const slots: SlotView[] = slotResult.results.map((row) => ({
    id: row.id,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    label: row.label,
    sortOrder: row.sort_order,
  }));
  const availabilityByResponse = new Map<string, Record<string, AvailabilityStatus>>();
  for (const row of availabilityResult.results) {
    const values = availabilityByResponse.get(row.response_id) || {};
    values[row.slot_id] = row.status;
    availabilityByResponse.set(row.response_id, values);
  }
  const responses: ResponseView[] = responseResult.results.map((row) => ({
    id: row.id,
    name: row.name,
    comment: row.comment,
    availability: availabilityByResponse.get(row.id) || {},
    updatedAt: row.updated_at,
  }));

  return {
    id: event.id,
    slug: event.slug,
    name: event.name,
    memo: event.memo,
    deadlineDate: event.deadline_date,
    reminderEnabled: event.reminder_enabled === 1,
    lineConnected: Boolean(event.line_group_id),
    isOpen: isResponseOpen(event.deadline_date),
    slots,
    responses,
  };
}
