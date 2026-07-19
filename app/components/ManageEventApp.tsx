"use client";

import { FormEvent, useEffect, useState } from "react";
import Skeleton from "react-loading-skeleton";
import { BrandHeader } from "@/app/components/BrandHeader";
import type { PublicEventView } from "@/lib/types";

interface ManageEventAppProps {
  token: string;
}

interface ManagementData {
  shareUrl: string;
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
  const [event, setEvent] = useState<PublicEventView | null>(null);
  const [management, setManagement] = useState<ManagementData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [name, setName] = useState("");
  const [memo, setMemo] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [newAccessCode, setNewAccessCode] = useState("");
  const [lineCode, setLineCode] = useState<LineCodeData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const response = await fetch(`/api/manage/${encodeURIComponent(token)}`, { cache: "no-store" });
    if (response.status === 404) return setState("missing");
    const data = (await response.json()) as { event?: PublicEventView; management?: ManagementData };
    if (!response.ok || !data.event || !data.management) return setState("missing");
    setEvent(data.event);
    setManagement(data.management);
    setName(data.event.name);
    setMemo(data.event.memo);
    setDeadlineDate(data.event.deadlineDate);
    setReminderEnabled(data.event.reminderEnabled);
    setState("ready");
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const save = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    const response = await fetch(`/api/manage/${encodeURIComponent(token)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, memo, deadlineDate, reminderEnabled, accessCode: newAccessCode || undefined }),
    });
    const data = (await response.json()) as { error?: string; event?: PublicEventView };
    setSaving(false);
    if (!response.ok) return setError(data.error || "保存できませんでした。");
    if (data.event) setEvent(data.event);
    setNewAccessCode("");
    setNotice("変更を保存しました。");
  };

  const generateLineCode = async () => {
    setError("");
    const response = await fetch(`/api/manage/${encodeURIComponent(token)}/line-code`, { method: "POST" });
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
      <BrandHeader />
      <main className="shell manage-shell">
        <div className="manage-heading"><div><h1>イベント管理</h1><p>参加者への共有、期限変更、LINE連携をここで行えます。</p></div><a className="button button--secondary" href={management.shareUrl}>回答画面を確認</a></div>
        <div className="manage-grid">
          <form className="manage-panel" onSubmit={save}>
            <div className="section-title"><h2>イベント設定</h2><p>イベント名・メモ・回答期限を変更できます</p></div>
            <label className="field-label" htmlFor="manage-name">イベント名</label>
            <input id="manage-name" value={name} onChange={(formEvent) => setName(formEvent.target.value)} maxLength={100} required />
            <label className="field-label" htmlFor="manage-memo">メモ</label>
            <textarea id="manage-memo" value={memo} onChange={(formEvent) => setMemo(formEvent.target.value)} maxLength={500} rows={4} />
            <label className="field-label" htmlFor="manage-deadline">入力期限日</label>
            <input id="manage-deadline" className="date-input" type="date" value={deadlineDate} onChange={(formEvent) => setDeadlineDate(formEvent.target.value)} required />
            <label className="switch-row switch-row--compact">
              <span className="line-symbol" aria-hidden="true">LINE</span>
              <span><strong>前日19:00のリマインド</strong><small>{management.lineConnected ? `${management.lineGroupName || "LINEグループ"}へ送信` : "LINEグループを連携すると有効になります"}</small></span>
              <input type="checkbox" checked={reminderEnabled} onChange={(formEvent) => setReminderEnabled(formEvent.target.checked)} />
              <i aria-hidden="true" />
            </label>
            <label className="field-label" htmlFor="new-access-code">合言葉を変更（任意）</label>
            <input id="new-access-code" type="password" value={newAccessCode} onChange={(formEvent) => setNewAccessCode(formEvent.target.value)} minLength={4} placeholder="変更するときだけ入力" />
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button--primary button--wide" type="submit" disabled={saving}>{saving ? "保存中…" : "変更を保存"}</button>
          </form>

          <div className="manage-side">
            <section className="manage-panel">
              <div className="section-title"><h2>参加者へ共有</h2><p>URLと合言葉をLINEグループへ送ってください</p></div>
              <div className="share-block"><label>参加者用URL</label><div><code>{management.shareUrl}</code><button type="button" onClick={() => copy(management.shareUrl, "参加者用URLをコピーしました。")}>コピー</button></div></div>
              <p className="security-note">合言葉は作成時に設定したものです。忘れた場合は左のフォームから変更できます。</p>
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
    </>
  );
}
