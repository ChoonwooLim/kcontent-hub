import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/access";
import { isLangCode } from "@/lib/subtitle-lang";
import { canManageShare, requireShareViewer, toShareDto } from "@/lib/share";
import { removeRenderFile } from "@/lib/render";
import { clampOverlay } from "@/lib/subtitle-presets";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

/** GET /api/share/[token] — 공유 상세 (자막 포함). 비공개 링크는 로그인 필요(등급 무관) */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const share = await prisma.subtitleShare.findUnique({
    where: { token },
    include: { createdBy: { select: { name: true, email: true } } },
  });
  if (!share) return NextResponse.json({ error: "공유 링크를 찾을 수 없습니다." }, { status: 404 });
  const v = await requireShareViewer(share);
  if (v.error) return v.error;
  return NextResponse.json({ share: toShareDto(share, { includeSubs: true }) });
}

/** PATCH /api/share/[token] — 소유자/관리자: { isPublic?, title?, secondaryLang?, preset?, overlayPos? } */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const g = await requireUser();
  if (g.error) return g.error;
  const share = await prisma.subtitleShare.findUnique({ where: { token } });
  if (!share) return NextResponse.json({ error: "공유 링크를 찾을 수 없습니다." }, { status: 404 });
  if (!canManageShare(share, g.user)) return NextResponse.json({ error: "이 공유 링크를 수정할 권한이 없습니다." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const data: { isPublic?: boolean; title?: string; secondaryLang?: string | null; preset?: number; overlayPos?: string; overlayX?: number; overlayY?: number } = {};
  if (typeof body.isPublic === "boolean") data.isPublic = body.isPublic;
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim().slice(0, 200);
  if (body.secondaryLang === null || body.secondaryLang === "") data.secondaryLang = null;
  else if (isLangCode(body.secondaryLang)) data.secondaryLang = body.secondaryLang;
  if (Number.isInteger(body.preset) && body.preset >= 0 && body.preset <= 3) data.preset = body.preset;
  if (body.overlayPos === "top" || body.overlayPos === "bottom") data.overlayPos = body.overlayPos;
  if (typeof body.overlayX === "number" || typeof body.overlayY === "number") {
    const o = clampOverlay(typeof body.overlayX === "number" ? body.overlayX : share.overlayX, typeof body.overlayY === "number" ? body.overlayY : share.overlayY);
    data.overlayX = o.x; data.overlayY = o.y;
  }

  const updated = await prisma.subtitleShare.update({
    where: { id: share.id }, data,
    include: { createdBy: { select: { name: true, email: true } } },
  });
  return NextResponse.json({ share: toShareDto(updated) });
}

/** DELETE /api/share/[token] — 소유자/관리자. 렌더링 결과 파일도 함께 삭제 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const g = await requireUser();
  if (g.error) return g.error;
  const share = await prisma.subtitleShare.findUnique({ where: { token } });
  if (!share) return NextResponse.json({ error: "공유 링크를 찾을 수 없습니다." }, { status: 404 });
  if (!canManageShare(share, g.user)) return NextResponse.json({ error: "이 공유 링크를 삭제할 권한이 없습니다." }, { status: 403 });

  await prisma.subtitleShare.delete({ where: { id: share.id } });
  removeRenderFile(share.renderPath);
  return NextResponse.json({ success: true });
}
