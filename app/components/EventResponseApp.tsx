"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- vinextでは通常のリンクによる画面遷移を使う。 */

import { FormEvent, useEffect, useMemo, useState } from "react";
import Skeleton from "react-loading-skeleton";
import { BrandHeader } from "@/app/components/BrandHeader";
import { getCalendarDayKind, parseDateKey } from "@/lib/japanese-holidays";
import type { AvailabilityStatus, PublicEventView, SlotView } from "@/lib/types";

interface EventResponseAppProps {
  slug: string;
}

interface PriorResponse {
  name: string;
  comment: string;
  availability: Record<string, AvailabilityStatus>;
}

const statusLabels: Record<AvailabilityStatus, { symbol: string; label: string }> = {
  yes: { symbol: "○", label: "参加できる" },
  maybe: { symbol: "△", label: "調整できる" },
  no: { symbol: "×", label: "参加できない" },
};

function formatDate(value: string, includeYear = false): string {
  return new Intl.DateTimeFormat("ja-JP", {
    ...(includeYear ? { year: "numeric" as const } : {}),
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(parseDateKey(value));
}

function deadlineLabel(value: string): string {
  return `${formatDate(value)} 23:59`;
}

function groupSlots(slots: SlotView[]): Array<{ date: string; slots: SlotView[] }> {
  const grouped = new Map<string, SlotView[]>();
  for (const slot of slots) grouped.set(slot.date, [...(grouped.get(slot.date) || []), slot]);
  return Array.from(grouped, ([date, groupedSlots]) => ({ date, slots: groupedSlots }));
}

export function EventResponseApp({ slug }: EventResponseAppProps) {
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [event, setEvent] = useState<PublicEventView | null>(null);
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [answers, setAnswers] = useState<Record<string, AvailabilityStatus>>({});
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [priorAvailable, setPriorAvailable] = useState(false);

  const editTokenKey = `choseikun-edit-${slug}`;

  useEffect(() => {
    let active = true;
    fetch(`/api/events/${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 404) return { missing: true };
        const data = (await response.json()) as { event?: PublicEventView };
        if (!response.ok || !data.event) return { missing: true };
        return { event: data.event };
      })
      .then((data) => {
        if (!active) return;
        if ("missing" in data || !data.event) return setState("missing");
        setEvent(data.event);
        setPriorAvailable(Boolean(localStorage.getItem(`choseikun-edit-${slug}`)));
        setState("ready");
      })
      .catch(() => active && setState("missing"));
    return () => {
      active = false;
    };
  }, [slug]);

  const groupedSlots = useMemo(() => groupSlots(event?.slots || []), [event]);
  const counts = useMemo(() => {
    if (!event) return new Map<string, { yes: number; maybe: number; no: number; score: number }>();
    return new Map(event.slots.map((slot) => {
      const values = event.responses.map((response) => response.availability[slot.id]).filter(Boolean);
      const yes = values.filter((value) => value === "yes").length;
      const maybe = values.filter((value) => value === "maybe").length;
      const no = values.filter((value) => value === "no").length;
      return [slot.id, { yes, maybe, no, score: yes * 2 + maybe }];
    }));
  }, [event]);
  const bestScore = Math.max(0, ...Array.from(counts.values(), (value) => value.score));

  const setAll = (status: AvailabilityStatus) => {
    if (!event?.isOpen) return;
    setAnswers(Object.fromEntries(event.slots.map((slot) => [slot.id, status])));
  };

  const loadPriorResponse = async () => {
    setError("");
    const editToken = localStorage.getItem(editTokenKey) || "";
    if (!editToken) return setError("この端末には前回の回答がありません。");
    const response = await fetch(`/api/events/${encodeURIComponent(slug)}/responses`, {
      headers: { "x-edit-token": editToken },
      cache: "no-store",
    });
    const data = (await response.json()) as { response?: PriorResponse | null; error?: string };
    if (!response.ok || !data.response) return setError(data.error || "前回の回答を読み込めませんでした。");
    setName(data.response.name);
    setComment(data.response.comment);
    setAnswers(data.response.availability);
  };

  const submitResponse = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    if (!event) return;
    setError("");
    if (event.slots.some((slot) => !answers[slot.id])) return setError("すべての候補に○・△・×で回答してください。");
    setSubmitting(true);
    const response = await fetch(`/api/events/${encodeURIComponent(slug)}/responses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        comment,
        availability: event.slots.map((slot) => ({ slotId: slot.id, status: answers[slot.id] })),
        editToken: localStorage.getItem(editTokenKey) || undefined,
      }),
    });
    const data = (await response.json()) as { editToken?: string; event?: PublicEventView; error?: string };
    setSubmitting(false);
    if (!response.ok || !data.event || !data.editToken) return setError(data.error || "回答を送信できませんでした。");
    localStorage.setItem(editTokenKey, data.editToken);
    setPriorAvailable(true);
    setEvent(data.event);
    setSubmitted(true);
    window.setTimeout(() => setSubmitted(false), 5000);
  };

  if (state === "loading") {
    return (
      <><BrandHeader compact /><main className="shell response-shell loading-shell"><Skeleton height={36} width="45%" /><Skeleton height={440} borderRadius={12} style={{ marginTop: 28 }} /></main></>
    );
  }

  if (state === "missing") {
    return (
      <><BrandHeader compact /><main className="shell shell--auth"><section className="auth-panel"><h1>イベントが見つかりません</h1><p>URLが正しいか、主催者に確認してください。</p><a className="button button--primary" href="/">ホームへ戻る</a></section></main></>
    );
  }

  if (!event) return null;

  return (
    <>
      <BrandHeader compact />
      <main className="shell response-shell">
        <section className="event-intro">
          <h1>{event.name}</h1>
          {event.memo && <p>{event.memo}</p>}
          <div className="event-meta">
            <span>▣ 回答期限 {deadlineLabel(event.deadlineDate)}</span>
            {event.reminderEnabled && event.lineConnected && <span className="line-status">● LINEリマインド設定済み</span>}
          </div>
        </section>

        <form onSubmit={submitResponse}>
          <section className="answer-section">
            <h2>あなたの回答</h2>
            <div className="answer-layout">
              <div className="participant-fields">
                <label className="field-label" htmlFor="participant-name">お名前</label>
                <input id="participant-name" value={name} onChange={(formEvent) => setName(formEvent.target.value)} maxLength={40} disabled={!event.isOpen} required />
                <label className="field-label" htmlFor="participant-comment">コメント（任意）</label>
                <input id="participant-comment" value={comment} onChange={(formEvent) => setComment(formEvent.target.value)} maxLength={300} placeholder="ひとことメッセージを入力できます" disabled={!event.isOpen} />
                <div className="availability-legend">
                  {(Object.keys(statusLabels) as AvailabilityStatus[]).map((status) => <span className={`status-${status}`} key={status}>{statusLabels[status].symbol} {statusLabels[status].label}</span>)}
                </div>
              </div>
              <div className="slot-groups">
                {groupedSlots.map((group) => (
                  <div className={`slot-group slot-group--${getCalendarDayKind(group.date)}`} key={group.date}>
                    <strong className="slot-date">{formatDate(group.date)}</strong>
                    <div className="slot-time-list">
                      {group.slots.map((slot) => (
                        <div className="slot-answer-row" key={slot.id}>
                          <span>{slot.label}</span>
                          <div className="availability-control" role="group" aria-label={`${formatDate(group.date)} ${slot.label}`}>
                            {(Object.keys(statusLabels) as AvailabilityStatus[]).map((status) => (
                              <button type="button" key={status} className={`status-${status}${answers[slot.id] === status ? " is-selected" : ""}`} onClick={() => setAnswers((current) => ({ ...current, [slot.id]: status }))} disabled={!event.isOpen} aria-pressed={answers[slot.id] === status} aria-label={statusLabels[status].label}>{statusLabels[status].symbol}</button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="answer-actions">
              <button className="button button--secondary" type="button" onClick={() => setAll("yes")} disabled={!event.isOpen}>すべて○</button>
              <button className="button button--secondary" type="button" onClick={loadPriorResponse} disabled={!priorAvailable || !event.isOpen}>前回の回答を反映</button>
              <button className="button button--primary" type="submit" disabled={!event.isOpen || submitting}>{event.isOpen ? (submitting ? "送信中…" : "回答を送信") : "回答期限を過ぎています"}</button>
            </div>
            {priorAvailable && <p className="edit-helper">▣ この端末から回答を修正できます</p>}
            {error && <p className="form-error form-error--wide" role="alert">{error}</p>}
            {submitted && <div className="inline-success" role="status"><span>✓</span><div><strong>回答を送信しました</strong><p>ありがとうございます！</p></div></div>}
          </section>
        </form>

        <section className="results-section">
          <div className="results-heading"><h2>みんなの回答</h2>{event.responses.length > 0 && <span>{event.responses.length}人が回答済み</span>}</div>
          {event.responses.length === 0 ? (
            <div className="empty-results"><strong>まだ回答はありません</strong><p>最初の回答を送ると、ここに集計が表示されます。</p></div>
          ) : (
            <div className="results-table-wrap">
              <table className="results-table">
                <thead><tr><th>候補日時</th>{event.responses.map((response) => <th key={response.id}>{response.name}</th>)}</tr></thead>
                <tbody>
                  {event.slots.map((slot) => {
                    const count = counts.get(slot.id)!;
                    const best = bestScore > 0 && count.score === bestScore;
                    return (
                      <tr key={slot.id} className={best ? "is-best" : ""}>
                        <th><span>{formatDate(slot.date)} {slot.label}</span><small><b className="status-yes">○ {count.yes}</b><b className="status-maybe">△ {count.maybe}</b><b className="status-no">× {count.no}</b></small></th>
                        {event.responses.map((response) => { const status = response.availability[slot.id]; return status ? <td className={`status-${status}`} key={response.id}>{statusLabels[status].symbol}</td> : <td className="status-unanswered" key={response.id}>—</td>; })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {event.responses.some((response) => response.comment) && <div className="comment-list">{event.responses.filter((response) => response.comment).map((response) => <p key={response.id}><strong>{response.name}</strong>{response.comment}</p>)}</div>}
        </section>
      </main>
      <footer className="site-footer">© 調整くん</footer>
    </>
  );
}
