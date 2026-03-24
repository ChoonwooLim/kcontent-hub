import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { existsSync, readdirSync, statSync } from "fs";
import path from "path";

const TMP_DIR = path.join(process.cwd(), "tmp_downloads");
const SAVED_DIR = path.join(TMP_DIR, "saved");

// GET /api/downloads — DB + 파일시스템에서 다운로드 파일 목록 조회
export async function GET() {
  try {
    // 1. DB에서 조회 시도
    try {
      const ws = await prisma.workspace.findFirst();
      if (ws) {
        const dbFiles = await prisma.downloadedFile.findMany({
          where: { workspaceId: ws.id },
          orderBy: { createdAt: "desc" },
          include: { video: { select: { title: true, ytVideoId: true, thumbnail: true } } },
        });

        if (dbFiles.length > 0) {
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
              url: `/api/downloads/${encodeURIComponent(f.filename)}`,
              createdAt: f.createdAt.toISOString(),
            })),
          });
        }
      }
    } catch { /* DB 실패 시 파일시스템 폴백 */ }

    // 2. 파일시스템에서 검색 (DB가 비어있거나 실패한 경우)
    const videoFiles: { id: string; filename: string; url: string; size: number; createdAt: string }[] = [];

    const scanDir = (dir: string) => {
      if (!existsSync(dir)) return;
      for (const f of readdirSync(dir)) {
        if (f.endsWith(".mp4") || f.endsWith(".webm") || f.endsWith(".mkv")) {
          const fp = path.join(dir, f);
          try {
            const stat = statSync(fp);
            // 임시 작업 파일 제외 (job_ 접두어)
            if (!f.startsWith("job_")) {
              videoFiles.push({
                id: f,
                filename: f,
                url: `/api/downloads/${encodeURIComponent(f)}`,
                size: stat.size,
                createdAt: stat.birthtime.toISOString(),
              });
            }
          } catch { /* ignore */ }
        }
      }
    };

    scanDir(SAVED_DIR);
    scanDir(TMP_DIR);

    // 중복 제거 (파일명 기준)
    const seen = new Set<string>();
    const unique = videoFiles.filter(f => {
      if (seen.has(f.filename)) return false;
      seen.add(f.filename);
      return true;
    });

    unique.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ files: unique });
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
