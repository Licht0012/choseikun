import type { TimeOptionInput } from "@/lib/types";

export const FIXED_TIME_OPTIONS: TimeOptionInput[] = [
  { startTime: "10:00", endTime: "12:00" },
  { startTime: "13:00", endTime: "15:00" },
  { startTime: "18:00", endTime: "20:00" },
];

export const timeOptionKey = (range: TimeOptionInput) => `${range.startTime}-${range.endTime}`;

export const timeOptionLabel = (range: TimeOptionInput) => `${range.startTime}〜${range.endTime}`;
