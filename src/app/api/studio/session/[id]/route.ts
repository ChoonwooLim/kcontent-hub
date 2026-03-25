import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/studio/session/[id] — 개별 세션 조회 (자막 데이터 포함)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await prisma.studioSession.findUnique({ where: { id } });
    if (!session) return NextResponse.json({ error: "세션을 찾을 수 없습니다" }, { status: 404 });

    return NextResponse.json({
      session: {
        ...session,
        subs: JSON.parse(session.subsJson),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: `조회 실패: ${String(e).slice(0, 200)}` }, { status: 500 });
  }
}

// DELETE /api/studio/session/[id] — 개별 세션 삭제
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.studioSession.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: `삭제 실패: ${String(e).slice(0, 200)}` }, { status: 500 });
  }
}
