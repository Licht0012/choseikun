import { getDb } from "@/db";
import type { EventRecord } from "./event-data";
import { buildPublicEvent } from "./event-data";
import { jsonResponse } from "./http";
import { MEMBERS } from "./20261101_monthly-rules";
import { enqueueFinal, deliverMonthly, monthlyError } from "./20261101_monthly-automation";

export async function saveMonthlyResponse(event: EventRecord, body: unknown) {
  if (!body || typeof body !== "object") return jsonResponse({error:"入力内容を確認してください。"},400);
  const input = body as {name?:unknown;comment?:unknown;availability?:unknown;updatedAt?:unknown};
  if (typeof input.name !== "string" || !MEMBERS.some(name => name === input.name) || typeof input.comment !== "string" || [...input.comment].length > 300 || !Array.isArray(input.availability)) return jsonResponse({error:"名前・コメント・回答を確認してください。"},400);
  const db = await getDb();
  const response = await db.prepare("SELECT id,updated_at FROM responses WHERE event_id=? AND name=?").bind(event.id,input.name).first<{id:string;updated_at:string}>();
  if (!response || input.updatedAt !== response.updated_at) return jsonResponse({error:"他の操作で回答が更新されました。再読み込みしてください。"},409);
  const slots = await db.prepare("SELECT id FROM slots WHERE event_id=?").bind(event.id).all<{id:string}>();
  const allowed = new Set(slots.results.map(s => s.id));
  const answers = new Map<string,string>();
  for (const raw of input.availability) {
    if (!raw || typeof raw !== "object") return jsonResponse({error:"不正な回答です。"},400);
    const value = raw as {slotId?:unknown;status?:unknown};
    if (typeof value.slotId !== "string" || !allowed.has(value.slotId) || answers.has(value.slotId) || typeof value.status !== "string" || !["yes","maybe","no"].includes(value.status)) return jsonResponse({error:"不正な回答です。"},400);
    answers.set(value.slotId,value.status);
  }
  // Guard every statement using a unique version. The batch is atomic in D1.
  const version = new Date().toISOString()+":"+crypto.randomUUID();
  const statements = [db.prepare("UPDATE responses SET comment=?,updated_at=? WHERE id=? AND updated_at=?")
    .bind(input.comment,version,response.id,response.updated_at),
    db.prepare("DELETE FROM availability WHERE response_id=? AND EXISTS(SELECT 1 FROM responses WHERE id=? AND updated_at=?)").bind(response.id,response.id,version)];
  for (const [slot,status] of answers) statements.push(db.prepare("INSERT INTO availability(response_id,slot_id,status) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM responses WHERE id=? AND updated_at=?)").bind(response.id,slot,status,response.id,version));
  const results = await db.batch(statements);
  if (!results[0].meta.changes) return jsonResponse({error:"他の操作で回答が更新されました。再読み込みしてください。"},409);
  try { await enqueueFinal(event.id,event.slug); await deliverMonthly(); }
  catch (error) { await monthlyError("after_response",error,event.id); }
  return jsonResponse({saved:true,event:await buildPublicEvent(event)});
}
