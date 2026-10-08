import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/access";
import { isLangCode } from "@/lib/subtitle-lang";
import { newShareToken, sanitizeSubs, toShareDto } from "@/lib/share";

export const runtime = "nodejs";

/** GET /api/share?videoId=…|fileVideoUrl=… — 내가 만든 공유 링크 목록 (관리자는 전체) */
export async function GET(req: NextRequest) {
  const g = await requireUser();
  if (g.error) return g.error;
  const url = new URL(req.url);
  const videoId = url.searchParams.get("videoId");
  const fileVideoUrl = url.searchParams.get("fileVideoUrl");

  const shares = await prisma.subtitleShare.findMany({
    where: {
      ...(g.user.role === "ADMIN" && url.searchParams.get("all") ? {} : { createdById: g.user.id }),
      ...(videoId ? { videoId } : {}),
      ...(fileVideoUrl ? { fileVideoUrl } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { createdBy: { select: { name: true, email: true } } },
  });
  return NextResponse.json({ shares: shares.map(s => toShareDto(s)) });
}

/**
 * POST /api/share — 현재 자막 작업으로 공유 링크 생성
 * body: { title, videoId?, fileVideoUrl?, subs, sourceLang?, activeLang?, secondaryLang?, preset?, overlayPos?, isPublic? }
 */
export async function POST(req: NextRequest) {
  const g = await requireUser();
  if (g.error) return g.error;

  const body = await req.json().catch(() => ({}));
  const videoId = typeof body.videoId === "string" && body.videoId.trim() ? body.videoId.trim() : null;
  const fileVideoUrl = typeof body.fileVideoUrl === "string" && body.fileVideoUrl.trim() ? body.fileVideoUrl.trim() : null;
  if (!videoId && !fileVideoUrl) return NextResponse.json({ error: "공유할 영상(YouTube ID 또는 서버 파일)이 없습니다." }, { status: 400 });
  if (videoId && !/^[\w-]{6,20}$/.test(videoId)) return NextResponse.json({ error: "잘못된 YouTube 영상 ID 입니다." }, { status: 400 });

  const subs = sanitizeSubs(body.subs);
  if (!subs) return NextResponse.json({ error: "공유할 자막이 없습니다. 먼저 자막을 추출·번역하세요." }, { status: 400 });

  const title = String(body.title ?? "").trim().slice(0, 200) || (videoId ? `YouTube ${videoId}` : "자막 영상");
  const preset = Number.isInteger(body.preset) && body.preset >= 0 && body.preset <= 3 ? body.preset : 0;

  let ws: { id: string } | null = null;
  try { ws = await prisma.workspace.findFirst({ select: { id: true } }); } catch { /* optional */ }

  const share = await prisma.subtitleShare.create({
    data: {
      token: newShareToken(),
      title,
      videoId,
      fileVideoUrl,
      subsJson: JSON.stringify(subs),
      sourceLang: isLangCode(body.sourceLang) ? body.sourceLang : null,
      activeLang: isLangCode(body.activeLang) ? body.activeLang : null,
      secondaryLang: isLangCode(body.secondaryLang) ? body.secondaryLang : null,
      preset,
      overlayPos: body.overlayPos === "top" ? "top" : "bottom",
      isPublic: body.isPublic === true,
      createdById: g.user.id,
      workspaceId: ws?.id ?? null,
    },
    include: { createdBy: { select: { name: true, email: true } } },
  });

  return NextResponse.json({ share: toShareDto(share) }, { status: 201 });
}
