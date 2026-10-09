import { randomBytes } from "crypto";
import type { SubtitleShare } from "@prisma/client";
import { NextResponse } from "next/server";
import type { CurrentUser } from "@/lib/access";
import { requireUser } from "@/lib/access";
import { isLangCode } from "@/lib/subtitle-lang";
import type { ShareDto, ShareSub } from "@/lib/share-types";

/** URL 토큰 — 12자 base64url (72bit) */
export function newShareToken(): string {
  return randomBytes(9).toString("base64url");
}

export function canManageShare(share: Pick<SubtitleShare, "createdById">, user: CurrentUser): boolean {
  return share.createdById === user.id || user.role === "ADMIN";
}

type ShareWithCreator = SubtitleShare & { createdBy?: { name: string | null; email: string | null } | null };

export function toShareDto(s: ShareWithCreator, opts: { includeSubs?: boolean } = {}): ShareDto {
  let subs: ShareSub[] = [];
  try { subs = JSON.parse(s.subsJson || "[]"); } catch { subs = []; }
  const status = (s.renderStatus as ShareDto["renderStatus"]) ?? null;
  return {
    token: s.token,
    url: `/share/${s.token}`,
    title: s.title,
    videoId: s.videoId,
    fileVideoUrl: s.fileVideoUrl,
    sourceLang: isLangCode(s.sourceLang) ? s.sourceLang : null,
    activeLang: isLangCode(s.activeLang) ? s.activeLang : null,
    secondaryLang: isLangCode(s.secondaryLang) ? s.secondaryLang : null,
    preset: s.preset,
    overlayPos: s.overlayPos === "top" ? "top" : "bottom",
    overlayX: s.overlayX,
    overlayY: s.overlayY,
    isPublic: s.isPublic,
    views: s.views,
    renderStatus: status,
    renderProgress: s.renderProgress,
    renderError: s.renderError,
    renderedAt: s.renderedAt ? s.renderedAt.toISOString() : null,
    downloadUrl: status === "done" ? `/api/share/${s.token}/download` : null,
    createdAt: s.createdAt.toISOString(),
    createdBy: s.createdBy ? { name: s.createdBy.name, email: s.createdBy.email } : undefined,
    subs: opts.includeSubs ? subs : undefined,
    subCount: subs.length,
  };
}

/**
 * 열람 권한: 공개 링크는 누구나, 비공개 링크는 로그인한 회원 누구나(등급 무관 — 일반 회원도 가능).
 * 통과하면 { user } (공개 링크는 user 가 null 일 수 있음), 아니면 { error }.
 */
export async function requireShareViewer(
  share: Pick<SubtitleShare, "isPublic">,
): Promise<{ user: CurrentUser | null; error?: undefined } | { user?: undefined; error: NextResponse }> {
  if (share.isPublic) return { user: null };
  const g = await requireUser();
  if (g.error) return { error: g.error };
  return { user: g.user };
}

export function sanitizeSubs(raw: unknown): ShareSub[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 5000) return null;
  const out: ShareSub[] = [];
  for (const s of raw as Record<string, unknown>[]) {
    const start = Number(s.start), end = Number(s.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    const texts: ShareSub["texts"] = {};
    if (s.texts && typeof s.texts === "object") {
      for (const [k, v] of Object.entries(s.texts as Record<string, unknown>)) {
        if (isLangCode(k) && typeof v === "string") texts[k] = v.slice(0, 2000);
      }
    }
    out.push({
      id: Number(s.id) || out.length + 1,
      start, end,
      text: String(s.text ?? "").slice(0, 2000),
      type: typeof s.type === "string" ? s.type : "narration",
      texts: Object.keys(texts).length ? texts : undefined,
    });
  }
  return out;
}
