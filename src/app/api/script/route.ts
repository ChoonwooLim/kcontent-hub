import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET — 저장된 대본 목록 조회
export async function GET() {
  try {
    const scripts = await prisma.script.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        videoId: true,
        videoTitle: true,
        channelTitle: true,
        hasTranscript: true,
        title: true,
        thumbnailTop: true,
        thumbnailBottom: true,
        sceneCount: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ scripts });
  } catch (err) {
    // DB 연결 실패 시 빈 배열 + 에러 정보
    return NextResponse.json({ scripts: [], dbError: String(err) });
  }
}

// POST — 대본 저장
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { videoId, videoTitle, channelTitle, hasTranscript, title, thumbnailTop, thumbnailBottom, script } = body;

    if (!videoId || !title || !script) {
      return NextResponse.json({ error: "videoId, title, script는 필수입니다." }, { status: 400 });
    }

    // 같은 videoId로 이미 저장된 대본이 있으면 업데이트, 없으면 새로 생성
    const existing = await prisma.script.findFirst({ where: { videoId } });

    if (existing) {
      const updated = await prisma.script.update({
        where: { id: existing.id },
        data: {
          videoTitle: videoTitle || existing.videoTitle,
          channelTitle: channelTitle || existing.channelTitle,
          hasTranscript: hasTranscript ?? existing.hasTranscript,
          title,
          thumbnailTop: thumbnailTop || existing.thumbnailTop,
          thumbnailBottom: thumbnailBottom || existing.thumbnailBottom,
          scriptJson: JSON.stringify(script),
          sceneCount: Array.isArray(script) ? script.length : 0,
        },
      });
      return NextResponse.json({ script: updated, action: "updated" });
    }

    const created = await prisma.script.create({
      data: {
        videoId,
        videoTitle: videoTitle || "",
        channelTitle: channelTitle || "",
        hasTranscript: hasTranscript ?? false,
        title,
        thumbnailTop: thumbnailTop || "",
        thumbnailBottom: thumbnailBottom || "",
        scriptJson: JSON.stringify(script),
        sceneCount: Array.isArray(script) ? script.length : 0,
      },
    });
    return NextResponse.json({ script: created, action: "created" });
  } catch {
    // DB 미연결 시 (로컬 개발 환경)
    return NextResponse.json({ script: null, action: "skipped", message: "DB 미연결 — 배포 환경에서 자동 저장됩니다" });
  }
}

// DELETE — 대본 삭제
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id 파라미터가 필요합니다." }, { status: 400 });
    }
    await prisma.script.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, message: "DB 미연결" });
  }
}
