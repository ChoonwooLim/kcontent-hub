import { NextRequest, NextResponse } from "next/server";

/**
 * YouTube 이미지 프록시 API
 * 브라우저에서 직접 ytimg.com 이미지를 불러올 때 CORS 문제를 방지합니다.
 * 
 * GET /api/script/storyboard?proxy=ENCODED_URL
 * POST /api/script/storyboard  { videoId, timestamps, storyboardSpec? }
 */

function timeToSeconds(time: string): number {
  const parts = time.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + parts[1];
}

interface FrameResult {
  time: string;
  imageUrl: string;
  type: "storyboard" | "thumbnail";
  bgX: number;
  bgY: number;
  frameW: number;
  frameH: number;
  sheetW: number;
  sheetH: number;
}

// ── GET: 이미지 프록시 ──────────────────────────────────────────
export async function GET(req: NextRequest) {
  const proxyUrl = req.nextUrl.searchParams.get("proxy");
  if (!proxyUrl) {
    return NextResponse.json({ error: "proxy URL이 필요합니다." }, { status: 400 });
  }

  // ytimg.com 도메인만 허용 (보안)
  try {
    const url = new URL(proxyUrl);
    if (!url.hostname.endsWith("ytimg.com") && !url.hostname.endsWith("youtube.com")) {
      return NextResponse.json({ error: "허용되지 않은 도메인" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "잘못된 URL" }, { status: 400 });
  }

  try {
    const res = await fetch(proxyUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://www.youtube.com/",
      },
    });

    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") ?? "image/jpeg";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}

// ── POST: 스토리보드 프레임 계산 ────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { videoId, timestamps, storyboardSpec } = body as {
    videoId: string;
    timestamps: string[];
    storyboardSpec?: string; // 클라이언트가 직접 추출한 spec
  };

  if (!videoId || !timestamps?.length) {
    return NextResponse.json({ error: "videoId와 timestamps가 필요합니다." }, { status: 400 });
  }

  // ── 스토리보드 spec 확보 ──────────────────────────────────────
  let spec = storyboardSpec || null;

  // 클라이언트가 spec을 안 보내면 서버에서 시도
  if (!spec) {
    // InnerTube API 시도 (타임아웃 5초)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(
        "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            context: {
              client: {
                clientName: "WEB",
                clientVersion: "2.20241201.00.00",
                hl: "en",
              },
            },
            videoId,
          }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        spec =
          data?.storyboards?.playerStoryboardSpecRenderer?.spec ??
          data?.storyboards?.playerLiveStoryboardSpecRenderer?.spec ??
          null;
      }
    } catch {
      // InnerTube 실패 — HTML 파싱 시도
    }

    // HTML 파싱 폴백 (타임아웃 5초)
    if (!spec) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const html = await res.text();
        const m = html.match(/"playerStoryboardSpecRenderer":\{"spec":"(https:[^"]+)"/);
        if (m) spec = m[1];

        if (!spec) {
          const idx = html.indexOf("playerStoryboardSpecRenderer");
          if (idx !== -1) {
            const chunk = html.slice(idx, idx + 3000);
            const m2 = chunk.match(/"spec"\s*:\s*"(https:[^"]+)"/);
            if (m2) spec = m2[1];
          }
        }
      } catch {
        // HTML 파싱도 실패
      }
    }
  }

  // ── 스토리보드 파싱 성공 시 ────────────────────────────────────
  if (spec) {
    const decoded = spec
      .replace(/\\u0026/g, "&")
      .replace(/\\\//g, "/")
      .replace(/\\n/g, "")
      .replace(/\\t/g, "\t");

    const levels = decoded.split("\t").filter((s) => s.includes("ytimg.com"));
    const bestLevel = levels.length > 1 ? levels[1] : levels[0] ?? decoded;
    const parts = bestLevel.split("|");

    if (parts.length >= 6 && parts[0].includes("ytimg.com")) {
      const baseUrl = parts[0];
      const frameW = Math.max(1, parseInt(parts[1]) || 160);
      const frameH = Math.max(1, parseInt(parts[2]) || 90);
      const cols = Math.max(1, parseInt(parts[3]) || 10);
      const rows = Math.max(1, parseInt(parts[4]) || 10);
      const intervalMs = Math.max(1, parseInt(parts[5]) || 5000);
      const framesPerSheet = cols * rows;

      const frames: FrameResult[] = timestamps.map((time: string) => {
        const ms = timeToSeconds(time) * 1000;
        const frameIndex = Math.max(0, Math.floor(ms / intervalMs));
        const sheetIndex = Math.floor(frameIndex / framesPerSheet);
        const posInSheet = frameIndex % framesPerSheet;
        const col = posInSheet % cols;
        const row = Math.floor(posInSheet / cols);
        // 이미지를 프록시를 통해서 서빙 (CORS 해결)
        const rawImgUrl = baseUrl.replace("$M", String(sheetIndex));
        const imageUrl = `/api/script/storyboard?proxy=${encodeURIComponent(rawImgUrl)}`;

        return {
          time,
          imageUrl,
          type: "storyboard" as const,
          bgX: -(col * frameW),
          bgY: -(row * frameH),
          frameW,
          frameH,
          sheetW: cols * frameW,
          sheetH: rows * frameH,
        };
      });

      return NextResponse.json({
        frames,
        source: "storyboard",
        intervalMs,
        frameW,
        frameH,
      });
    }
  }

  // ── 폴백: YouTube 기본 썸네일 (프록시 경유) ───────────────────
  // YouTube는 0.jpg(기본), 1.jpg(25%), 2.jpg(50%), 3.jpg(75%) 를 제공
  const thumbIds = ["1.jpg", "2.jpg", "3.jpg", "hqdefault.jpg"];
  const proxyBase = `/api/script/storyboard?proxy=`;

  const frames: FrameResult[] = timestamps.map((time: string, i: number) => {
    const thumbFile = thumbIds[i % thumbIds.length];
    const rawUrl = `https://img.youtube.com/vi/${videoId}/${thumbFile}`;
    return {
      time,
      imageUrl: `${proxyBase}${encodeURIComponent(rawUrl)}`,
      type: "thumbnail" as const,
      bgX: 0,
      bgY: 0,
      frameW: 480,
      frameH: 360,
      sheetW: 480,
      sheetH: 360,
    };
  });

  return NextResponse.json({
    frames,
    source: "thumbnail-fallback",
  });
}
