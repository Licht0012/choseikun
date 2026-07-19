import { isSelectableCandidateDate, parseDateKey, toDateKey } from "@/lib/japanese-holidays";
import type { CreateEventInput, TimeOptionInput } from "@/lib/types";

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.normalize("NFKC").trim().slice(0, maxLength) : "";
}

export function isValidTimeRange(option: TimeOptionInput): boolean {
  return timePattern.test(option.startTime) && timePattern.test(option.endTime) && option.startTime < option.endTime;
}

export function validateCreateEvent(input: CreateEventInput | null): { value?: CreateEventInput; error?: string } {
  if (!input) return { error: "入力内容を確認してください。" };
  const name = cleanText(input.name, 100);
  const memo = cleanText(input.memo, 500);
  const accessCode = cleanText(input.accessCode, 64);
  const deadlineDate = cleanText(input.deadlineDate, 10);
  const dates = Array.from(new Set(Array.isArray(input.dates) ? input.dates.filter((date) => datePattern.test(date)) : [])).sort();
  const timeOptions = Array.isArray(input.timeOptions)
    ? input.timeOptions
        .map((option) => ({ startTime: cleanText(option.startTime, 5), endTime: cleanText(option.endTime, 5) }))
        .filter(isValidTimeRange)
    : [];
  const uniqueTimeOptions = Array.from(
    new Map(timeOptions.map((option) => [`${option.startTime}-${option.endTime}`, option])).values(),
  );

  if (!name) return { error: "イベント名を入力してください。" };
  if (dates.length === 0 || dates.length > 20) return { error: "日程候補を1〜20日選んでください。" };
  if (dates.some((date) => !isSelectableCandidateDate(date))) return { error: "日程候補には土日・祝日のみ選べます。" };
  if (uniqueTimeOptions.length === 0 || uniqueTimeOptions.length > 8) return { error: "時間帯候補を1〜8件選んでください。" };
  if (!datePattern.test(deadlineDate)) return { error: "入力期限日を選んでください。" };
  const today = toDateKey(new Date());
  if (deadlineDate < today) return { error: "入力期限日は今日以降にしてください。" };
  if (parseDateKey(deadlineDate) > parseDateKey(dates[0])) return { error: "入力期限日は最初の候補日以前にしてください。" };
  if (accessCode.length < 4) return { error: "参加者用の合言葉は4文字以上にしてください。" };

  return {
    value: {
      name,
      memo,
      accessCode,
      deadlineDate,
      dates,
      timeOptions: uniqueTimeOptions,
      reminderEnabled: input.reminderEnabled !== false,
    },
  };
}

export function isResponseOpen(deadlineDate: string): boolean {
  return Date.now() <= new Date(`${deadlineDate}T23:59:59+09:00`).getTime();
}
