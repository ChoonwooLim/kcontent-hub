import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/pipeline/[id]/clips — 클립 목록 조회
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const clips = await prisma.editClip.findMany({
      where: { videoId: id },
      orderBy: { order: "asc" },
    });
    return NextResponse.json({ clips });
  } catch (e) {
    return NextResponse.json({ error: "클립 조회 실패", detail: String(e) }, { status: 500 });
  }
}

// POST /api/pipeline/[id]/clips — 클립 추가
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { startTime, endTime, label, note } = body;

    // 현재 클립 수 → order 결정
    const count = await prisma.editClip.count({ where: { videoId: id } });

    const clip = await prisma.editClip.create({
      data: {
        videoId: id,
        startTime: startTime || "00:00:00",
        endTime: endTime || "00:00:30",
        label: label || null,
        note: note || null,
        order: count,
        included: true,
      },
    });

    // 요약 편집 단계로 stage 변경
    await prisma.pipelineVideo.update({
      where: { id },
      data: { stage: "요약 편집" },
    });

    return NextResponse.json({ clip }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "클립 추가 실패", detail: String(e) }, { status: 500 });
  }
}

// PATCH /api/pipeline/[id]/clips — 클립 일괄 업데이트 (순서 변경, 포함/제외 등)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { clips } = await req.json() as {
      clips: { id: string; order?: number; startTime?: string; endTime?: string; label?: string; note?: string; included?: boolean }[];
    };

    for (const c of clips) {
      await prisma.editClip.update({
        where: { id: c.id },
        data: {
          ...(c.order !== undefined && { order: c.order }),
          ...(c.startTime !== undefined && { startTime: c.startTime }),
          ...(c.endTime !== undefined && { endTime: c.endTime }),
          ...(c.label !== undefined && { label: c.label }),
          ...(c.note !== undefined && { note: c.note }),
          ...(c.included !== undefined && { included: c.included }),
        },
      });
    }

    // 총 길이 계산 (포함된 클립만)
    const allClips = await prisma.editClip.findMany({
      where: { videoId: id, included: true },
    });
    const totalSeconds = allClips.reduce((acc, clip) => {
      return acc + (timeToSec(clip.endTime) - timeToSec(clip.startTime));
    }, 0);

    await prisma.pipelineVideo.update({
      where: { id },
      data: { summaryDuration: Math.round(totalSeconds) },
    });

    return NextResponse.json({ updated: clips.length, totalSeconds: Math.round(totalSeconds) });
  } catch (e) {
    return NextResponse.json({ error: "클립 업데이트 실패", detail: String(e) }, { status: 500 });
  }
}

// DELETE /api/pipeline/[id]/clips — 개별 클립 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params; // consume params
  try {
    const { searchParams } = new URL(req.url);
    const clipId = searchParams.get("clipId");
    if (!clipId) return NextResponse.json({ error: "clipId 필요" }, { status: 400 });
    await prisma.editClip.delete({ where: { id: clipId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "클립 삭제 실패", detail: String(e) }, { status: 500 });
  }
}

function timeToSec(t: string): number {
  const p = t.split(":").map(Number);
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  return p[0] * 60 + (p[1] || 0);
}
