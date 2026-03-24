import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/downloads — DB에서 다운로드 파일 목록 조회
export async function GET() {
  try {
    // workspace 조회
    const ws = await prisma.workspace.findFirst();
    if (!ws) return NextResponse.json({ files: [] });

    const files = await prisma.downloadedFile.findMany({
      where: { workspaceId: ws.id },
      orderBy: { createdAt: "desc" },
      include: { video: { select: { title: true, ytVideoId: true, thumbnail: true } } },
    });

    return NextResponse.json({
      files: files.map(f => ({
        id: f.id,
        filename: f.filename,
        filepath: f.filepath,
        size: f.size,
        mode: f.mode,
        clipCount: f.clipCount,
        videoTitle: f.video?.title || "",
        ytVideoId: f.video?.ytVideoId || "",
        thumbnail: f.video?.thumbnail || "",
        url: `/api/downloads/${encodeURIComponent(f.filename)}`,
        createdAt: f.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/downloads — 다운로드 완료 시 DB에 기록
export async function POST(req: NextRequest) {
  try {
    const { filename, filepath, size, mode, clipCount, videoId } = await req.json();

    const ws = await prisma.workspace.findFirst();
    if (!ws) return NextResponse.json({ error: "No workspace" }, { status: 403 });

    const record = await prisma.downloadedFile.create({
      data: {
        filename,
        filepath,
        size: size || 0,
        mode: mode || "merged",
        clipCount: clipCount || 0,
        videoId: videoId || null,
        workspaceId: ws.id,
      },
    });

    return NextResponse.json({ file: record }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
