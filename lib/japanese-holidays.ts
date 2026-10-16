export type CalendarDayKind = "weekday" | "saturday" | "sunday" | "holiday";

const pad = (value: number) => String(value).padStart(2, "0");

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

function nthMonday(year: number, monthIndex: number, nth: number): number {
  const firstDay = new Date(year, monthIndex, 1, 12).getDay();
  return 1 + ((8 - firstDay) % 7) + (nth - 1) * 7;
}

function vernalEquinox(year: number): number {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function autumnalEquinox(year: number): number {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

export function japaneseHolidayMap(year: number): Map<string, string> {
  const holidays = new Map<string, string>();
  const add = (month: number, day: number, name: string) => {
    holidays.set(`${year}-${pad(month)}-${pad(day)}`, name);
  };

  add(1, 1, "元日");
  add(1, nthMonday(year, 0, 2), "成人の日");
  add(2, 11, "建国記念の日");
  if (year >= 2020) add(2, 23, "天皇誕生日");
  add(3, vernalEquinox(year), "春分の日");
  add(4, 29, "昭和の日");
  add(5, 3, "憲法記念日");
  add(5, 4, "みどりの日");
  add(5, 5, "こどもの日");
  add(7, nthMonday(year, 6, 3), "海の日");
  add(8, 11, "山の日");
  add(9, nthMonday(year, 8, 3), "敬老の日");
  add(9, autumnalEquinox(year), "秋分の日");
  add(10, nthMonday(year, 9, 2), "スポーツの日");
  add(11, 3, "文化の日");
  add(11, 23, "勤労感謝の日");

  const baseKeys = Array.from(holidays.keys()).sort();
  for (const key of baseKeys) {
    const date = parseDateKey(key);
    if (date.getDay() !== 0) continue;
    const substitute = new Date(date);
    do substitute.setDate(substitute.getDate() + 1);
    while (holidays.has(toDateKey(substitute)));
    holidays.set(toDateKey(substitute), "振替休日");
  }

  const start = new Date(year, 0, 2, 12);
  const end = new Date(year, 11, 30, 12);
  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const key = toDateKey(date);
    if (holidays.has(key)) continue;
    const previous = new Date(date);
    const next = new Date(date);
    previous.setDate(previous.getDate() - 1);
    next.setDate(next.getDate() + 1);
    if (holidays.has(toDateKey(previous)) && holidays.has(toDateKey(next))) {
      holidays.set(key, "国民の休日");
    }
  }

  return holidays;
}

export function holidayName(value: string): string | undefined {
  const date = parseDateKey(value);
  return japaneseHolidayMap(date.getFullYear()).get(value);
}

export function getCalendarDayKind(value: string): CalendarDayKind {
  const date = parseDateKey(value);
  if (holidayName(value)) return "holiday";
  if (date.getDay() === 0) return "sunday";
  if (date.getDay() === 6) return "saturday";
  return "weekday";
}

export function isValidCandidateDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && toDateKey(parseDateKey(value)) === value;
}

export function addDays(value: string, days: number): string {
  const date = parseDateKey(value);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}
