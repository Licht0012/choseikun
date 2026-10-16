"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- vinextでは同一ページ内アンカーも通常のリンクを使う。 */

import type { MouseEvent } from "react";

interface BrandHeaderProps {
  compact?: boolean;
  utilityLink?: { label: string; href: string };
}

function hardNavigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
  event.preventDefault();
  window.location.assign(href);
}

export function BrandHeader({ compact = false, utilityLink }: BrandHeaderProps) {
  return (
    <header className={`brand-header${compact ? " brand-header--compact" : ""}`}>
      <a className="brand" href="/" aria-label="調整くん ホーム" onClick={(event) => hardNavigate(event, "/")}>
        <span className="brand-main">調整</span>
        <span className="brand-kun">くん</span>
      </a>
      <nav className="header-nav" aria-label="メインメニュー">
        {!compact && <a className="header-link" href="/guide" onClick={(event) => hardNavigate(event, "/guide")}>使い方</a>}
        {utilityLink ? (
          <a className="header-link" href={utilityLink.href} onClick={(event) => hardNavigate(event, utilityLink.href)}>
            {utilityLink.label}
          </a>
        ) : null}
        {!utilityLink && <a className="header-link" href="/" onClick={(event) => hardNavigate(event, "/")}>イベントを作成</a>}
      </nav>
    </header>
  );
}
