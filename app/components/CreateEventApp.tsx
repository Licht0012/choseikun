"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Skeleton from "react-loading-skeleton";
import { BrandHeader } from "@/app/components/BrandHeader";
import { CalendarPicker } from "@/app/components/CalendarPicker";
import { addDays, toDateKey } from "@/lib/japanese-holidays";
import type { CreateEventInput, TimeOptionInput } from "@/lib/types";

const fixedRanges: TimeOptionInput[] = [
  { startTime: "10:00", endTime: "12:00" },
  { startTime: "13:00", endTime: "15:00" },
  { startTime: "18:00", endTime: "20:00" },
];

interface CreatedEvent {
  slug: string;
  shareUrl: string;
  manageUrl: string;
  accessCode: string;
}

interface DraftState {
  name: string;
  memo: string;
  dates: string[];
  selectedFixed: string[];
  customRanges: TimeOptionInput[];
  deadlineDate: string;
  accessCode: string;
  reminderEnabled: boolean;
}

const rangeKey = (range: TimeOptionInput) => `${range.startTime}-${range.endTime}`;
const labelForRange = (range: TimeOptionInput) => `${range.startTime}〜${range.endTime}`;

export function CreateEventApp() {
  const [authState, setAuthState] = useState<"loading" | "logged-out" | "logged-in">("loading");
  const [adminPassword, setAdminPassword] = useState("");
  const [name, setName] = useState("");
  const [memo, setMemo] = useState("");
  const [dates, setDates] = useState<string[]>([]);
  const [selectedFixed, setSelectedFixed] = useState(() => fixedRanges.map(rangeKey));
  const [otherOpen, setOtherOpen] = useState(false);
  const [customStart, setCustomStart] = useState("16:00");
  const [customEnd, setCustomEnd] = useState("17:30");
  const [customRanges, setCustomRanges] = useState<TimeOptionInput[]>([]);
  const [deadlineDate, setDeadlineDate] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [showAccessCode, setShowAccessCode] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedEvent | null>(null);

  useEffect(() => {
    fetch("/api/auth", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ authenticated?: boolean }>)
      .then((data) => setAuthState(data.authenticated ? "logged-in" : "logged-out"))
      .catch(() => setAuthState("logged-out"));
  }, []);

  useEffect(() => {
    if (!dates.length || deadlineDate) return;
    const suggested = addDays(dates[0], -2);
    const today = toDateKey(new Date());
    setDeadlineDate(suggested < today ? today : suggested);
  }, [dates, deadlineDate]);

  const selectedTimeOptions = useMemo(
    () => [...fixedRanges.filter((range) => selectedFixed.includes(rangeKey(range))), ...customRanges],
    [customRanges, selectedFixed],
  );

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: adminPassword }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) return setError(data.error || "ログインできませんでした。");
    setAdminPassword("");
    setAuthState("logged-in");
  };

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setAuthState("logged-out");
  };

  const toggleFixedRange = (range: TimeOptionInput) => {
    const key = rangeKey(range);
    setSelectedFixed((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);
  };

  const addCustomRange = () => {
    setError("");
    if (!customStart || !customEnd || customStart >= customEnd) {
      return setError("その他の時間帯は、終了時間が開始時間より後になるようにしてください。");
    }
    const key = `${customStart}-${customEnd}`;
    if (selectedTimeOptions.some((range) => rangeKey(range) === key)) return setError("同じ時間帯がすでにあります。");
    setCustomRanges((current) => [...current, { startTime: customStart, endTime: customEnd }]);
    setOtherOpen(true);
  };

  const saveDraft = () => {
    const draft: DraftState = { name, memo, dates, selectedFixed, customRanges, deadlineDate, accessCode, reminderEnabled };
    localStorage.setItem("choseikun-event-draft", JSON.stringify(draft));
    setNotice("下書きをこの端末に保存しました。");
    window.setTimeout(() => setNotice(""), 3000);
  };

  const loadDraft = () => {
    const stored = localStorage.getItem("choseikun-event-draft");
    if (!stored) return;
    try {
      const draft = JSON.parse(stored) as DraftState;
      setName(draft.name || "");
      setMemo(draft.memo || "");
      setDates(Array.isArray(draft.dates) ? draft.dates : []);
      setSelectedFixed(Array.isArray(draft.selectedFixed) ? draft.selectedFixed : fixedRanges.map(rangeKey));
      setCustomRanges(Array.isArray(draft.customRanges) ? draft.customRanges : []);
      setDeadlineDate(draft.deadlineDate || "");
      setAccessCode(draft.accessCode || "");
      setReminderEnabled(draft.reminderEnabled !== false);
      setNotice("下書きを読み込みました。");
    } catch {
      localStorage.removeItem("choseikun-event-draft");
    }
  };

  useEffect(() => {
    if (authState === "logged-in") loadDraft();
    // 下書きはログイン完了時に一度だけ復元する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    const payload: CreateEventInput = {
      name,
      memo,
      dates,
      timeOptions: selectedTimeOptions,
      deadlineDate,
      accessCode,
      reminderEnabled,
    };
    setSubmitting(true);
    const response = await fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as { error?: string; event?: CreatedEvent };
    setSubmitting(false);
    if (!response.ok || !data.event) return setError(data.error || "イベントを作成できませんでした。");
    localStorage.removeItem("choseikun-event-draft");
    setCreated(data.event);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const copyText = async (value: string, message: string) => {
    await navigator.clipboard.writeText(value);
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3000);
  };

  if (authState === "loading") {
    return (
      <>
        <BrandHeader />
        <main className="shell shell--narrow loading-shell" aria-label="読み込み中">
          <Skeleton height={40} width="48%" />
          <Skeleton height={420} borderRadius={14} style={{ marginTop: 32 }} />
        </main>
      </>
    );
  }

  if (authState === "logged-out") {
    return (
      <>
        <BrandHeader />
        <main className="shell shell--auth">
          <section className="auth-panel">
            <div className="auth-mark" aria-hidden="true">調</div>
            <h1>主催者ログイン</h1>
            <p>イベントを作る方だけが使う管理画面です。</p>
            <form onSubmit={handleLogin}>
              <label className="field-label" htmlFor="admin-password">管理者パスワード</label>
              <input id="admin-password" type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} autoComplete="current-password" required />
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="button button--primary button--wide" type="submit">ログイン</button>
            </form>
          </section>
        </main>
      </>
    );
  }

  if (created) {
    return (
      <>
        <BrandHeader actionLabel="主催者メニュー" onAction={handleLogout} />
        <main className="shell shell--narrow">
          <section className="success-panel">
            <span className="success-check" aria-hidden="true">✓</span>
            <h1>イベントを作成しました</h1>
            <p>参加者にはURLと合言葉を一緒に送ってください。</p>
            <div className="share-block">
              <label>参加者用URL</label>
              <div><code>{created.shareUrl}</code><button type="button" onClick={() => copyText(created.shareUrl, "参加者用URLをコピーしました。")}>コピー</button></div>
            </div>
            <div className="share-block">
              <label>参加者用の合言葉</label>
              <div><code>{created.accessCode}</code><button type="button" onClick={() => copyText(created.accessCode, "合言葉をコピーしました。")}>コピー</button></div>
            </div>
            <div className="success-actions">
              <a className="button button--primary" href={created.manageUrl}>管理画面でLINEを連携</a>
              <a className="button button--secondary" href={created.shareUrl}>回答画面を確認</a>
            </div>
            <p className="security-note">管理画面のURLは主催者専用です。参加者には送らないでください。</p>
          </section>
          {notice && <div className="toast" role="status">{notice}</div>}
        </main>
      </>
    );
  }

  return (
    <>
      <BrandHeader actionLabel="主催者メニュー" onAction={handleLogout} />
      <main className="shell create-shell">
        <div className="page-heading">
          <h1>イベントを作成</h1>
          <ol className="stepper" aria-label="作成手順">
            <li className="is-active"><span>1</span>基本情報</li>
            <li><span>2</span>候補日時</li>
            <li><span>3</span>公開設定</li>
          </ol>
        </div>

        <form className="creation-form" onSubmit={handleCreate}>
          <section className="form-section form-section--basic">
            <label className="field-label" htmlFor="event-name">イベント名</label>
            <div className="input-with-count">
              <input id="event-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="例：秋の懇親会" required />
              <span>{name.length} / 100</span>
            </div>
            <label className="field-label" htmlFor="event-memo">メモ</label>
            <div className="input-with-count">
              <textarea id="event-memo" value={memo} onChange={(event) => setMemo(event.target.value)} maxLength={500} rows={4} placeholder="みんなでゆっくり話せる日を決めましょう" />
              <span>{memo.length} / 500</span>
            </div>
          </section>

          <section className="form-section schedule-section">
            <div className="section-column">
              <div className="section-title"><h2>日程候補</h2><p>土日・祝日のみ選べます</p></div>
              <CalendarPicker selectedDates={dates} onChange={setDates} />
            </div>
            <div className="section-column">
              <div className="section-title"><h2>時間帯候補</h2><p>よく使う時間帯を選ぶか、「その他」で自由に追加できます</p></div>
              <div className="time-option-list">
                {fixedRanges.map((range) => {
                  const checked = selectedFixed.includes(rangeKey(range));
                  return (
                    <button type="button" key={rangeKey(range)} className={`time-option${checked ? " is-selected" : ""}`} onClick={() => toggleFixedRange(range)} aria-pressed={checked}>
                      <span className="check-box" aria-hidden="true">{checked ? "✓" : ""}</span>{labelForRange(range)}
                    </button>
                  );
                })}
                <button type="button" className={`time-option${otherOpen ? " is-selected" : ""}`} onClick={() => setOtherOpen((current) => !current)} aria-expanded={otherOpen}>
                  <span className="check-box" aria-hidden="true">{otherOpen ? "✓" : ""}</span>その他
                </button>
              </div>
              {otherOpen && (
                <div className="custom-time-panel">
                  <div className="custom-time-inputs">
                    <label>開始時間<input type="time" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label>
                    <span aria-hidden="true">〜</span>
                    <label>終了時間<input type="time" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label>
                  </div>
                  <button className="button button--small button--secondary" type="button" onClick={addCustomRange}>＋ 追加</button>
                  {customRanges.length > 0 && (
                    <ul className="custom-time-list">
                      {customRanges.map((range) => (
                        <li key={rangeKey(range)}>{labelForRange(range)}<button type="button" onClick={() => setCustomRanges((current) => current.filter((value) => rangeKey(value) !== rangeKey(range)))} aria-label={`${labelForRange(range)}を削除`}>×</button></li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div className="tip-row"><span aria-hidden="true">💡</span><p>候補日は日付順、時間帯は表示順で並びます</p></div>
            </div>
          </section>

          <section className="form-section publish-section">
            <label className="field-label" htmlFor="deadline-date">入力期限日</label>
            <input id="deadline-date" className="date-input" type="date" min={toDateKey(new Date())} max={dates[0]} value={deadlineDate} onChange={(event) => setDeadlineDate(event.target.value)} required />
            <p className="field-help">締切日の前日19:00にLINEでお知らせ</p>
            <label className="switch-row">
              <span className="line-symbol" aria-hidden="true">LINE</span>
              <span><strong>LINEでのお知らせ</strong><small>期限の前日に、連携したグループへリマインドを送信します</small></span>
              <input type="checkbox" checked={reminderEnabled} onChange={(event) => setReminderEnabled(event.target.checked)} />
              <i aria-hidden="true" />
            </label>

            <label className="field-label" htmlFor="access-code">参加者用の合言葉</label>
            <div className="password-input">
              <input id="access-code" type={showAccessCode ? "text" : "password"} value={accessCode} onChange={(event) => setAccessCode(event.target.value)} maxLength={64} placeholder="4文字以上" autoComplete="new-password" required />
              <button type="button" onClick={() => setShowAccessCode((current) => !current)}>{showAccessCode ? "隠す" : "表示"}</button>
            </div>
            <p className="field-help">参加者がイベントを開くときに必要になります</p>
          </section>

          {error && <p className="form-error form-error--wide" role="alert">{error}</p>}
          <div className="form-actions">
            <button className="button button--secondary" type="button" onClick={saveDraft}>▧ 下書きを保存</button>
            <button className="button button--primary" type="submit" disabled={submitting}>{submitting ? "作成中…" : "イベントを作成"}</button>
          </div>
        </form>
      </main>
      <footer className="site-footer">© 調整くん</footer>
      {notice && <div className="toast" role="status">{notice}</div>}
    </>
  );
}
