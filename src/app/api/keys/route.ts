import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isPrivileged } from "@/lib/access";
import { encryptSecret, maskSecret } from "@/lib/crypto";

export const runtime = "nodejs";

/**
 * 회원 개인 API 키 (암호화 저장)
 *  - 일반 회원: OpenAI 키 필수(AI 기능), YouTube 키 필수(소재 수집)
 *  - VIP/관리자: 선택 — 서버 공용 키가 없을 때만 사용
 */

/** GET /api/keys — 내 키 등록 상태 (값은 마스킹) */
export async function GET() {
  const g = await requireUser();
  if (g.error) return g.error;
  const u = g.user;
  return NextResponse.json({
    keys: { openai: maskSecret(u.openaiKey), youtube: maskSecret(u.youtubeKey) },
    has: { openai: !!u.openaiKey, youtube: !!u.youtubeKey },
    plan: u.plan,
    role: u.role,
    privileged: isPrivileged(u),
    serverKeys: { openai: !!process.env.OPENAI_API_KEY, youtube: !!process.env.YOUTUBE_API_KEY },
  });
}

/** POST /api/keys — { openai?: string|null, youtube?: string|null }  문자열=저장, null=삭제, 빈값/누락=변경 없음 */
export async function POST(req: NextRequest) {
  const g = await requireUser();
  if (g.error) return g.error;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const columns = { openai: "openaiKeyEnc", youtube: "youtubeKeyEnc" } as const;
  const data: { openaiKeyEnc?: string | null; youtubeKeyEnc?: string | null } = {};
  const saved: string[] = [];
  const cleared: string[] = [];

  for (const svc of Object.keys(columns) as (keyof typeof columns)[]) {
    const v = body[svc];
    if (v === null) { data[columns[svc]] = null; cleared.push(svc); }
    else if (typeof v === "string" && v.trim()) {
      if (v.trim().length > 512) return NextResponse.json({ error: `${svc} 키가 너무 깁니다.` }, { status: 400 });
      data[columns[svc]] = encryptSecret(v.trim());
      saved.push(svc);
    }
  }
  if (saved.length === 0 && cleared.length === 0) return NextResponse.json({ saved, cleared });

  try {
    await prisma.user.update({ where: { id: g.user.id }, data });
    return NextResponse.json({ saved, cleared });
  } catch (e) {
    return NextResponse.json({ error: `저장 실패: ${String(e).slice(0, 200)}` }, { status: 500 });
  }
}
