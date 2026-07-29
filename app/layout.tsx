import type { Metadata } from "next";
import "react-loading-skeleton/dist/skeleton.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "調整くん｜土日祝の日程調整",
    template: "%s｜調整くん",
  },
  description: "土日祝とよく使う時間帯を選ぶだけ。回答期限とLINEリマインドに対応した日程調整サービスです。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "調整くん",
    description: "土日祝と時間帯を選ぶだけの日程調整",
    type: "website",
    images: [
      {
        url: "/20260729_choseikun-social-card.png",
        width: 1734,
        height: 907,
        alt: "調整くん — 土日祝と時間帯を選ぶだけ",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "調整くん",
    description: "土日祝と時間帯を選ぶだけの日程調整",
    images: ["/20260729_choseikun-social-card.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
