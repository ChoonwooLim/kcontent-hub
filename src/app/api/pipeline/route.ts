import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/pipeline — 전체 파이프라인 영상 목록
export async function GET() {
  try {
    const videos = await prisma.pipelineVideo.findMany({
      orderBy: { createdAt: "desc" },
      include: { publishes: true },
    });
    return NextResponse.json({ videos });
  } catch (e) {
    return NextResponse.json({ error: "DB 오류", detail: String(e) }, { status: 500 });
  }
}

// POST /api/pipeline — 새 영상 추가 (소재 수집기에서 호출)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const video = await prisma.pipelineVideo.create({ data: body });
    return NextResponse.json({ video }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "생성 실패", detail: String(e) }, { status: 500 });
  }
}
