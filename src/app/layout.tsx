import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KContent Studio — K-컬처 영상 자동 제작 파이프라인",
  description: "한국 방문 외국인 영상 자동 발굴 → AI K-문화 대본 생성 → 자막 소각 편집 → 유튜브/틱톡/릴스 멀티플랫폼 자동 배포",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
