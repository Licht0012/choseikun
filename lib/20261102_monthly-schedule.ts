export interface MonthlySchedule {
  publishAt: string;
  reminderAt: string;
  deadlineAt: string;
}

export function monthlySchedule(targetMonth: string): MonthlySchedule | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth)) return null;
  if (targetMonth === "2026-12") return {
    publishAt: "2026-11-04T20:00:00+09:00",
    reminderAt: "2026-11-06T19:00:00+09:00",
    deadlineAt: "2026-11-07T18:00:00+09:00",
  };
  const [year, month] = targetMonth.split("-").map(Number);
  const creationMonth = new Date(Date.UTC(year, month - 3, 1)).toISOString().slice(0, 7);
  return {
    publishAt: `${creationMonth}-15T19:00:00+09:00`,
    reminderAt: `${creationMonth}-17T19:00:00+09:00`,
    deadlineAt: `${creationMonth}-18T19:00:00+09:00`,
  };
}

export function monthlyResponseOpen(targetMonth: string, deadlineDate: string, now = new Date()): boolean {
  const schedule = monthlySchedule(targetMonth);
  const dateLimit = Date.parse(`${deadlineDate}T23:59:59+09:00`);
  return now.getTime() < Math.min(dateLimit, schedule ? Date.parse(schedule.deadlineAt) : Infinity);
}

export function deadlineText(schedule: MonthlySchedule): string {
  const value = schedule.deadlineAt;
  return `${Number(value.slice(5, 7))}月${Number(value.slice(8, 10))}日 ${value.slice(11, 16)}`;
}
