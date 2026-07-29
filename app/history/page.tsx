import type { Metadata } from "next";
import { EventHistoryApp } from "@/app/components/EventHistoryApp";

export const metadata: Metadata = { title: "イベント履歴" };

export default function HistoryPage() {
  return <EventHistoryApp />;
}
