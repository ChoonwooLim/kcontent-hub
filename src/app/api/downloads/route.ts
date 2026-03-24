import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { existsSync, unlinkSync } from "fs";
import path from "path";

const REMOTE_BASE = "https://kcontentshub.twinverse.org";
const MEDIA_DIR = path.join(process.cwd(), "media", "downloads");
const LEGACY_DIR = path.join(process.cwd(), "tmp_downloads");

// GET /api/downloads — DB에서 다운로드 파일 목록 조회 (URL은 항상 Orbitron 서버)
export async function GET() {
  try {
    const ws = await prisma.workspace.findFirst();
    if (!ws) return NextResponse.json({ files: [] });

    const dbFiles = await prisma.downloadedFile.findMany({
      where: { workspaceId: ws.id },
      orderBy: { createdAt: "desc" },
      include: { video: { select: { title: true, ytVideoId: true, thumbnail: true } } },
    });

    return NextResponse.json({
      files: dbFiles.map(f => ({
        id: f.id,
        filename: f.filename,
        size: f.size,
        mode: f.mode,
        clipCount: f.clipCount,
        videoTitle: f.video?.title || "",
        ytVideoId: f.video?.ytVideoId || "",
        thumbnail: f.video?.thumbnail || "",
        url: `${REMOTE_BASE}/api/downloads/${encodeURIComponent(f.filename)}`,
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
        filepath: filepath || "",
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

// DELETE /api/downloads — deleteFile: true → 파일+DB 삭제, false → DB만 삭제(목록 제거)
export async function DELETE(req: NextRequest) {
  try {
    const { id, deleteFile } = await req.json();
    if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

    const file = await prisma.downloadedFile.findUnique({ where: { id } });
    if (!file) return NextResponse.json({ error: "레코드를 찾을 수 없습니다." }, { status: 404 });

    // 파일 삭제 (deleteFile: true일 때만)
    if (deleteFile) {
      const possiblePaths = [
        file.filepath,
        path.join(MEDIA_DIR, file.filename),
        path.join(MEDIA_DIR, "saved", file.filename),
        path.join(LEGACY_DIR, file.filename),
        path.join(LEGACY_DIR, "saved", file.filename),
      ];
      for (const fp of possiblePaths) {
        if (fp && existsSync(fp)) {
          try { unlinkSync(fp); } catch { /* ignore */ }
        }
      }
    }

    // DB 레코드 삭제
    await prisma.downloadedFile.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      deleted: file.filename,
      fileDeleted: !!deleteFile,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
