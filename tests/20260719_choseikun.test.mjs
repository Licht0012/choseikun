import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("イベント作成画面に必須の入力項目が揃っている", async () => {
  const source = await read("app/components/CreateEventApp.tsx");
  for (const text of ["イベント名", "メモ", "日程候補", "時間帯候補", "入力期限日"]) {
    assert.match(source, new RegExp(text));
  }
  assert.doesNotMatch(source, /合言葉/);
  for (const range of ["10:00", "12:00", "13:00", "15:00", "18:00", "20:00"]) {
    assert.match(source, new RegExp(range));
  }
});

test("公開トップと作成完了画面にLINE連携の使い方が案内されている", async () => {
  const source = await read("app/components/CreateEventApp.tsx");
  for (const text of [
    "調整くんの使い方",
    "調整くんでイベントを作成します",
    "LINE連携コードを発行",
    "表示されたメッセージをLINEグループへ送信します",
    "入力期限日の前日19:00に1回だけ",
  ]) {
    assert.match(source, new RegExp(text));
  }
});

test("土日祝の判定と自由時間帯の検証がAPI側にもある", async () => {
  const [validation, holidays] = await Promise.all([
    read("lib/validation.ts"),
    read("lib/japanese-holidays.ts"),
  ]);
  assert.match(validation, /isSelectableCandidateDate/);
  assert.match(validation, /時間帯/);
  assert.match(holidays, /振替休日/);
  assert.match(holidays, /国民の休日/);
});

test("回答・LINEリマインド・管理者アクセス制御の経路が実装されている", async () => {
  const [responses, reminder, webhook, security] = await Promise.all([
    read("app/api/events/[slug]/responses/route.ts"),
    read("app/api/reminders/run/route.ts"),
    read("app/api/line/webhook/route.ts"),
    read("lib/security.ts"),
  ]);
  assert.match(responses, /availability/);
  assert.match(reminder, /message\/push/);
  assert.match(webhook, /x-line-signature/);
  assert.match(security, /SameSite=Lax/);
});

test("参加者画面とAPIに合言葉の認証処理が残っていない", async () => {
  const [screen, eventRoute, responsesRoute, schema] = await Promise.all([
    read("app/components/EventResponseApp.tsx"),
    read("app/api/events/[slug]/route.ts"),
    read("app/api/events/[slug]/responses/route.ts"),
    read("db/schema.ts"),
  ]);
  for (const source of [screen, eventRoute, responsesRoute, schema]) {
    assert.doesNotMatch(source, /合言葉|accessCode|access_code_hash|hasEventAccess/);
  }
});

test("D1マイグレーションに必要な全テーブルが含まれる", async () => {
  const migration = await read("drizzle/0000_lively_meltdown.sql");
  for (const table of ["events", "candidate_dates", "time_options", "slots", "responses", "availability"]) {
    assert.match(migration, new RegExp("CREATE TABLE `" + table + "`"));
  }
});
