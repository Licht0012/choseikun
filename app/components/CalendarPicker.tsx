"use client";

import { useMemo, useState } from "react";
import { getCalendarDayKind, holidayName, parseDateKey, toDateKey } from "@/lib/japanese-holidays";

interface CalendarPickerProps {
  selectedDates: string[];
  onChange: (dates: string[]) => void;
}

const weekdays = ["月", "火", "水", "木", "金", "土", "日"];

function labelForDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", weekday: "short" }).format(parseDateKey(value));
}

export function CalendarPicker({ selectedDates, onChange }: CalendarPickerProps) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1, 12));
  const selected = useMemo(() => new Set(selectedDates), [selectedDates]);
  const firstDayOffset = (viewMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0, 12).getDate();
  const todayKey = toDateKey(today);
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstDayOffset + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });

  const moveMonth = (delta: number) => {
    setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1, 12));
  };

  const toggleDate = (dateKey: string) => {
    if (selected.has(dateKey)) onChange(selectedDates.filter((date) => date !== dateKey));
    else onChange([...selectedDates, dateKey].sort());
  };

  const currentMonthKey = `${viewMonth.getFullYear()}-${String(viewMonth.getMonth() + 1).padStart(2, "0")}`;
  const todayMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="calendar-picker">
      <div className="calendar-toolbar">
        <button type="button" className="icon-button" onClick={() => moveMonth(-1)} disabled={currentMonthKey <= todayMonthKey} aria-label="前の月">‹</button>
        <strong>{viewMonth.getFullYear()}年 {viewMonth.getMonth() + 1}月</strong>
        <button type="button" className="icon-button" onClick={() => moveMonth(1)} aria-label="次の月">›</button>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">
        {weekdays.map((weekday, index) => (
          <span key={weekday} className={index === 5 ? "saturday" : index === 6 ? "sunday" : ""}>{weekday}</span>
        ))}
      </div>
      <div className="calendar-grid" role="grid" aria-label="日程候補カレンダー">
        {cells.map((day, index) => {
          if (!day) return <span className="calendar-empty" key={`empty-${index}`} />;
          const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day, 12);
          const key = toDateKey(date);
          const kind = getCalendarDayKind(key);
          const isPast = key < todayKey;
          const isSelectable = kind !== "weekday" && !isPast;
          const isSelected = selected.has(key);
          const holiday = holidayName(key);
          return (
            <button
              key={key}
              type="button"
              className={`calendar-day calendar-day--${kind}${isSelected ? " is-selected" : ""}`}
              disabled={!isSelectable}
              onClick={() => toggleDate(key)}
              aria-label={`${key}${holiday ? ` ${holiday}` : ""}${isSelected ? " 選択中" : ""}`}
              aria-pressed={isSelected}
            >
              <span>{day}</span>
              {isSelected && <span className="calendar-check" aria-hidden="true">✓</span>}
            </button>
          );
        })}
      </div>
      <div className="calendar-legend">
        <span><i className="legend-dot legend-dot--selected" />選択中</span>
        <span><i className="legend-dot legend-dot--saturday" />土曜日</span>
        <span><i className="legend-dot legend-dot--holiday" />日曜・祝日</span>
        <span><i className="legend-dot legend-dot--disabled" />平日（選択不可）</span>
      </div>
      <div className="selected-date-summary">
        <strong>選択中：{selectedDates.length}日</strong>
        <div className="selected-date-list">
          {selectedDates.map((date) => (
            <button type="button" key={date} onClick={() => toggleDate(date)}>
              {labelForDate(date)} <span aria-hidden="true">×</span>
            </button>
          ))}
          {selectedDates.length === 0 && <span className="muted">カレンダーから選んでください</span>}
        </div>
      </div>
    </div>
  );
}
