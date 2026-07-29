"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- vinextでは同一ページ内アンカーも通常のリンクを使う。 */

import type { MouseEvent } from "react";

interface BrandHeaderProps {
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
  utilityLink?: { label: string; href: string };
}

function hardNavigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
  event.preventDefault();
  window.location.assign(href);
}

export function BrandHeader({ actionLabel, onAction, compact = false, utilityLink }: BrandHeaderProps) {
  return (
    <header className={`brand-header${compact ? " brand-header--compact" : ""}`}>
      <a className="brand" href="/" aria-label="調整くん ホーム" onClick={(event) => hardNavigate(event, "/")}>
        <span className="brand-main">調整</span>
        <span className="brand-kun">くん</span>
      </a>
      {actionLabel && onAction ? (
        <nav className="header-nav" aria-label="主催者メニュー">
          <a className="header-link" href="/guide" onClick={(event) => hardNavigate(event, "/guide")}>使い方</a>
          {utilityLink ? (
            <a className="header-link" href={utilityLink.href} onClick={(event) => hardNavigate(event, utilityLink.href)}>
              {utilityLink.label}
            </a>
          ) : null}
          <button className="header-action" type="button" onClick={onAction}>
            <span className="header-action__icon" aria-hidden="true">◎</span>
            {actionLabel}
          </button>
        </nav>
      ) : (
        <nav className="header-nav" aria-label="メインメニュー">
          {!compact && <a className="header-link" href="/guide" onClick={(event) => hardNavigate(event, "/guide")}>使い方</a>}
          {utilityLink ? (
            <a className="header-link" href={utilityLink.href} onClick={(event) => hardNavigate(event, utilityLink.href)}>
              {utilityLink.label}
            </a>
          ) : null}
          <a className="header-link" href="/#admin-login">イベントを作成</a>
        </nav>
      )}
    </header>
  );
}
