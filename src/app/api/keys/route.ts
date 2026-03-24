import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 환경변수 키 매핑 (배포 시 영구 유지)
const ENV_KEY_MAP: Record<string, string> = {
  youtube: process.env.YOUTUBE_API_KEY ?? "",
  openai:  process.env.OPENAI_API_KEY  ?? "",
  deepl:   process.env.DEEPL_API_KEY   ?? "",
  tiktok:  process.env.TIKTOK_API_KEY  ?? "",
};

// GET /api/keys — 환경변수 우선, DB fallback
export async function GET() {
  // 1. 환경변수에서 기본값 로드
  const result: Record<string, string> = { ...ENV_KEY_MAP };

  // 2. DB에 저장된 값으로 덮어쓰기 (사용자가 UI에서 입력한 값)
  try {
    const keys = await prisma.apiKey.findMany();
    for (const k of keys) {
      // DB 값이 있으면 우선 사용 (환경변수 덮어씀)
      if (k.value) result[k.service] = k.value;
    }
  } catch {
    // DB 연결 실패 시 환경변수만 사용 (에러 무시)
  }

  return NextResponse.json({ keys: result });
}

// POST /api/keys — DB에 저장 (upsert)
export async function POST(req: NextRequest) {
  try {
    const body: Record<string, string> = await req.json();
    const entries = Object.entries(body).filter(([, v]) => v && v.trim());
    if (entries.length === 0) return NextResponse.json({ saved: 0 });

    // workspace ID 조회
    let workspaceId = "";
    try {
      const ws = await prisma.workspace.findFirst();
      workspaceId = ws?.id || "";
    } catch { /* ignore */ }

    const results = await Promise.all(
      entries.map(([service, value]) =>
        prisma.apiKey.upsert({
          where: { service },
          update: { value, verified: false },
          create: { service, value, verified: false, workspaceId },
        })
      )
    );
    return NextResponse.json({ saved: results.length });
  } catch (e) {
    return NextResponse.json({ error: "DB 연결 없음 — 환경변수로 API 키를 설정하세요", detail: String(e) }, { status: 503 });
  }
}
