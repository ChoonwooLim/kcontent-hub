import { NextRequest, NextResponse } from "next/server";

function timeToMs(time: string): number {
  const parts = time.split(":").map(Number);
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  return (parts[0] * 60 + parts[1]) * 1000;
}

interface FrameResult {
  time: string;
  imageUrl: string;
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

  // ── YouTube 페이지 fetch ────────────────────────────────────
  let html = "";
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    html = await res.text();
  } catch (e) {
    return NextResponse.json({ error: `YouTube 연결 실패: ${String(e)}` }, { status: 502 });
  }

  // ── storyboard spec 추출 (여러 패턴 시도) ──────────────────
  let spec = "";

  // 패턴 1: JSON 문자열 내 spec 직접 추출
  const p1 = html.match(/"playerStoryboardSpecRenderer":\{"spec":"(https:[^"]+)"/);
  if (p1) spec = p1[1];

  // 패턴 2: ytimg.com URL 직접 탐색
  if (!spec) {
    const p2 = html.match(/(https:\\?\/\\?\/i\d*\.ytimg\.com\\?\/sb\\?\/[^"\\]+\$M[^"\\]+)/);
    if (p2) spec = p2[1];
  }

  // 패턴 3: ytInitialPlayerResponse JSON 파싱
  if (!spec) {
    try {
      // 중첩 JSON이 매우 크므로 spec 키 근처만 슬라이싱
      const idx = html.indexOf("playerStoryboardSpecRenderer");
      if (idx !== -1) {
        const chunk = html.slice(idx, idx + 2000);
        const m = chunk.match(/"spec"\s*:\s*"(https:[^"]+)"/);
        if (m) spec = m[1];
      }
    } catch { /* ignore */ }
  }

  if (!spec) {
    return NextResponse.json({
      error: "이 영상은 스토리보드 미리보기를 제공하지 않습니다. (저화질/저구독자 영상에 자주 발생)",
    }, { status: 404 });
  }

  // ── spec 디코딩 ──────────────────────────────────────────────
  spec = spec
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/")
    .replace(/\\n/g, "")
    .replace(/\\t/g, "\t");

  // ── 레벨 분리 (탭 구분) — 가장 좋은 레벨 선택 ──────────────
  // 형식: "url|w|h|cols|rows|intervalMs|...[\t url|w|h|...]"
  const levels = spec.split("\t").filter(s => s.includes("ytimg.com"));
  const bestLevel = levels.length > 0
    ? levels[Math.min(levels.length - 1, 1)]  // L1 or L2
    : spec;

  const parts = bestLevel.split("|");

  if (parts.length < 6 || !parts[0].includes("ytimg.com")) {
    return NextResponse.json({
      error: `스토리보드 스펙 파싱 실패 (파트 수: ${parts.length})`,
    }, { status: 500 });
  }

  const baseUrl    = parts[0];                       // $M 포함 URL
  const frameW     = Math.max(1, parseInt(parts[1]) || 120);
  const frameH     = Math.max(1, parseInt(parts[2]) || 68);
  const cols       = Math.max(1, parseInt(parts[3]) || 10);
  const rows       = Math.max(1, parseInt(parts[4]) || 10);
  const intervalMs = Math.max(1, parseInt(parts[5]) || 5000);

  const framesPerSheet = cols * rows;

  // ── 각 타임스탬프 → 프레임 위치 계산 ────────────────────────
  const frames: FrameResult[] = timestamps.map((time: string) => {
    const ms = timeToMs(time);
    const frameIndex  = Math.max(0, Math.floor(ms / intervalMs));
    const sheetIndex  = Math.floor(frameIndex / framesPerSheet);
    const posInSheet  = frameIndex % framesPerSheet;
    const col         = posInSheet % cols;
    const row         = Math.floor(posInSheet / cols);
    const imageUrl    = baseUrl.replace("$M", String(sheetIndex));

    return {
      time,
      imageUrl,
      bgX:    -(col * frameW),
      bgY:    -(row * frameH),
      frameW,
      frameH,
      sheetW: cols * frameW,
      sheetH: rows * frameH,
    };
  });

  return NextResponse.json({ frames, intervalMs, frameW, frameH });
}
