import type { Metadata } from "next";
import { ManageEventApp } from "@/app/components/ManageEventApp";

export const metadata: Metadata = { title: "イベント管理", robots: { index: false, follow: false } };

export default async function ManagePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ManageEventApp token={token} />;
}
