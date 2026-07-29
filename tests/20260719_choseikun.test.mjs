import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("イベント作成画面に必須の入力項目が揃っている", async () => {
  const [source, timeOptions] = await Promise.all([
    read("app/components/CreateEventApp.tsx"),
    read("lib/time-options.ts"),
  ]);
  for (const text of ["イベント名", "メモ", "日程候補", "時間帯候補", "入力期限日"]) {
    assert.match(source, new RegExp(text));
  }
  assert.doesNotMatch(source, /合言葉/);
  for (const range of ["10:00", "12:00", "13:00", "15:00", "18:00", "20:00"]) {
    assert.match(timeOptions, new RegExp(range));
  }
});

test("作成者がイベント履歴からイベント名と候補日時を再編集できる", async () => {
  const [history, historyApi, manage, manageApi, editor] = await Promise.all([
    read("app/components/EventHistoryApp.tsx"),
    read("app/api/events/route.ts"),
    read("app/components/ManageEventApp.tsx"),
    read("app/api/manage/event/[slug]/route.ts"),
    read("lib/event-editor.ts"),
  ]);
  assert.match(history, /イベント履歴/);
  assert.match(history, /再編集する/);
  assert.match(historyApi, /isAdminRequest/);
  assert.match(historyApi, /manageUrl/);
  for (const text of ["イベント名", "日程候補", "時間帯候補", "変更を保存"]) {
    assert.match(manage, new RegExp(text));
  }
  assert.match(manage, /回答がある候補を削除しますか/);
  assert.match(manageApi, /updateEventConfiguration/);
  assert.match(editor, /existingDates/);
  assert.match(editor, /existingTimes/);
  assert.match(editor, /existingSlots/);
  assert.match(editor, /DELETE FROM availability WHERE slot_id/);
});

test("調整くんのブランド書体が専用の文字組みで適用される", async () => {
  const [header, css] = await Promise.all([
    read("app/components/BrandHeader.tsx"),
    read("app/globals.css"),
  ]);
  assert.match(header, /brand-main/);
  assert.match(header, /brand-kun/);
  assert.match(css, /@font-face/);
  assert.match(css, /20260720_mochiy-pop-one-choseikun\.woff2/);
  assert.match(css, /\.brand-kun/);
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

test("共有用の使い方スライドに主要な操作とリマインド仕様が含まれる", async () => {
  const [page, slides, header, css] = await Promise.all([
    read("app/guide/page.tsx"),
    read("app/components/UsageSlidesApp.tsx"),
    read("app/components/BrandHeader.tsx"),
    read("app/globals.css"),
  ]);
  assert.match(page, /UsageSlidesApp/);
  for (const text of [
    "候補日時と入力期限日",
    "回答用URL",
    "○・△・×",
    "LINE連携コードを発行",
    "締切前日19:00に1回だけ",
  ]) {
    assert.match(slides, new RegExp(text));
  }
  assert.match(slides, /const slideCount = 7/);
  assert.doesNotMatch(slides, /READY|まずはイベントを/);
  assert.match(header, /href="\/guide"/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.guide-deck/);
});

test("320px幅でも管理・回答・作成画面がはみ出さないための指定がある", async () => {
  const css = await read("app/globals.css");
  assert.match(css, /\.manage-grid > \*,[\s\S]*?min-width: 0/);
  assert.match(css, /\.line-symbol \{[\s\S]*?flex: 0 0 42px/);
  assert.match(css, /\.answer-actions \{[\s\S]*?position: static/);
  assert.match(css, /@media \(max-width: 360px\)[\s\S]*?\.form-actions \.button/);
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
