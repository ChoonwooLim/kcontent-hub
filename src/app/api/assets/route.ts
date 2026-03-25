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
        OR: [
          { thumbnail: { startsWith: "data:image" } },
          { thumbnailsJson: { not: null } }
        ]
      },
      select: {
        id: true,
        name: true,
        videoId: true,
        thumbnail: true,
        thumbnailsJson: true,
        updatedAt: true,
      }
    });

    for (const s of sessions) {
      let thumbs: string[] = [];
      if (s.thumbnailsJson && s.thumbnailsJson !== "null" && s.thumbnailsJson !== "[]") {
         try { thumbs = JSON.parse(s.thumbnailsJson); } catch {}
      } else if (s.thumbnail?.startsWith("data:image")) {
         thumbs = [s.thumbnail];
      }

      thumbs.forEach((thumb, idx) => {
        captures.push({
          scriptId: `studio_${s.id}`,
          scriptTitle: s.name ? `[스튜디오] ${s.name}` : "[스튜디오] 원본 영상",
          videoId: s.videoId || "",
          id: `studio_cap_${s.id}_${idx}`,
          name: `studio_thumbnail_${s.id}_${idx}`,
          dataUrl: thumb,
          time: "스튜디오 캡처",
          sceneType: "스튜디오",
          sceneText: idx === 0 ? "자막스튜디오 커버 이미지입니다." : "자막스튜디오 추가 캡처 이미지입니다.",
          capturedAt: new Date(s.updatedAt).getTime() - idx, // 순서 정렬
        });
      });
    }

    // 최신순 정렬
    captures.sort((a, b) => b.capturedAt - a.capturedAt);

    return NextResponse.json({ captures });
  } catch (err) {
    return NextResponse.json({ captures: [], error: String(err) }, { status: 500 });
  }
}
