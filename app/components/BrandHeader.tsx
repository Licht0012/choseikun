"use client";

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
        <a className="header-link" href="/">イベントを作成</a>
      )}
    </header>
  );
}
