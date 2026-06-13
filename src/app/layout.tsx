import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Schedule Calendar",
  description: "Share date availability with a small group.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

