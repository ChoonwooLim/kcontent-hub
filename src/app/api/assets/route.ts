import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const scripts = await prisma.script.findMany({
      where: {
        capturesJson: { not: null }
      },
      select: {
        id: true,
        title: true,
        videoId: true,
        capturesJson: true,
        createdAt: true,
      }
    });

    const captures = [];
    for (const s of scripts) {
      if (!s.capturesJson || s.capturesJson === "null" || s.capturesJson === "[]") continue;
      try {
        const caps = JSON.parse(s.capturesJson);
        for (const c of caps) {
          captures.push({
            scriptId: s.id,
            scriptTitle: s.title,
            videoId: s.videoId,
            id: c.id,
            name: c.name,
            dataUrl: c.dataUrl,
            time: c.time,
            sceneType: c.sceneType,
            sceneText: c.sceneText,
            capturedAt: c.capturedAt || new Date(s.createdAt).getTime(),
          });
        }
      } catch { /* ignore */ }
    }

    // 최신순 정렬
    captures.sort((a, b) => b.capturedAt - a.capturedAt);

    return NextResponse.json({ captures });
  } catch (err) {
    return NextResponse.json({ captures: [], error: String(err) }, { status: 500 });
  }
}
