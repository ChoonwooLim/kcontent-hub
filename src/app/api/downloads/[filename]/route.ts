import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync, statSync } from "fs";
import path from "path";

const SAVED_DIR = path.join(process.cwd(), "tmp_downloads", "saved");

// GET /api/downloads/[filename] — 영상 파일 스트리밍
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const decodedName = decodeURIComponent(filename);
  const filepath = path.join(SAVED_DIR, decodedName);

  // 보안: path traversal 방지
  if (!filepath.startsWith(SAVED_DIR) || !existsSync(filepath)) {
    return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
  }

  const stat = statSync(filepath);
  const buffer = readFileSync(filepath);
  const ext = path.extname(decodedName).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mkv": "video/x-matroska",
  };

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": mimeMap[ext] || "video/mp4",
      "Content-Length": stat.size.toString(),
      "Content-Disposition": `inline; filename="${encodeURIComponent(decodedName)}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
