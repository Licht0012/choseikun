import { getBindings, getDb } from "@/db";
import { buildPublicEvent, findEventBySlug } from "@/lib/event-data";
import { digestSecret, randomToken } from "@/lib/security";
import { MEMBERS, TIMES, HOLIDAY_URL, targetMonth, parseHolidays, candidateDates, complete, selectCandidates, resultText } from "./20261101_monthly-rules";

import { monthlySchedule, deadlineText } from "./20261102_monthly-schedule";

export async function monthlyError(kind: string, error: unknown, eventId: string | null = null) {
  console.error("Monthly automation", kind, error instanceof Error ? error.message : "failure");
  const db = await getDb();
  await db.prepare("INSERT INTO monthly_errors (id,event_id,kind,message,created_at) VALUES (?,?,?,?,?)")
    .bind(crypto.randomUUID(), eventId, kind, String(error instanceof Error ? error.message : error).slice(0, 1000), new Date().toISOString()).run();
}
export async function monthlyInfo(eventId: string) {
  return (await getDb()).prepare("SELECT target_month,created_month FROM monthly_events WHERE event_id = ?").bind(eventId)
    .first<{target_month: string; created_month: string}>();
}
export async function enqueue(eventId: string, kind: string, text: string) {
  const db = await getDb();
  // Every possible monthly result fits in one LINE text (maximum 31 days × 3 slots).
  if (text.length > 5000) throw new Error("LINE本文が上限を超えています");
  await db.prepare(`INSERT OR IGNORE INTO monthly_notifications
    (id,event_id,kind,payload,retry_key,created_at) VALUES (?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(), eventId, kind, text, crypto.randomUUID(), new Date().toISOString()).run();
}
export async function enqueueFinal(eventId: string, slug: string) {
  const info = await monthlyInfo(eventId);
  if (!info || !monthlySchedule(info.target_month)) return;
  const record = await findEventBySlug(slug);
  if (!record) return;
  const view = await buildPublicEvent(record);
  if (complete(view.slots, view.responses)) await enqueue(eventId, "final", resultText(selectCandidates(view.slots, view.responses)));
}
async function holidaysFor(year: number): Promise<{csv: string; dates: Set<string>}> {
  const db = await getDb();
  try {
    const response = await fetch(HOLIDAY_URL, {signal: AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error(`祝日取得 HTTP ${response.status}`);
    const bytes = await response.arrayBuffer();
    const csv = new TextDecoder("shift_jis").decode(bytes);
    const dates = parseHolidays(csv, year);
    await db.prepare("INSERT OR REPLACE INTO monthly_settings(key,value) VALUES ('holiday_csv',?)").bind(csv).run();
    return {csv, dates};
  } catch (error) {
    await monthlyError("holidays", error);
    const cached = await db.prepare("SELECT value FROM monthly_settings WHERE key = 'holiday_csv'").first<{value: string}>();
    if (!cached) throw error;
    return {csv: cached.value, dates: parseHolidays(cached.value, year)};
  }
}
export async function prepareMonthly(month: string, now = new Date(), groupId: string | null = null): Promise<{slug:string;adminToken:string | null}> {
  const schedule = monthlySchedule(month);
  if (!schedule) throw new Error("対象月を確認してください");
  const db = await getDb();
  const existing = await db.prepare("SELECT e.slug FROM monthly_events m JOIN events e ON e.id=m.event_id WHERE m.target_month=?").bind(month).first<{slug:string}>();
  if (existing) return {slug:existing.slug,adminToken:null};
  const {csv, dates: holidays} = await holidaysFor(Number(month.slice(0,4)));
  const dates = candidateDates(month, holidays);
  if (!dates.length) throw new Error("候補日がありません");
  const id = crypto.randomUUID(), slug = randomToken(15), stamp = now.toISOString();
  const createdMonth = schedule.publishAt.slice(0,7);
  const adminToken = randomToken(32);
  const statements = [db.prepare(`INSERT INTO events
    (id,slug,name,memo,deadline_date,admin_token_hash,line_group_id,reminder_enabled,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(id,slug,`${month.slice(0,4)}年${Number(month.slice(5))}月`, "固定メンバー6人で回答してください。",schedule.deadlineAt.slice(0,10),await digestSecret(adminToken),groupId,0,stamp,stamp),
    db.prepare("INSERT INTO monthly_events(event_id,target_month,created_month,holiday_csv,created_at) VALUES (?,?,?,?,?)").bind(id,month,createdMonth,csv,stamp)];
  const timeIds = TIMES.map(() => crypto.randomUUID());
  TIMES.forEach(([start,end],i) => statements.push(db.prepare("INSERT INTO time_options(id,event_id,start_time,end_time,label,sort_order) VALUES (?,?,?,?,?,?)").bind(timeIds[i],id,start,end,`${start}〜${end}`,i)));
  dates.forEach((date,i) => {
    const dateId = crypto.randomUUID();
    statements.push(db.prepare("INSERT INTO candidate_dates(id,event_id,date,sort_order) VALUES (?,?,?,?)").bind(dateId,id,date,i));
    timeIds.forEach((timeId,j) => statements.push(db.prepare("INSERT INTO slots(id,event_id,candidate_date_id,time_option_id,sort_order) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),id,dateId,timeId,i*3+j)));
  });
  for (const [i,name] of MEMBERS.entries()) statements.push(db.prepare("INSERT INTO responses(id,event_id,name,comment,edit_token_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(),id,name,"",await digestSecret(randomToken(32)),new Date(now.getTime()+i).toISOString(),stamp));
  try { await db.batch(statements); }
  catch (error) {
    if (!await db.prepare("SELECT event_id FROM monthly_events WHERE target_month = ?").bind(month).first()) throw error;
    return prepareMonthly(month,now,groupId);
  }
  return {slug,adminToken};
}
interface Pending {target_month:string; id: string; event_id: string; kind: string; payload: string; retry_key: string; first_attempt_at: string | null; attempts: number}
export async function deliverMonthly(now = new Date()) {
  const bindings = getBindings();
  if (bindings.MONTHLY_ENABLED !== "true" || !/^C[0-9a-f]{32}$/.test(bindings.MONTHLY_LINE_GROUP_ID || "") || !bindings.LINE_CHANNEL_ACCESS_TOKEN) return;
  const db = await getDb(), stamp = now.toISOString();
  const left = await db.prepare("SELECT value FROM monthly_settings WHERE key = 'group_left'").first<{value: string}>();
  if (left?.value === bindings.MONTHLY_LINE_GROUP_ID) return;
  const pending = await db.prepare(`SELECT n.*,m.target_month FROM monthly_notifications n
    JOIN monthly_events m ON m.event_id=n.event_id JOIN events e ON e.id=n.event_id
    WHERE e.line_group_id=? AND n.sent_at IS NULL AND n.blocked=0
    AND (n.next_attempt_at IS NULL OR n.next_attempt_at<=?) AND (n.lease_until IS NULL OR n.lease_until<?)
    ORDER BY CASE n.kind WHEN 'created' THEN 0 ELSE 1 END,n.created_at,n.rowid LIMIT 12`).bind(bindings.MONTHLY_LINE_GROUP_ID,stamp,stamp).all<Pending>();
  for (const item of pending.results) {
    const schedule = monthlySchedule(item.target_month);
    if (!schedule || now.getTime() < Date.parse(schedule.publishAt)) continue;
    // Stop before LINE's 24-hour deduplication guarantee expires. Never change retry keys.
    if (item.first_attempt_at && now.getTime()-Date.parse(item.first_attempt_at) >= 23*3600000) {
      await db.prepare("UPDATE monthly_notifications SET blocked = 1 WHERE id = ?").bind(item.id).run();
      await monthlyError("retry_expired", "LINE再試行期限切れ。送達状況の確認が必要です。", item.event_id); continue;
    }
    const owner = crypto.randomUUID();
    const claim = await db.prepare(`UPDATE monthly_notifications SET lease_until=?,lease_owner=?,first_attempt_at=COALESCE(first_attempt_at,?),attempts=attempts+1
      WHERE id=? AND sent_at IS NULL AND blocked=0 AND (lease_until IS NULL OR lease_until < ?)`)
      .bind(new Date(now.getTime()+120000).toISOString(),owner,stamp,item.id,stamp).run();
    if (!claim.meta.changes) continue;
    try {
      if (item.kind === "reminder") {
        const page = await db.prepare("SELECT slug FROM events WHERE id=?").bind(item.event_id).first<{slug:string}>();
        const record = page && await findEventBySlug(page.slug);
        const view = record && await buildPublicEvent(record);
        if ((view && complete(view.slots,view.responses)) || now.getTime() >= Date.parse(schedule.deadlineAt)) {
          await db.prepare("UPDATE monthly_notifications SET blocked=1,lease_until=NULL WHERE id=? AND lease_owner=?").bind(item.id,owner).run(); continue;
        }
      }
      // A formal result takes precedence over a not-yet-sent provisional result.
      if (item.kind === "provisional" && await db.prepare("SELECT id FROM monthly_notifications WHERE event_id=? AND kind='final'").bind(item.event_id).first()) {
        await db.prepare("UPDATE monthly_notifications SET blocked=1,lease_until=NULL WHERE id=? AND lease_owner=?").bind(item.id,owner).run(); continue;
      }
      const response = await fetch("https://api.line.me/v2/bot/message/push", {
        method:"POST", signal: AbortSignal.timeout(20000),
        headers:{"content-type":"application/json",authorization:`Bearer ${bindings.LINE_CHANNEL_ACCESS_TOKEN}`,"X-Line-Retry-Key":item.retry_key},
        body:JSON.stringify({to:bindings.MONTHLY_LINE_GROUP_ID,messages:[{type:"text",text:item.payload}]}),
      });
      if (response.ok || (response.status === 409 && response.headers.has("x-line-accepted-request-id"))) {
        await db.prepare("UPDATE monthly_notifications SET sent_at=?,lease_until=NULL WHERE id=? AND lease_owner=?").bind(new Date().toISOString(),item.id,owner).run();
      } else throw new Error(`LINE HTTP ${response.status}`);
    } catch (error) {
      await monthlyError("line_send",error,item.event_id);
      const delay = Math.min(3600000,60000*2**Math.min(item.attempts,6));
      await db.prepare("UPDATE monthly_notifications SET lease_until=NULL,next_attempt_at=? WHERE id=? AND lease_owner=?")
        .bind(new Date(now.getTime()+delay).toISOString(),item.id,owner).run();
    }
  }
}
export async function runMonthly(now = new Date()) {
  const bindings = getBindings();
  if (bindings.MONTHLY_ENABLED !== "true") return;
  if (!/^C[0-9a-f]{32}$/.test(bindings.MONTHLY_LINE_GROUP_ID || "") || !/^https:\/\//.test(bindings.PUBLIC_BASE_URL || "")) {
    await monthlyError("configuration","MONTHLY_LINE_GROUP_ID / PUBLIC_BASE_URL を確認してください"); return;
  }
  try {
    const months = new Set([targetMonth(now)]);
    if (bindings.MONTHLY_FIRST_TARGET_MONTH) months.add(bindings.MONTHLY_FIRST_TARGET_MONTH);
    for (const month of months) {
      const schedule = monthlySchedule(month);
      if (schedule && now.getTime() >= Date.parse(schedule.publishAt) && now.getTime() < Date.parse(schedule.deadlineAt)) {
        try { await prepareMonthly(month,now,bindings.MONTHLY_LINE_GROUP_ID!); }
        catch (error) { await monthlyError("generation",error); }
      }
    }
    const db = await getDb();
    const pages = await db.prepare("SELECT m.*,e.slug FROM monthly_events m JOIN events e ON e.id=m.event_id WHERE e.line_group_id=? ORDER BY m.created_at")
      .bind(bindings.MONTHLY_LINE_GROUP_ID).all<{event_id:string;target_month:string;created_month:string;slug:string}>();
    for (const page of pages.results) {
      const schedule = monthlySchedule(page.target_month);
      if (!schedule || now.getTime() < Date.parse(schedule.publishAt)) continue;
      const record = await findEventBySlug(page.slug);
      if (!record) continue;
      const view = await buildPublicEvent(record), done = complete(view.slots,view.responses);
      const url = `${bindings.PUBLIC_BASE_URL!.replace(/\/$/,"")}/e/${page.slug}`;
      const label = `${page.target_month.slice(0,4)}年${page.target_month.slice(5)}月`;
      const deadline = deadlineText(schedule);
      await enqueue(page.event_id,"created",`【調整くん】\n\n${label}の練習日程調整をお願いします！\n\n以下のURLから、参加できる日時を○△×で入力してください。\n\n【日程調整ページ】\n${url}\n\n【回答期限】\n${deadline}まで\n\n全員の回答が揃い次第、候補日をお知らせします。`);
      if (done) await enqueue(page.event_id,"final",resultText(selectCandidates(view.slots,view.responses)));
      if (!done && now.getTime() >= Date.parse(schedule.reminderAt) && now.getTime() < Date.parse(schedule.deadlineAt)) {
        await enqueue(page.event_id,"reminder",`【調整くん】\n\n${label}の練習日程について、まだ全員の回答が揃っていません。\n\n回答期限は${deadline}です！\n\n未回答の方は、以下から入力をお願いします。\n\n${url}`);
      }
      if (!done && now.getTime() >= Date.parse(schedule.deadlineAt)) await enqueue(page.event_id,"provisional",resultText(selectCandidates(view.slots,view.responses),true));
    }
  } catch (error) { await monthlyError("scheduled",error); }
  await deliverMonthly(now);
}
