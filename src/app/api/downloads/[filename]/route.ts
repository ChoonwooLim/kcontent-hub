import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync, statSync, readdirSync } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

const TMP_DIR = path.join(process.cwd(), "tmp_downloads");
const SAVED_DIR = path.join(TMP_DIR, "saved");

// GET /api/downloads/[filename] — 서버에 저장된 영상 파일 스트리밍
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const decodedName = decodeURIComponent(filename);
  const ext = path.extname(decodedName).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mkv": "video/x-matroska",
  };

  // 보안 헬퍼
  const serve = (fp: string) => {
    const stat = statSync(fp);
    const buffer = readFileSync(fp);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeMap[ext] || "video/mp4",
        "Content-Length": stat.size.toString(),
        "Content-Disposition": `inline; filename="${encodeURIComponent(decodedName)}"`,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  };

  // 1. DB filepath 직접 사용
  try {
    const dbFile = await prisma.downloadedFile.findFirst({
      where: { filename: decodedName },
      orderBy: { createdAt: "desc" },
    });
    if (dbFile?.filepath && existsSync(dbFile.filepath)) {
      return serve(dbFile.filepath);
    }
  } catch { /* ignore */ }

  // 2. saved → root 검색
  for (const dir of [SAVED_DIR, TMP_DIR]) {
    const fp = path.join(dir, decodedName);
    if (fp.startsWith(TMP_DIR) && existsSync(fp)) {
      return serve(fp);
    }
  }

  // 3. 하위 폴더 검색
  try {
    if (existsSync(TMP_DIR)) {
      for (const entry of readdirSync(TMP_DIR, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const fp = path.join(TMP_DIR, entry.name, decodedName);
          if (existsSync(fp)) return serve(fp);
        }
      }
    }
  } catch { /* ignore */ }

  return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
}
