import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "rea-sabangnet — 스마트스토어 매출 정산",
  description: "사방넷 정산관리를 참고한 네이버 스마트스토어 매출 정산/대사 웹앱",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
