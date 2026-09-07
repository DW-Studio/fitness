import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "fitness",
  description: "健身打卡 · 周一/三/五训练",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <head>
        <meta name="color-scheme" content="light dark" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
