import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync, statSync } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

const TMP_DIR = path.join(process.cwd(), "tmp_downloads");
const SAVED_DIR = path.join(TMP_DIR, "saved");
const REMOTE_BASE = "https://kcontentshub.twinverse.org";

// GET /api/downloads/[filename] — 영상 파일 스트리밍
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

  // 1. DB에 기록된 filepath로 직접 시도
  try {
    const dbFile = await prisma.downloadedFile.findFirst({
      where: { filename: decodedName },
      orderBy: { createdAt: "desc" },
    });
    if (dbFile?.filepath && existsSync(dbFile.filepath)) {
      const stat = statSync(dbFile.filepath);
      const buffer = readFileSync(dbFile.filepath);
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": mimeMap[ext] || "video/mp4",
          "Content-Length": stat.size.toString(),
          "Content-Disposition": `inline; filename="${encodeURIComponent(decodedName)}"`,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  } catch { /* DB 조회 실패 시 파일시스템 검색 */ }

  // 2. 로컬 파일 검색 (saved → tmp_downloads 루트 → tmp_downloads 하위)
  const searchPaths = [
    path.join(SAVED_DIR, decodedName),
    path.join(TMP_DIR, decodedName),
  ];

  for (const fp of searchPaths) {
    if (fp.startsWith(TMP_DIR) && existsSync(fp)) {
      const stat = statSync(fp);
      const buffer = readFileSync(fp);
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": mimeMap[ext] || "video/mp4",
          "Content-Length": stat.size.toString(),
          "Content-Disposition": `inline; filename="${encodeURIComponent(decodedName)}"`,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  }

  // 3. tmp_downloads 내 모든 하위 폴더에서 검색
  try {
    const { readdirSync } = await import("fs");
    const entries = readdirSync(TMP_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subPath = path.join(TMP_DIR, entry.name, decodedName);
        if (existsSync(subPath)) {
          const stat = statSync(subPath);
          const buffer = readFileSync(subPath);
          return new NextResponse(buffer, {
            headers: {
              "Content-Type": mimeMap[ext] || "video/mp4",
              "Content-Length": stat.size.toString(),
              "Content-Disposition": `inline; filename="${encodeURIComponent(decodedName)}"`,
              "Cache-Control": "public, max-age=3600",
            },
          });
        }
      }
    }
  } catch { /* ignore */ }

  // 4. 로컬에 없으면 → Orbitron 서버에서 프록시 (로컬 개발 시)
  if (!process.env.HOSTNAME?.includes("orbitron")) {
    try {
      const remoteUrl = `${REMOTE_BASE}/api/downloads/${encodeURIComponent(decodedName)}`;
      const remoteRes = await fetch(remoteUrl);
      if (remoteRes.ok && remoteRes.body) {
        const contentType = remoteRes.headers.get("Content-Type") || "video/mp4";
        const contentLength = remoteRes.headers.get("Content-Length") || "";
        return new NextResponse(remoteRes.body, {
          headers: {
            "Content-Type": contentType,
            ...(contentLength ? { "Content-Length": contentLength } : {}),
            "Content-Disposition": `inline; filename="${encodeURIComponent(decodedName)}"`,
            "Cache-Control": "public, max-age=3600",
          },
        });
      }
    } catch { /* remote fetch failed */ }
  }

  return NextResponse.json({ error: "파일을 찾을 수 없습니다.", searched: searchPaths }, { status: 404 });
}
