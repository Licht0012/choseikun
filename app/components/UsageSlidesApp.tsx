"use client";

/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element -- vinextではサイト内URLと静的画像を通常のHTML要素で扱う。 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const slideCount = 8;

const slideMeta = [
  { eyebrow: "START HERE", title: "調整くん はじめかたガイド" },
  { eyebrow: "OVERVIEW", title: "日程調整は、3ステップで完了します" },
  { eyebrow: "STEP 1", title: "まず、候補日時と入力期限日を決めます" },
  { eyebrow: "STEP 2", title: "回答用URLだけを参加メンバーへ共有します" },
  { eyebrow: "FOR MEMBERS", title: "参加メンバーは ○・△・× で回答します" },
  { eyebrow: "LINE CONNECT", title: "連携コードをLINEグループへ送ります" },
  { eyebrow: "REMINDER", title: "リマインドは締切前日19:00に1回だけ" },
  { eyebrow: "READY", title: "これで、みんなの予定を集められます" },
] as const;

function StepBadge({ children }: { children: ReactNode }) {
  return <span className="guide-step-badge">{children}</span>;
}

function SlideHeading({ index }: { index: number }) {
  const meta = slideMeta[index];
  return (
    <header className="guide-slide-heading">
      <span>{meta.eyebrow}</span>
      <h1>{meta.title}</h1>
    </header>
  );
}

export function UsageSlidesApp() {
  const [index, setIndex] = useState(0);
  const touchStart = useRef<number | null>(null);

  const move = useCallback((delta: number) => {
    setIndex((current) => Math.min(slideCount - 1, Math.max(0, current + delta)));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "PageDown") move(1);
      if (event.key === "ArrowLeft" || event.key === "PageUp") move(-1);
      if (event.key === "Home") setIndex(0);
      if (event.key === "End") setIndex(slideCount - 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [move]);

  return (
    <main
      className="guide-deck"
      onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => {
        if (touchStart.current === null) return;
        const delta = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current;
        if (Math.abs(delta) > 48) move(delta < 0 ? 1 : -1);
        touchStart.current = null;
      }}
    >
      <nav className="guide-deck-bar" aria-label="スライドのメニュー">
        <a className="guide-brand" href="/" aria-label="調整くん ホームへ戻る">調整<span>くん</span></a>
        <div className="guide-deck-links">
          <span>使い方スライド</span>
          <a href="/">サイトへ戻る</a>
        </div>
      </nav>

      <section className="guide-stage" aria-live="polite" aria-label={`${index + 1}枚目 / ${slideCount}枚`}>
        <article className={`guide-slide guide-slide--${index + 1}`}>
          {index === 0 && (
            <div className="guide-cover">
              <div className="guide-cover-copy">
                <span className="guide-kicker">土日・祝日の予定調整を、かんたんに。</span>
                <h1>調整くん<br /><em>はじめかたガイド</em></h1>
                <p>主催者のイベント作成から、参加メンバーの回答、LINEリマインドまでを8枚で確認できます。</p>
                <button className="guide-start-button" type="button" onClick={() => move(1)}>ガイドを見る <span aria-hidden="true">→</span></button>
              </div>
              <div className="guide-cover-visual" aria-hidden="true">
                <div className="guide-orbit guide-orbit--one"><strong>土日祝</strong><span>だけ選択</span></div>
                <div className="guide-orbit guide-orbit--two"><strong>3つ</strong><span>定番時間帯</span></div>
                <div className="guide-phone guide-phone--cover">
                  <div className="guide-phone-top" />
                  <img src="/guide/20260719_overview-mobile.png" width={390} height={844} alt="" />
                </div>
              </div>
            </div>
          )}

          {index === 1 && (
            <div className="guide-content">
              <SlideHeading index={index} />
              <ol className="guide-flow">
                <li><StepBadge>1</StepBadge><div><strong>イベントを作る</strong><p>候補の土日祝、時間帯、入力期限日を設定</p></div></li>
                <li><StepBadge>2</StepBadge><div><strong>回答用URLを送る</strong><p>LINEなどで参加メンバーへ共有</p></div></li>
                <li><StepBadge>3</StepBadge><div><strong>結果を確認する</strong><p>○・△・×が集まった日時から決定</p></div></li>
              </ol>
              <div className="guide-note-strip"><span aria-hidden="true">✓</span><p><strong>参加メンバーはログイン不要。</strong>受け取ったURLを開けば、そのまま回答できます。</p></div>
            </div>
          )}

          {index === 2 && (
            <div className="guide-content guide-content--split">
              <div className="guide-copy-column">
                <SlideHeading index={index} />
                <ol className="guide-checklist">
                  <li><StepBadge>1</StepBadge><div><strong>イベント名・メモ</strong><p>集まりの目的や補足を書きます。</p></div></li>
                  <li><StepBadge>2</StepBadge><div><strong>日程候補</strong><p>カレンダーから土日・祝日を選びます。</p></div></li>
                  <li><StepBadge>3</StepBadge><div><strong>時間帯候補</strong><p>10–12時／13–15時／18–20時。その他は自由入力できます。</p></div></li>
                  <li><StepBadge>4</StepBadge><div><strong>入力期限日</strong><p>カレンダーから回答の締切日を選びます。</p></div></li>
                </ol>
              </div>
              <div className="guide-phone-scene">
                <div className="guide-phone guide-phone--crop-create">
                  <div className="guide-phone-top" />
                  <img src="/guide/20260719_create-mobile.png" width={320} height={700} alt="調整くんのイベント作成画面。入力期限日とLINE通知の設定が表示されている" />
                </div>
                <div className="guide-callout guide-callout--deadline"><span>ここ</span><strong>入力期限日を設定</strong></div>
              </div>
            </div>
          )}

          {index === 3 && (
            <div className="guide-content">
              <SlideHeading index={index} />
              <div className="guide-share-scene">
                <div className="guide-admin-key"><span aria-hidden="true">🔒</span><div><small>主催者専用</small><strong>管理画面URL</strong></div></div>
                <div className="guide-share-arrow" aria-hidden="true">→</div>
                <div className="guide-url-ticket"><span>参加者用URL</span><code>choseikun… / e / ******</code><button type="button" tabIndex={-1}>コピー</button></div>
                <div className="guide-member-bubbles" aria-label="参加メンバーへ共有"><i>佐</i><i>鈴</i><i>高</i><i>＋</i></div>
              </div>
              <div className="guide-note-strip guide-note-strip--warning"><span aria-hidden="true">!</span><p><strong>参加者へ送るのは「回答用URL」だけ。</strong>管理画面URLは主催者だけが保管してください。</p></div>
            </div>
          )}

          {index === 4 && (
            <div className="guide-content guide-content--split">
              <div className="guide-copy-column">
                <SlideHeading index={index} />
                <div className="guide-status-explainer">
                  <div className="is-yes"><b>○</b><span><strong>参加できる</strong>予定が空いている</span></div>
                  <div className="is-maybe"><b>△</b><span><strong>調整できる</strong>条件次第で参加できる</span></div>
                  <div className="is-no"><b>×</b><span><strong>参加できない</strong>予定が合わない</span></div>
                </div>
                <p className="guide-side-note">名前と、すべての候補日時への回答を入力して「回答を送信」。同じ端末なら後から修正もできます。</p>
              </div>
              <div className="guide-phone-scene">
                <div className="guide-phone guide-phone--answer">
                  <div className="guide-phone-top" />
                  <img src="/guide/20260719_answer-mobile.png" width={320} height={1200} alt="参加メンバーが○・△・×で回答する画面" />
                </div>
              </div>
            </div>
          )}

          {index === 5 && (
            <div className="guide-content guide-content--split">
              <div className="guide-copy-column">
                <SlideHeading index={index} />
                <ol className="guide-checklist guide-checklist--line">
                  <li><StepBadge>1</StepBadge><div><strong>Botをグループへ追加</strong><p>リマインドを送りたいLINEグループに追加します。</p></div></li>
                  <li><StepBadge>2</StepBadge><div><strong>管理画面でコードを発行</strong><p>「LINE連携コードを発行」を押します。</p></div></li>
                  <li><StepBadge>3</StepBadge><div><strong>表示メッセージを送信</strong><p>そのまま対象グループへ送り、Botの返信を確認します。</p></div></li>
                </ol>
              </div>
              <div className="guide-phone-scene guide-phone-scene--manage">
                <div className="guide-phone guide-phone--manage">
                  <div className="guide-phone-top" />
                  <img src="/guide/20260719_manage-line-mobile.png" width={320} height={620} alt="イベント管理画面のLINEグループ連携パネル" />
                </div>
                <div className="guide-callout guide-callout--line"><span>2</span><strong>ここから発行</strong></div>
              </div>
            </div>
          )}

          {index === 6 && (
            <div className="guide-content">
              <SlideHeading index={index} />
              <div className="guide-reminder-scene">
                <div className="guide-calendar-card"><span>入力期限日</span><strong>20</strong><small>MON</small></div>
                <div className="guide-reminder-arrow"><span>前日</span><strong>19:00</strong></div>
                <div className="guide-line-message"><span className="line-symbol" aria-hidden="true">LINE</span><div><strong>回答期限は明日です</strong><p>まだ回答していない方は、入力をお願いします。</p></div></div>
              </div>
              <div className="guide-note-strip"><span aria-hidden="true">1</span><p><strong>通知は1回だけです。</strong>毎日送られることはありません。イベント作成時にLINE通知をオンにしてください。</p></div>
            </div>
          )}

          {index === 7 && (
            <div className="guide-finish">
              <div className="guide-finish-mark" aria-hidden="true">✓</div>
              <span className="guide-kicker">準備はできました</span>
              <h1>まずはイベントを<br />1件作ってみましょう</h1>
              <ul><li>候補日時と入力期限日を決める</li><li>回答用URLを共有する</li><li>必要ならLINEグループを連携する</li></ul>
              <a className="guide-start-button" href="/">調整くんを開く <span aria-hidden="true">→</span></a>
              <p>choseikun.yucky0629.chatgpt.site</p>
            </div>
          )}
        </article>
      </section>

      <footer className="guide-controls">
        <button type="button" onClick={() => move(-1)} disabled={index === 0} aria-label="前のスライド">←</button>
        <div className="guide-progress" aria-label={`全${slideCount}枚中${index + 1}枚目`}>
          {Array.from({ length: slideCount }, (_, dotIndex) => (
            <button key={dotIndex} type="button" className={dotIndex === index ? "is-active" : ""} onClick={() => setIndex(dotIndex)} aria-label={`${dotIndex + 1}枚目へ`} />
          ))}
        </div>
        <span>{index + 1} / {slideCount}</span>
        <button type="button" onClick={() => move(1)} disabled={index === slideCount - 1} aria-label="次のスライド">→</button>
      </footer>
    </main>
  );
}
