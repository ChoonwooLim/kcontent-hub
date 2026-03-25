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
    const { videoId, videoTitle, channelTitle, hasTranscript, title, thumbnailTop, thumbnailBottom, script, frames, captures } = body;

    if (videoId === undefined || !title || !script) {
      return NextResponse.json({ error: "videoId(또는 빈문자열), title, script는 필수입니다." }, { status: 400 });
    }

    // 같은 videoId로 이미 저장된 대본이 있으면 업데이트 (단, 로컬 영상 즉 videoId가 빈 문자열인 경우 제외 - 혹은 title로 매칭)
    let existing = null;
    if (videoId) {
      existing = await prisma.script.findFirst({ where: { videoId } });
    } else if (title) {
      // 로컬 영상의 경우 제목으로 구분 (동일 제목이면 덮어쓰기)
      existing = await prisma.script.findFirst({ where: { videoId: "", title } });
    }

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
          framesJson: frames ? JSON.stringify(frames) : existing.framesJson,
          capturesJson: captures ? JSON.stringify(captures) : existing.capturesJson,
          sceneCount: Array.isArray(script) ? script.length : 0,
        },
      });
      return NextResponse.json({ script: updated, action: "updated" });
    }

    // workspace 조회
    let workspaceId = "";
    try { const ws = await prisma.workspace.findFirst(); workspaceId = ws?.id || ""; } catch { /* ignore */ }

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
        framesJson: frames ? JSON.stringify(frames) : null,
        capturesJson: captures ? JSON.stringify(captures) : null,
        sceneCount: Array.isArray(script) ? script.length : 0,
        workspaceId,
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
