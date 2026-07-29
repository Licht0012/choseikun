import type { Metadata } from "next";
import { ManageEventApp } from "@/app/components/ManageEventApp";

export const metadata: Metadata = { title: "イベントを再編集" };

export default async function AdminManagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ManageEventApp access={{ type: "admin", value: slug }} />;
}
