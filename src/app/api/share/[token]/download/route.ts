import { NextRequest, NextResponse } from "next/server";
import { createReadStream, existsSync, statSync } from "fs";
import { Readable } from "stream";
import { prisma } from "@/lib/prisma";
import { requireShareViewer } from "@/lib/share";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

/** GET /api/share/[token]/download[?inline=1] — 렌더링된 자막 번인 MP4 (Range 지원) */
export async function GET(req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const share = await prisma.subtitleShare.findUnique({ where: { token } });
  if (!share) return NextResponse.json({ error: "공유 링크를 찾을 수 없습니다." }, { status: 404 });
  const v = await requireShareViewer(share);
  if (v.error) return v.error;

  if (share.renderStatus !== "done" || !share.renderPath || !existsSync(share.renderPath)) {
    return NextResponse.json({ error: "아직 렌더링된 MP4 가 없습니다." }, { status: 404 });
  }

  const filePath = share.renderPath;
  const size = statSync(filePath).size;
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  const safeTitle = share.title.replace(/[\\/:*?"<>|\r\n]+/g, "_").trim().slice(0, 80) || "video";
  const filename = `${safeTitle}.${share.activeLang ?? "sub"}.mp4`;
  const headers: Record<string, string> = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="video.mp4"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Cache-Control": "private, max-age=0, must-revalidate",
  };

  const range = req.headers.get("range");
  if (range) {
    const m = range.match(/bytes=(\d*)-(\d*)/);
    const start = m && m[1] ? parseInt(m[1], 10) : 0;
    const end = m && m[2] ? Math.min(parseInt(m[2], 10), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
    headers["Content-Length"] = String(end - start + 1);
    const stream = Readable.toWeb(createReadStream(filePath, { start, end })) as unknown as ReadableStream;
    return new NextResponse(stream, { status: 206, headers });
  }

  headers["Content-Length"] = String(size);
  const stream = Readable.toWeb(createReadStream(filePath)) as unknown as ReadableStream;
  return new NextResponse(stream, { status: 200, headers });
}
