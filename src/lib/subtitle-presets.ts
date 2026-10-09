import type { CSSProperties } from "react";

/** 자막 스타일 프리셋 — 스튜디오 오버레이 · 공유 뷰어 · MP4 렌더링(ASS)에서 공통 사용 */
export type SubtitlePreset = { name: string; color: string; bg: string; font: string };

export const SUBTITLE_PRESETS: SubtitlePreset[] = [
  { name: "기본 흰색", color: "#ffffff", bg: "rgba(0,0,0,0.7)", font: "Inter" },
  { name: "노란 강조", color: "#fbbf24", bg: "rgba(0,0,0,0.8)", font: "Outfit" },
  { name: "K-뉴스", color: "#ffffff", bg: "rgba(239,68,68,0.85)", font: "Outfit" },
  { name: "모노 코드", color: "#7c85f0", bg: "rgba(10,10,20,0.9)", font: "JetBrains Mono" },
];

/* ── 자막 위치 (기준 위치 + 미세 이동) ─────────────────────
 * overlayPos: "bottom"(하단 12%) | "top"(상단 9%)
 * overlayX / overlayY: 플레이어 크기 대비 % 오프셋 (정수). X 오른쪽 +, Y 위쪽 +
 * 스튜디오 오버레이 · 공유 뷰어 · MP4 렌더링(ASS 마진)이 같은 값을 쓴다.
 */
/** 자막 상자 최대 폭 — 가능한 한 가로 한 줄에 담기도록 넓게 */
export const SUBTITLE_MAX_WIDTH = "96%";

/** 자막 안의 줄바꿈을 공백으로 — 짧은 문장이 두 줄로 쪼개져 보이지 않게 (표시·렌더링 공통) */
export function singleLine(text: string | null | undefined): string {
  return (text ?? "").replace(/\s*\r?\n+\s*/g, " ").trim();
}

/** 긴 문장은 글자 크기를 조금 줄여 한 줄에 담는다 (가장 긴 줄의 글자 수 기준) */
export function subtitleScale(text: string | null | undefined): number {
  if (!text) return 1;
  const longest = text.split("\n").reduce((m, l) => Math.max(m, [...l.trim()].length), 0);
  if (longest > 64) return 0.72;
  if (longest > 52) return 0.8;
  if (longest > 42) return 0.9;
  return 1;
}

export type OverlayPos = "bottom" | "top";
export const OVERLAY_X_RANGE = 45;
export const OVERLAY_Y_RANGE = 80;

export function clampOverlay(x: number, y: number): { x: number; y: number } {
  const r = (v: number, lim: number) => Math.max(-lim, Math.min(lim, Math.round(Number.isFinite(v) ? v : 0)));
  return { x: r(x, OVERLAY_X_RANGE), y: r(y, OVERLAY_Y_RANGE) };
}

export function overlayPlacement(pos: OverlayPos | string, x: number, y: number): CSSProperties {
  const left = `calc(50% + ${x}%)`;
  return pos === "top" ? { left, top: `calc(9% - ${y}%)` } : { left, bottom: `calc(12% + ${y}%)` };
}
