import type { SlotView, ResponseView } from "./types";

export const MEMBERS = ["りえこ", "しほ", "長官", "まさよし", "奏", "おーじ"] as const;
export const TIMES = [["10:00", "12:00"], ["13:00", "15:00"], ["18:00", "20:00"]] as const;
export const HOLIDAY_URL = "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv";
export const pad = (n: number) => String(n).padStart(2, "0");
export function japanDate(now: Date): string { return new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 19); }
export function targetMonth(now: Date): string {
  const local = japanDate(now);
  const date = new Date(Date.UTC(Number(local.slice(0, 4)), Number(local.slice(5, 7)) + 1, 1));
  return date.toISOString().slice(0, 7);
}
export function parseHolidays(csv: string, year: number): Set<string> {
  const dates = new Set<string>();
  let maxYear = 0;
  for (const line of csv.split(/\r?\n/)) {
    const match = line.match(/^"?(\d{4})\/(\d{1,2})\/(\d{1,2})"?,/);
    if (!match) continue;
    maxYear = Math.max(maxYear, Number(match[1]));
    dates.add(`${match[1]}-${pad(Number(match[2]))}-${pad(Number(match[3]))}`);
  }
  // The Cabinet Office CSV publishes complete calendar years; never extrapolate.
  if (maxYear < year || [...dates].filter(d => d.startsWith(`${year}-`)).length < 16) {
    throw new Error(`確定済みの祝日データがありません: ${year}`);
  }
  return dates;
}
export function candidateDates(month: string, holidays: Set<string>): string[] {
  const [year, m] = month.split("-").map(Number);
  const result: string[] = [];
  for (let day = 1; day <= new Date(Date.UTC(year, m, 0)).getUTCDate(); day++) {
    if (m === 1 && day <= 3) continue;
    const key = `${month}-${pad(day)}`;
    const weekday = new Date(`${key}T00:00:00Z`).getUTCDay();
    if (weekday === 0 || weekday === 6 || holidays.has(key)) result.push(key);
  }
  return result;
}
export function complete(slots: SlotView[], responses: ResponseView[]): boolean {
  return slots.length > 0 && MEMBERS.every(name => {
    const response = responses.find(r => r.name === name);
    return response && slots.every(s => ["yes", "maybe", "no"].includes(response.availability[s.id]));
  });
}
export function selectCandidates(slots: SlotView[], responses: ResponseView[]): SlotView[] {
  const counts = slots.map(slot => {
    const values = MEMBERS.map(name => responses.find(r => r.name === name)?.availability[slot.id]);
    return { slot, yes: values.filter(v => v === "yes").length, maybe: values.filter(v => v === "maybe").length };
  });
  const chronological = (a: typeof counts[number], b: typeof counts[number]) =>
    `${a.slot.date} ${a.slot.startTime}`.localeCompare(`${b.slot.date} ${b.slot.startTime}`);
  const unanimous = counts.filter(c => c.yes === 6);
  return (unanimous.length ? unanimous.sort(chronological) : counts.filter(c => c.yes + c.maybe >= 4)
    .sort((a, b) => b.yes - a.yes || b.maybe - a.maybe || chronological(a, b))).map(c => c.slot);
}
export function slotLabel(slot: SlotView): string {
  return `${slot.date.slice(5).replace("-", "/")}(${"日月火水木金土"[new Date(`${slot.date}T00:00:00Z`).getUTCDay()]})${slot.startTime}〜${slot.endTime}`;
}
export function resultText(slots: SlotView[], provisional = false): string {
  const list = slots.map(s => `・${slotLabel(s)}`).join("\n");
  if (provisional) return `【調整くん】\n\n回答期限になりましたが、まだ全員の回答が揃っていません。\n\n現在の回答による候補日時は以下です。\n\n${list || "条件を満たす候補日時がありませんでした。"}\n\n※未回答者がいるため暫定結果です。`;
  return list ? `しほさん\n候補日は\n${list}\nです。\nスタジオの予約をお願いします🙇` : "【調整くん】\n\n全員の回答が揃いましたが、条件を満たす候補日時がありませんでした。\n\n回答内容を確認してください。";
}
