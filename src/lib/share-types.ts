/** 공유 링크 DTO — 클라이언트/서버 공용 (node 전용 모듈을 import 하지 않는다) */
import type { LangCode } from "@/lib/subtitle-lang";

export type ShareSub = {
  id: number;
  start: number;
  end: number;
  text: string;
  type: string;
  texts?: Partial<Record<LangCode, string>>;
};

export type RenderStatus = "queued" | "rendering" | "done" | "failed" | null;

export type ShareDto = {
  token: string;
  url: string;                 // /share/<token>
  title: string;
  videoId: string | null;
  fileVideoUrl: string | null;
  sourceLang: LangCode | null;
  activeLang: LangCode | null;
  secondaryLang: LangCode | null;
  preset: number;
  overlayPos: "bottom" | "top";
  overlayX: number;
  overlayY: number;
  isPublic: boolean;
  views: number;
  renderStatus: RenderStatus;
  renderProgress: number;
  renderError: string | null;
  renderedAt: string | null;
  downloadUrl: string | null;  // 렌더링 완료 시 /api/share/<token>/download
  createdAt: string;
  createdBy?: { name: string | null; email: string | null };
  subs?: ShareSub[];           // 뷰어/상세 조회에만 포함
  subCount: number;
};
