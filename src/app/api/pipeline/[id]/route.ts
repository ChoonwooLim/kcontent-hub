import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/pipeline/[id] — 개별 영상 조회
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const video = await prisma.pipelineVideo.findUnique({
      where: { id },
      include: { editClips: { orderBy: { order: "asc" } }, outreaches: true, publishes: true },
    });
    if (!video) return NextResponse.json({ error: "영상을 찾을 수 없습니다" }, { status: 404 });
    return NextResponse.json({ video });
  } catch (e) {
    return NextResponse.json({ error: "조회 실패", detail: String(e) }, { status: 500 });
  }
}

// PATCH /api/pipeline/[id] — 영상 정보 수정 (stage 변경 등)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const video = await prisma.pipelineVideo.update({
      where: { id },
      data: body,
    });
    return NextResponse.json({ video });
  } catch (e) {
    return NextResponse.json({ error: "수정 실패", detail: String(e) }, { status: 500 });
  }
}

// DELETE /api/pipeline/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.pipelineVideo.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "삭제 실패", detail: String(e) }, { status: 500 });
  }
}
