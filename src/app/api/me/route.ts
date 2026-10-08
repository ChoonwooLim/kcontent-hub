import { NextResponse } from "next/server";
import { requireUser, isPrivileged } from "@/lib/access";
import { engineForUser, engineLabel } from "@/lib/translate-engine";

export const runtime = "nodejs";

/** GET /api/me — 현재 로그인 사용자의 등급·권한·키 등록 상태 (대시보드 게이팅용) */
export async function GET() {
  const g = await requireUser();
  if (g.error) return g.error;
  const u = g.user;
  const privileged = isPrivileged(u);
  const eng = engineForUser(u);

  return NextResponse.json({
    user: { id: u.id, email: u.email, name: u.name, role: u.role, plan: u.plan, disabled: u.disabled },
    privileged,
    hasOpenaiKey: !!u.openaiKey,
    hasYoutubeKey: !!u.youtubeKey,
    needsOpenaiKey: !privileged && !u.openaiKey,
    needsYoutubeKey: !privileged && !u.youtubeKey,
    engine: eng.ok ? engineLabel(eng.cfg, eng.cfg.provider) : null,
    engineNote: eng.ok ? (eng.cfg.note ?? null) : eng.error,
    serverKeys: { openai: !!process.env.OPENAI_API_KEY, youtube: !!process.env.YOUTUBE_API_KEY },
  });
}
