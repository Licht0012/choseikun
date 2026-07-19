"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- vinextでは同一ページ内アンカーも通常のリンクを使う。 */

interface BrandHeaderProps {
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export function BrandHeader({ actionLabel, onAction, compact = false }: BrandHeaderProps) {
  return (
    <header className={`brand-header${compact ? " brand-header--compact" : ""}`}>
      <a className="brand" href="/" aria-label="調整くん ホーム">
        調整<span>くん</span>
      </a>
      {actionLabel && onAction ? (
        <button className="header-action" type="button" onClick={onAction}>
          <span className="header-action__icon" aria-hidden="true">◎</span>
          {actionLabel}
        </button>
      ) : (
        <nav className="header-nav" aria-label="メインメニュー">
          {!compact && <a className="header-link" href="/#how-to-use">使い方</a>}
          <a className="header-link" href="/#admin-login">イベントを作成</a>
        </nav>
      )}
    </header>
  );
}
