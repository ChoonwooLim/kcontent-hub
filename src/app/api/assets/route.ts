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

    // 자막 스튜디오에서 저장한 썸네일 (Base64) 로드
    const sessions = await prisma.studioSession.findMany({
      where: {
        thumbnail: { startsWith: "data:image" }
      },
      select: {
        id: true,
        name: true,
        videoId: true,
        thumbnail: true,
        updatedAt: true,
      }
    });

    for (const s of sessions) {
      if (!s.thumbnail) continue;
      captures.push({
        scriptId: `studio_${s.id}`,
        scriptTitle: s.name ? `[스튜디오] ${s.name}` : "[스튜디오] 원본 영상",
        videoId: s.videoId || "",
        id: `studio_cap_${s.id}`,
        name: `studio_thumbnail_${s.id}`,
        dataUrl: s.thumbnail,
        time: "커버 이미지",
        sceneType: "스튜디오",
        sceneText: "자막스튜디오에서 지정한 썸네일 이미지입니다.",
        capturedAt: new Date(s.updatedAt).getTime(),
      });
    }

    // 최신순 정렬
    captures.sort((a, b) => b.capturedAt - a.capturedAt);

    return NextResponse.json({ captures });
  } catch (err) {
    return NextResponse.json({ captures: [], error: String(err) }, { status: 500 });
  }
}
