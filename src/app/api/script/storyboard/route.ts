import { NextRequest, NextResponse } from "next/server";

interface StoryboardFrame {
  time: string;       // "01:30"
  imageUrl: string;   // storyboard sheet URL
  bgX: number;        // CSS background-position-x (px, negative)
  bgY: number;        // CSS background-position-y (px, negative)
  frameW: number;     // single frame width
  frameH: number;     // single frame height
  sheetW: number;     // full sprite sheet display width
  sheetH: number;     // full sprite sheet display height
}

function timeToMs(time: string): number {
  const parts = time.split(":").map(Number);
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  return (parts[0] * 60 + parts[1]) * 1000;
}

export async function POST(req: NextRequest) {
  const { videoId, timestamps } = await req.json() as {
    videoId: string;
    timestamps: string[]; // ["00:00", "01:30", ...]
  };

  if (!videoId || !timestamps?.length) {
    return NextResponse.json({ error: "videoId와 timestamps가 필요합니다." }, { status: 400 });
  }

  // ── 1. YouTube 페이지 fetch → ytInitialPlayerResponse 추출 ──
  let html = "";
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    html = await res.text();
  } catch {
    return NextResponse.json({ error: "YouTube 페이지를 가져올 수 없습니다." }, { status: 502 });
  }

  // ── 2. storyboard spec 파싱 ──────────────────────────────────
  // ytInitialPlayerResponse.storyboards.playerStoryboardSpecRenderer.spec
  const match = html.match(/"playerStoryboardSpecRenderer"\s*:\s*\{"spec"\s*:\s*"([^"]+)"/);
  if (!match) {
    return NextResponse.json({ error: "이 영상은 스토리보드 데이터를 제공하지 않습니다." }, { status: 404 });
  }

  const specRaw = match[1].replace(/\\u0026/g, "&").replace(/\\\//g, "/");
  // spec 형식: baseUrl|w|h|cols|rows|interval_ms|offset_ms|count|duration_ms|scale
  //   또는 여러 레벨이 탭(\t)으로 구분
  const levels = specRaw.split("|").filter(s => s.includes("ytimg.com") || s.match(/^\d+$/));

  // 레벨별로 파싱 (탭 구분 혹은 파이프 구분)
  // 일반 형식 예시:
  // https://i9.ytimg.com/sb/VIDEO_ID/storyboard3_L1/M$M.jpg?...|80|45|10|10|5000|0|100|600000|1
  // 파이프로 분리된 단일 레벨부터 파싱
  const segments = specRaw.split("|");
  // 영상 스토리보드에서 L2 (가장 높은 해상도) 또는 L1 선택
  // 형식: [url, w, h, cols, rows, intervalMs, ...]
  if (segments.length < 6) {
    return NextResponse.json({ error: "스토리보드 스펙 파싱 실패." }, { status: 500 });
  }

  // YouTube storyboard spec은 여러 줄(수준)이 있을 수 있음
  // 탭 문자(\t)로 구분된 각 레벨을 분리
  const levelSpecs = specRaw.split("\t");
  // 최대 레벨(가장 선명한) 선택
  const bestSpec = levelSpecs[Math.min(levelSpecs.length - 1, 2)]; // L2 우선
  const parts = bestSpec.split("|");

  if (parts.length < 6) {
    return NextResponse.json({ error: "스토리보드 스펙 형식 오류" }, { status: 500 });
  }

  const baseUrl   = parts[0];                      // $M 포함 URL
  const frameW    = parseInt(parts[1]) || 120;
  const frameH    = parseInt(parts[2]) || 68;
  const cols      = parseInt(parts[3]) || 10;
  const rows      = parseInt(parts[4]) || 10;
  const intervalMs = parseInt(parts[5]) || 5000;

  const framesPerSheet = cols * rows;

  // ── 3. 각 타임스탬프 → 스토리보드 프레임 위치 계산 ──────────
  const frames: StoryboardFrame[] = timestamps.map(time => {
    const ms = timeToMs(time);
    const frameIndex    = Math.max(0, Math.floor(ms / intervalMs));
    const sheetIndex    = Math.floor(frameIndex / framesPerSheet);
    const posInSheet    = frameIndex % framesPerSheet;
    const col           = posInSheet % cols;
    const row           = Math.floor(posInSheet / cols);

    const imageUrl = baseUrl.replace("$M", String(sheetIndex));

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
