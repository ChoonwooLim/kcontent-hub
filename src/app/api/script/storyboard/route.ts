import { NextRequest, NextResponse } from "next/server";

function timeToSeconds(time: string): number {
  const parts = time.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + parts[1];
}

interface FrameResult {
  time: string;
  imageUrl: string;
  type: "storyboard" | "thumbnail";
  bgX: number; bgY: number;
  frameW: number; frameH: number;
  sheetW: number; sheetH: number;
}

export async function POST(req: NextRequest) {
  const { videoId, timestamps } = await req.json() as {
    videoId: string;
    timestamps: string[];
  };

  if (!videoId || !timestamps?.length) {
    return NextResponse.json({ error: "videoId와 timestamps가 필요합니다." }, { status: 400 });
  }

  // ── 방법 1: YouTube oEmbed + 공식 썸네일 ───────────────────
  // YouTube 썸네일은 항상 사용 가능하며 CORS 문제 없음
  const thumbBaseUrl = `https://img.youtube.com/vi/${videoId}`;

  // YouTube 썸네일 해상도 옵션:
  // - maxresdefault.jpg (1280x720, 간혹 없음)
  // - sddefault.jpg (640x480)
  // - hqdefault.jpg (480x360)
  // - mqdefault.jpg (320x180)
  // - default.jpg (120x90)

  // 먼저 maxres 체크
  let bestThumb = `${thumbBaseUrl}/hqdefault.jpg`;
  try {
    const checkRes = await fetch(`${thumbBaseUrl}/maxresdefault.jpg`, { method: "HEAD" });
    if (checkRes.ok) {
      bestThumb = `${thumbBaseUrl}/maxresdefault.jpg`;
    }
  } catch { /* fallback to hqdefault */ }

  // ── 방법 2: 스토리보드 시도 (YouTube HTML 파싱) ────────────
  let storyboardFrames: FrameResult[] | null = null;

  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    const html = await res.text();

    // storyboard spec 추출
    let spec = "";
    const p1 = html.match(/"playerStoryboardSpecRenderer":\{"spec":"(https:[^"]+)"/);
    if (p1) spec = p1[1];

    if (!spec) {
      const idx = html.indexOf("playerStoryboardSpecRenderer");
      if (idx !== -1) {
        const chunk = html.slice(idx, idx + 2000);
        const m = chunk.match(/"spec"\s*:\s*"(https:[^"]+)"/);
        if (m) spec = m[1];
      }
    }

    if (spec) {
      spec = spec
        .replace(/\\u0026/g, "&")
        .replace(/\\\//g, "/")
        .replace(/\\n/g, "")
        .replace(/\\t/g, "\t");

      const levels = spec.split("\t").filter(s => s.includes("ytimg.com"));
      const bestLevel = levels.length > 0
        ? levels[Math.min(levels.length - 1, 1)]
        : spec;

      const parts = bestLevel.split("|");

      if (parts.length >= 6 && parts[0].includes("ytimg.com")) {
        const baseUrl    = parts[0];
        const frameW     = Math.max(1, parseInt(parts[1]) || 120);
        const frameH     = Math.max(1, parseInt(parts[2]) || 68);
        const cols       = Math.max(1, parseInt(parts[3]) || 10);
        const rows       = Math.max(1, parseInt(parts[4]) || 10);
        const intervalMs = Math.max(1, parseInt(parts[5]) || 5000);
        const framesPerSheet = cols * rows;

        storyboardFrames = timestamps.map((time: string) => {
          const ms = timeToSeconds(time) * 1000;
          const frameIndex  = Math.max(0, Math.floor(ms / intervalMs));
          const sheetIndex  = Math.floor(frameIndex / framesPerSheet);
          const posInSheet  = frameIndex % framesPerSheet;
          const col         = posInSheet % cols;
          const row         = Math.floor(posInSheet / cols);
          const imageUrl    = baseUrl.replace("$M", String(sheetIndex));

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
      }
    }
  } catch {
    // 스토리보드 실패 — 썸네일 폴백 사용
  }

  // ── 결과: 스토리보드 성공 시 사용, 실패 시 YouTube 썸네일 폴백 ──
  if (storyboardFrames && storyboardFrames.length > 0) {
    return NextResponse.json({
      frames: storyboardFrames,
      source: "storyboard",
    });
  }

  // 폴백: 모든 타임스탬프에 동일한 고화질 썸네일 사용
  const fallbackFrames: FrameResult[] = timestamps.map((time: string) => ({
    time,
    imageUrl: bestThumb,
    type: "thumbnail" as const,
    bgX: 0,
    bgY: 0,
    frameW: 480,
    frameH: 360,
    sheetW: 480,
    sheetH: 360,
  }));

  return NextResponse.json({
    frames: fallbackFrames,
    source: "thumbnail",
  });
}
