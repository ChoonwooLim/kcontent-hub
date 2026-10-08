import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/access";
import { canManageShare, requireShareViewer } from "@/lib/share";
import { enqueueRender } from "@/lib/render";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

function statusPayload(s: { token: string; renderStatus: string | null; renderProgress: number; renderError: string | null; renderedAt: Date | null }) {
  return {
    status: s.renderStatus ?? null,
    progress: s.renderProgress,
    error: s.renderError,
    renderedAt: s.renderedAt ? s.renderedAt.toISOString() : null,
    downloadUrl: s.renderStatus === "done" ? `/api/share/${s.token}/download` : null,
  };
}

/** GET /api/share/[token]/render — 렌더링 상태 (열람 권한자) */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const share = await prisma.subtitleShare.findUnique({ where: { token } });
  if (!share) return NextResponse.json({ error: "공유 링크를 찾을 수 없습니다." }, { status: 404 });
  const v = await requireShareViewer(share);
  if (v.error) return v.error;
  return NextResponse.json(statusPayload(share));
}

/** POST /api/share/[token]/render — 자막 번인 MP4 렌더링 시작 (소유자/관리자). body: { force?: boolean } */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const g = await requireUser();
  if (g.error) return g.error;
  const share = await prisma.subtitleShare.findUnique({ where: { token } });
  if (!share) return NextResponse.json({ error: "공유 링크를 찾을 수 없습니다." }, { status: 404 });
  if (!canManageShare(share, g.user)) return NextResponse.json({ error: "렌더링을 시작할 권한이 없습니다." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const inFlight = share.renderStatus === "queued" || share.renderStatus === "rendering";
  // 10분 넘게 진행 중 상태로 멈춘 작업(서버 재시작 등)은 재시작 허용
  const stale = inFlight && Date.now() - share.updatedAt.getTime() > 10 * 60 * 1000;
  if (inFlight && !stale && !body.force) {
    return NextResponse.json({ ...statusPayload(share), error: "이미 렌더링이 진행 중입니다." }, { status: 409 });
  }

  const queued = await prisma.subtitleShare.update({
    where: { id: share.id },
    data: { renderStatus: "queued", renderProgress: 0, renderError: null },
  });
  enqueueRender(share.id);
  return NextResponse.json(statusPayload(queued), { status: 202 });
}
