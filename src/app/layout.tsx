import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KContent Hub - 유튜브 K콘텐츠 자동 수익화 플랫폼",
  description: "해외 인기 영상에 한국어 자막을 자동으로 추가하고 유튜브 채널을 운영해 수익을 창출하는 전자동 플랫폼",
  keywords: "유튜브 자동화, K콘텐츠, 자막 번역, 유튜브 수익화, 무편집 유튜브",
  openGraph: {
    title: "KContent Hub - 유튜브 자동 수익화",
    description: "촬영·편집·얼굴공개 없이 외국인 영상으로 수익 창출",
    type: "website",
  },
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
