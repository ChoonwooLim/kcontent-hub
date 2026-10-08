/** 자막 스타일 프리셋 — 스튜디오 오버레이 · 공유 뷰어 · MP4 렌더링(ASS)에서 공통 사용 */
export type SubtitlePreset = { name: string; color: string; bg: string; font: string };

export const SUBTITLE_PRESETS: SubtitlePreset[] = [
  { name: "기본 흰색", color: "#ffffff", bg: "rgba(0,0,0,0.7)", font: "Inter" },
  { name: "노란 강조", color: "#fbbf24", bg: "rgba(0,0,0,0.8)", font: "Outfit" },
  { name: "K-뉴스", color: "#ffffff", bg: "rgba(239,68,68,0.85)", font: "Outfit" },
  { name: "모노 코드", color: "#7c85f0", bg: "rgba(10,10,20,0.9)", font: "JetBrains Mono" },
];
