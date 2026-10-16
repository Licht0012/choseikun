"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- vinextでは通常のリンクによる画面遷移を使う。 */

import { FormEvent, useEffect, useMemo, useState } from "react";
import Skeleton from "react-loading-skeleton";
import { BrandHeader } from "@/app/components/BrandHeader";
import { CalendarPicker } from "@/app/components/CalendarPicker";
import { rememberManagedEventToken } from "@/lib/managed-events";
import { FIXED_TIME_OPTIONS, timeOptionKey, timeOptionLabel } from "@/lib/time-options";
import type { PublicEventView, TimeOptionInput } from "@/lib/types";

interface ManageEventAppProps {
  token: string;
}

interface ManagementData {
  shareUrl: string;
  manageUrl: string;
  lineGroupName: string | null;
  lineConnected: boolean;
  reminderSentAt: string | null;
}

interface LineCodeData {
  code: string;
  expiresAt: string;
  command: string;
}

export function ManageEventApp({ token }: ManageEventAppProps) {
  const endpoint = `/api/manage/${encodeURIComponent(token)}`;
  const [event, setEvent] = useState<PublicEventView | null>(null);
  const [management, setManagement] = useState<ManagementData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [name, setName] = useState("");
  const [memo, setMemo] = useState("");
  const [dates, setDates] = useState<string[]>([]);
  const [selectedFixed, setSelectedFixed] = useState<string[]>([]);
  const [customRanges, setCustomRanges] = useState<TimeOptionInput[]>([]);
  const [otherOpen, setOtherOpen] = useState(false);
  const [customStart, setCustomStart] = useState("16:00");
  const [customEnd, setCustomEnd] = useState("17:30");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [lineCode, setLineCode] = useState<LineCodeData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteImpact, setDeleteImpact] = useState<{ slotCount: number; responseCount: number } | null>(null);

  const selectedTimeOptions = useMemo(
    () => [
      ...FIXED_TIME_OPTIONS.filter((range) => selectedFixed.includes(timeOptionKey(range))),
      ...customRanges,
    ],
    [customRanges, selectedFixed],
  );

  useEffect(() => {
    let active = true;
    fetch(endpoint, { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 404) return { missing: true };
        const data = (await response.json()) as { event?: PublicEventView; management?: ManagementData };
        if (!response.ok || !data.event || !data.management) return { missing: true };
        return data;
      })
      .then((data) => {
        if (!active) return;
        if ("missing" in data || !data.event || !data.management) return setState("missing");
        rememberManagedEventToken(token);
        const ranges = Array.from(
          new Map(
            data.event.slots.map((slot) => [
              `${slot.startTime}-${slot.endTime}`,
              { startTime: slot.startTime, endTime: slot.endTime },
            ]),
          ).values(),
        );
        const fixedKeys = new Set(FIXED_TIME_OPTIONS.map(timeOptionKey));
        const custom = ranges.filter((range) => !fixedKeys.has(timeOptionKey(range)));
        setEvent(data.event);
        setManagement(data.management);
        setName(data.event.name);
        setMemo(data.event.memo);
        setDates(Array.from(new Set(data.event.slots.map((slot) => slot.date))).sort());
        setSelectedFixed(ranges.map(timeOptionKey).filter((key) => fixedKeys.has(key)));
        setCustomRanges(custom);
        setOtherOpen(custom.length > 0);
        setDeadlineDate(data.event.deadlineDate);
        setReminderEnabled(data.event.reminderEnabled);
        setState("ready");
      })
      .catch(() => active && setState("missing"));
    return () => {
      active = false;
    };
  }, [endpoint, token]);

  useEffect(() => {
    if (!deleteImpact) return;
    const closeOnEscape = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape" && !saving) setDeleteImpact(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [deleteImpact, saving]);

  const toggleFixedRange = (range: TimeOptionInput) => {
    const key = timeOptionKey(range);
    setSelectedFixed((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);
  };

  const addCustomRange = () => {
    setError("");
    if (!customStart || !customEnd || customStart >= customEnd) {
      return setError("その他の時間帯は、終了時間が開始時間より後になるようにしてください。");
    }
    const key = `${customStart}-${customEnd}`;
    if (selectedTimeOptions.some((range) => timeOptionKey(range) === key)) return setError("同じ時間帯がすでにあります。");
    setCustomRanges((current) => [...current, { startTime: customStart, endTime: customEnd }]);
    setOtherOpen(true);
  };

  const persistChanges = async () => {
    setError("");
    setNotice("");
    if (!event) return;
    setDeleteImpact(null);
    setSaving(true);
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, memo, dates, timeOptions: selectedTimeOptions, deadlineDate, reminderEnabled }),
      });
      const data = (await response.json()) as { error?: string; event?: PublicEventView };
      if (!response.ok) return setError(data.error || "保存できませんでした。");
      if (data.event) setEvent(data.event);
      setNotice("変更を保存しました。");
    } catch {
      setError("通信に失敗しました。時間をおいて、もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  };

  const save = (formEvent: FormEvent) => {
    formEvent.preventDefault();
    setError("");
    setNotice("");
    if (!event) return;
    const selectedDateSet = new Set(dates);
    const selectedTimeSet = new Set(selectedTimeOptions.map(timeOptionKey));
    const removedSlots = event.slots.filter(
      (slot) => !selectedDateSet.has(slot.date) || !selectedTimeSet.has(`${slot.startTime}-${slot.endTime}`),
    );
    const affectedResponses = event.responses.filter((response) =>
      removedSlots.some((slot) => response.availability[slot.id] !== undefined),
    );
    if (affectedResponses.length > 0) {
      setDeleteImpact({ slotCount: removedSlots.length, responseCount: affectedResponses.length });
      return;
    }
    void persistChanges();
  };

  const generateLineCode = async () => {
    setError("");
    const response = await fetch(`${endpoint}/line-code`, { method: "POST" });
    const data = (await response.json()) as LineCodeData & { error?: string };
    if (!response.ok) return setError(data.error || "連携コードを発行できませんでした。");
    setLineCode(data);
  };

  const copy = async (value: string, message: string) => {
    await navigator.clipboard.writeText(value);
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3000);
  };

  if (state === "loading") {
    return <><BrandHeader /><main className="shell manage-shell loading-shell"><Skeleton height={38} width="42%" /><Skeleton height={500} borderRadius={14} style={{ marginTop: 28 }} /></main></>;
  }

  if (state === "missing" || !event || !management) {
    return <><BrandHeader /><main className="shell shell--auth"><section className="auth-panel"><h1>管理ページが見つかりません</h1><p>管理用URLが正しいか確認してください。</p></section></main></>;
  }

  return (
    <>
      <BrandHeader utilityLink={{ label: "イベント履歴", href: "/history" }} />
      <main className="shell manage-shell">
        <div className="manage-heading"><div><h1>イベント管理</h1><p>イベント情報・候補日時の再編集、共有、LINE連携をここで行えます。</p></div><a className="button button--secondary" href={management.shareUrl}>回答画面を確認</a></div>
        <div className="manage-grid">
          <form className="manage-panel" onSubmit={save}>
            <div className="section-title"><h2>イベント設定</h2><p>イベント名・メモ・候補日時・回答期限を変更できます</p></div>
            <label className="field-label" htmlFor="manage-name">イベント名</label>
            <input id="manage-name" value={name} onChange={(formEvent) => setName(formEvent.target.value)} maxLength={100} required />
            <label className="field-label" htmlFor="manage-memo">メモ</label>
            <textarea id="manage-memo" value={memo} onChange={(formEvent) => setMemo(formEvent.target.value)} maxLength={500} rows={4} />

            <div className="manage-schedule-editor">
              <div className="section-title"><h2>日程候補</h2><p>土日・祝日の追加と削除ができます</p></div>
              <CalendarPicker selectedDates={dates} onChange={setDates} />

              <div className="section-title manage-time-heading"><h2>時間帯候補</h2><p>定番の時間帯または自由入力から選べます</p></div>
              <div className="time-option-list">
                {FIXED_TIME_OPTIONS.map((range) => {
                  const checked = selectedFixed.includes(timeOptionKey(range));
                  return (
                    <button type="button" key={timeOptionKey(range)} className={`time-option${checked ? " is-selected" : ""}`} onClick={() => toggleFixedRange(range)} aria-pressed={checked}>
                      <span className="check-box" aria-hidden="true">{checked ? "✓" : ""}</span>{timeOptionLabel(range)}
                    </button>
                  );
                })}
                <button type="button" className={`time-option${otherOpen ? " is-selected" : ""}`} onClick={() => setOtherOpen((current) => !current)} aria-expanded={otherOpen}>
                  <span className="check-box" aria-hidden="true">{otherOpen ? "✓" : ""}</span>その他
                </button>
              </div>
              {otherOpen ? (
                <div className="custom-time-panel">
                  <div className="custom-time-inputs">
                    <label>開始時間<input type="time" value={customStart} onChange={(formEvent) => setCustomStart(formEvent.target.value)} /></label>
                    <span aria-hidden="true">〜</span>
                    <label>終了時間<input type="time" value={customEnd} onChange={(formEvent) => setCustomEnd(formEvent.target.value)} /></label>
                  </div>
                  <button className="button button--small button--secondary" type="button" onClick={addCustomRange}>＋ 追加</button>
                  {customRanges.length > 0 ? (
                    <ul className="custom-time-list">
                      {customRanges.map((range) => (
                        <li key={timeOptionKey(range)}>{timeOptionLabel(range)}<button type="button" onClick={() => setCustomRanges((current) => current.filter((value) => timeOptionKey(value) !== timeOptionKey(range)))} aria-label={`${timeOptionLabel(range)}を削除`}>×</button></li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
              <p className="manage-answer-warning">候補を削除すると、その候補に紐づく参加者の回答も削除されます。追加した候補は既存回答で「未回答」と表示されます。</p>
            </div>

            <label className="field-label" htmlFor="manage-deadline">入力期限日</label>
            <input id="manage-deadline" className="date-input" type="date" max={dates[0]} value={deadlineDate} onChange={(formEvent) => setDeadlineDate(formEvent.target.value)} required />
            <label className="switch-row switch-row--compact">
              <span className="line-symbol" aria-hidden="true">LINE</span>
              <span><strong>前日19:00のリマインド</strong><small>{management.lineConnected ? `${management.lineGroupName || "LINEグループ"}へ送信` : "LINEグループを連携すると有効になります"}</small></span>
              <input type="checkbox" checked={reminderEnabled} onChange={(formEvent) => setReminderEnabled(formEvent.target.checked)} />
              <i aria-hidden="true" />
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button--primary button--wide" type="submit" disabled={saving}>{saving ? "保存中…" : "変更を保存"}</button>
          </form>

          <div className="manage-side">
            <section className="manage-panel">
              <div className="section-title"><h2>参加者へ共有</h2><p>回答用URLをLINEグループへ送ってください</p></div>
              <div className="share-block"><label>参加者用URL</label><div><code>{management.shareUrl}</code><button type="button" onClick={() => copy(management.shareUrl, "参加者用URLをコピーしました。")}>コピー</button></div></div>
              <div className="share-block"><label>主催者用管理URL</label><div><code>{management.manageUrl}</code><button type="button" onClick={() => copy(management.manageUrl, "主催者用管理URLをコピーしました。")}>コピー</button></div></div>
              <p className="security-note">主催者用管理URLはブックマークするなど大切に保管し、参加者には回答用URLだけを共有してください。</p>
            </section>

            <section className="manage-panel line-connect-panel">
              <div className="line-panel-heading"><span className="line-symbol" aria-hidden="true">LINE</span><div><h2>LINEグループ連携</h2><p>締切前日の19:00に自動でお知らせ</p></div></div>
              {management.lineConnected ? (
                <div className="connected-status"><span aria-hidden="true">✓</span><div><strong>連携済み</strong><p>{management.lineGroupName || "LINEグループ"}</p></div></div>
              ) : (
                <>
                  <ol className="connect-steps"><li>調整くんBotを対象のLINEグループに追加</li><li>下の連携コードを発行</li><li>表示されたメッセージをグループへ送信</li></ol>
                  {!lineCode ? <button className="button button--line button--wide" type="button" onClick={generateLineCode}>LINE連携コードを発行</button> : (
                    <div className="line-code-box"><small>30分間有効</small><strong>{lineCode.code}</strong><code>{lineCode.command}</code><button className="button button--line" type="button" onClick={() => copy(lineCode.command, "LINEへ送るメッセージをコピーしました。")}>メッセージをコピー</button></div>
                  )}
                </>
              )}
            </section>

            <section className="manage-panel compact-stats">
              <div><strong>{event.responses.length}</strong><span>回答者</span></div><div><strong>{event.slots.length}</strong><span>候補日時</span></div><div><strong>{event.isOpen ? "受付中" : "締切"}</strong><span>回答状況</span></div>
            </section>
          </div>
        </div>
      </main>
      <footer className="site-footer">© 調整くん</footer>
      {notice && <div className="toast" role="status">{notice}</div>}
      {deleteImpact ? (
        <div
          className="confirm-backdrop"
          role="presentation"
          onMouseDown={(mouseEvent) => {
            if (mouseEvent.target === mouseEvent.currentTarget && !saving) setDeleteImpact(null);
          }}
        >
          <section
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-candidates-title"
            aria-describedby="delete-candidates-description"
          >
            <span className="confirm-dialog__mark" aria-hidden="true">!</span>
            <h2 id="delete-candidates-title">回答がある候補を削除しますか？</h2>
            <p id="delete-candidates-description">
              {deleteImpact.slotCount}件の候補日時を削除すると、
              {deleteImpact.responseCount}人分の紐づく回答も削除されます。この操作は元に戻せません。
            </p>
            <div className="confirm-dialog__actions">
              <button className="button button--secondary" type="button" onClick={() => setDeleteImpact(null)} autoFocus disabled={saving}>
                キャンセル
              </button>
              <button className="button button--danger" type="button" onClick={() => void persistChanges()} disabled={saving}>
                {saving ? "削除して保存中…" : "削除して保存"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
