import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// workspace ID를 안전하게 가져오는 헬퍼
async function getWorkspaceId(): Promise<string | null> {
  try {
    const ws = await prisma.workspace.findFirst();
    return ws?.id || null;
  } catch { return null; }
}

// GET /api/studio/session — 저장된 세션 목록
export async function GET() {
  try {
    const workspaceId = await getWorkspaceId();
    if (!workspaceId) return NextResponse.json({ sessions: [] });

    const sessions = await prisma.studioSession.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        videoId: true,
        fileVideoUrl: true,
        videoTitle: true,
        subCount: true,
        step: true,
        method: true,
        preset: true,
        thumbnail: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ sessions });
  } catch (e) {
    return NextResponse.json({ sessions: [], error: String(e) });
  }
}

// POST /api/studio/session — 세션 저장 (upsert: 같은 영상이면 업데이트)
export async function POST(req: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId();
    if (!workspaceId) return NextResponse.json({ error: "워크스페이스를 찾을 수 없습니다." }, { status: 403 });

    const body = await req.json();
    const { videoId, fileVideoUrl, videoTitle, subs, step, method, preset, thumbnail } = body;

    if (!subs || !Array.isArray(subs) || subs.length === 0) {
      return NextResponse.json({ error: "저장할 자막 데이터가 없습니다." }, { status: 400 });
    }

    const name = videoTitle || (videoId ? `YouTube ${videoId}` : "작업 세션");

    // 같은 영상에 대한 기존 세션이 있으면 업데이트
    const lookupKey = videoId || fileVideoUrl || "";
    let existing = null;
    if (lookupKey) {
      existing = await prisma.studioSession.findFirst({
        where: {
          workspaceId,
          OR: [
            { videoId: videoId || undefined },
            { fileVideoUrl: fileVideoUrl || undefined },
          ].filter(c => Object.values(c).some(v => v !== undefined)),
        },
      });
    }

    if (existing) {
      const updated = await prisma.studioSession.update({
        where: { id: existing.id },
        data: {
          name,
          videoTitle: videoTitle || existing.videoTitle,
          subsJson: JSON.stringify(subs),
          subCount: subs.length,
          step: step || existing.step,
          method: method || existing.method,
          preset: preset ?? existing.preset,
          thumbnail: thumbnail || existing.thumbnail,
        },
      });
      return NextResponse.json({ session: updated, action: "updated" });
    }

    const created = await prisma.studioSession.create({
      data: {
        name,
        videoId: videoId || null,
        fileVideoUrl: fileVideoUrl || null,
        videoTitle: videoTitle || "",
        subsJson: JSON.stringify(subs),
        subCount: subs.length,
        step: step || null,
        method: method || null,
        preset: preset ?? 0,
        thumbnail: thumbnail || null,
        workspaceId,
      },
    });

    return NextResponse.json({ session: created, action: "created" }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: `저장 실패: ${String(e).slice(0, 300)}` }, { status: 500 });
  }
}

// DELETE /api/studio/session — 세션 삭제
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

    await prisma.studioSession.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: `삭제 실패: ${String(e).slice(0, 200)}` }, { status: 500 });
  }
}
