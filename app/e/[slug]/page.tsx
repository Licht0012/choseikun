import type { Metadata } from "next";
import { EventResponseApp } from "@/app/components/EventResponseApp";

export const metadata: Metadata = { title: "イベントに回答" };

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <EventResponseApp slug={slug} />;
}
