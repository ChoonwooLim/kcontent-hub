import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/pipeline/[id] — 단계 변경 등 업데이트
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const video = await prisma.pipelineVideo.update({
      where: { id },
      data: body,
    });
    return NextResponse.json({ video });
  } catch (e) {
    return NextResponse.json({ error: "업데이트 실패", detail: String(e) }, { status: 500 });
  }
}

// DELETE /api/pipeline/[id]
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.pipelineVideo.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return NextResponse.json({ error: "삭제 실패", detail: String(e) }, { status: 500 });
  }
}
