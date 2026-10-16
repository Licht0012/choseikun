"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- vinextでは通常のリンクによる画面遷移を使う。 */

import { useEffect, useState } from "react";
import Skeleton from "react-loading-skeleton";
import { BrandHeader } from "@/app/components/BrandHeader";
import { forgetManagedEventToken, readManagedEventTokens } from "@/lib/managed-events";
import type { EventHistoryItem, PublicEventView } from "@/lib/types";

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
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [hasLoadError, setHasLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    const tokens = readManagedEventTokens();
    if (tokens.length === 0) {
      setState("ready");
      return;
    }
    Promise.allSettled(tokens.map(async (token): Promise<EventHistoryItem> => {
      const response = await fetch(`/api/manage/${encodeURIComponent(token)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("history-load-failed");
      const data = (await response.json()) as {
        event?: PublicEventView;
        management?: { shareUrl: string; manageUrl: string; createdAt: string; updatedAt: string };
      };
      if (!data.event || !data.management) throw new Error("history-load-failed");
      return {
        id: data.event.id,
        slug: data.event.slug,
        name: data.event.name,
        deadlineDate: data.event.deadlineDate,
        createdAt: data.management.createdAt,
        updatedAt: data.management.updatedAt,
        responseCount: data.event.responses.length,
        slotCount: data.event.slots.length,
        isOpen: data.event.isOpen,
        shareUrl: data.management.shareUrl,
        manageUrl: data.management.manageUrl,
        token,
      };
    }))
      .then((results) => {
        if (!active) return;
        const loaded = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
        setEvents(loaded);
        setHasLoadError(loaded.length !== tokens.length);
        setState(loaded.length === 0 ? "error" : "ready");
      })
      .catch(() => active && setState("error"));
    return () => {
      active = false;
    };
  }, []);

  const removeFromHistory = (token: string) => {
    forgetManagedEventToken(token);
    setEvents((current) => current.filter((event) => event.token !== token));
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

  return (
    <>
      <BrandHeader utilityLink={{ label: "イベント作成", href: "/" }} />
      <main className="shell history-shell">
        <div className="history-heading">
          <div><h1>イベント履歴</h1><p>このブラウザで作成・管理したイベントを表示します。</p></div>
          <a className="button button--primary" href="/">新しいイベントを作成</a>
        </div>
        <p className="history-note">別の端末では主催者用管理URLを開くと、その端末の履歴にも追加されます。ブラウザのデータを消しても、保管した管理URLから再編集できます。</p>
        {hasLoadError && state === "ready" ? <p className="history-warning" role="status">一部の履歴を読み込めませんでした。時間をおいて再度開いてください。</p> : null}

        {state === "error" ? (
          <section className="history-empty"><h2>履歴を読み込めませんでした</h2><p>時間をおいて、もう一度開いてください。</p></section>
        ) : events.length === 0 ? (
          <section className="history-empty"><h2>まだイベントがありません</h2><p>イベントを作成するか、保管した主催者用管理URLを開くと、ここに表示されます。</p></section>
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
                  <button className="history-remove" type="button" onClick={() => removeFromHistory(event.token)} aria-label={`${event.name}をこのブラウザの履歴から外す`}>履歴から外す</button>
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
