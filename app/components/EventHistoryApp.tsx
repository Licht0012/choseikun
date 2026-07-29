"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- vinextでは通常のリンクによる画面遷移を使う。 */

import { useEffect, useState } from "react";
import Skeleton from "react-loading-skeleton";
import { BrandHeader } from "@/app/components/BrandHeader";
import type { EventHistoryItem } from "@/lib/types";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" }).format(
    new Date(`${value}T12:00:00+09:00`),
  );
}

function formatCreatedAt(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function EventHistoryApp() {
  const [events, setEvents] = useState<EventHistoryItem[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "unauthorized" | "error">("loading");

  useEffect(() => {
    let active = true;
    fetch("/api/events", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) return { unauthorized: true };
        const data = (await response.json()) as { events?: EventHistoryItem[] };
        if (!response.ok || !data.events) throw new Error("history-load-failed");
        return { events: data.events };
      })
      .then((data) => {
        if (!active) return;
        if ("unauthorized" in data) return setState("unauthorized");
        setEvents(data.events || []);
        setState("ready");
      })
      .catch(() => active && setState("error"));
    return () => {
      active = false;
    };
  }, []);

  const logout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    window.location.assign("/");
  };

  if (state === "loading") {
    return (
      <>
        <BrandHeader />
        <main className="shell history-shell" aria-label="イベント履歴を読み込み中">
          <Skeleton height={42} width="38%" />
          <Skeleton height={360} borderRadius={14} style={{ marginTop: 28 }} />
        </main>
      </>
    );
  }

  if (state === "unauthorized") {
    return (
      <>
        <BrandHeader />
        <main className="shell shell--auth">
          <section className="auth-panel">
            <h1>ログインが必要です</h1>
            <p>イベント履歴を見るには、主催者としてログインしてください。</p>
            <a className="button button--primary button--wide" href="/#admin-login">ログイン画面へ</a>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <BrandHeader
        actionLabel="ログアウト"
        onAction={logout}
        utilityLink={{ label: "イベント作成", href: "/" }}
      />
      <main className="shell history-shell">
        <div className="history-heading">
          <div><h1>イベント履歴</h1><p>作成したイベントの確認・共有・再編集ができます。</p></div>
          <a className="button button--primary" href="/">新しいイベントを作成</a>
        </div>

        {state === "error" ? (
          <section className="history-empty"><h2>履歴を読み込めませんでした</h2><p>時間をおいて、もう一度開いてください。</p></section>
        ) : events.length === 0 ? (
          <section className="history-empty"><h2>まだイベントがありません</h2><p>最初のイベントを作成すると、ここから再編集できます。</p></section>
        ) : (
          <section className="history-list" aria-label="作成済みイベント">
            {events.map((event) => (
              <article className="history-item" key={event.id}>
                <div className="history-item__main">
                  <span className={`history-status${event.isOpen ? " is-open" : " is-closed"}`}>
                    {event.isOpen ? "受付中" : "締切済み"}
                  </span>
                  <h2>{event.name}</h2>
                  <dl>
                    <div><dt>入力期限</dt><dd>{formatDate(event.deadlineDate)}</dd></div>
                    <div><dt>作成日時</dt><dd>{formatCreatedAt(event.createdAt)}</dd></div>
                    <div><dt>最終更新</dt><dd>{formatCreatedAt(event.updatedAt)}</dd></div>
                  </dl>
                </div>
                <div className="history-item__stats" aria-label="イベントの集計">
                  <div><strong>{event.responseCount}</strong><span>回答者</span></div>
                  <div><strong>{event.slotCount}</strong><span>候補日時</span></div>
                </div>
                <div className="history-item__actions">
                  <a className="button button--secondary" href={event.shareUrl} aria-label={`${event.name}の回答画面を開く`}>回答画面</a>
                  <a className="button button--primary" href={event.manageUrl} aria-label={`${event.name}を再編集する`}>再編集する</a>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
      <footer className="site-footer">© 調整くん</footer>
    </>
  );
}
