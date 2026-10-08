import { NextResponse } from "next/server";
import type { UserPlan, UserRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";

/**
 * 서버 라우트용 접근 제어 · 등급별 API 키 해석
 *
 * 등급 정책
 *  - 일반(FREE)  : 본인이 등록한 OpenAI / YouTube 키로만 기능 사용. 없으면 KEY_REQUIRED(403)
 *  - VIP         : 번역은 OpenClaw 게이트웨이, Whisper·YouTube 는 서버 공용 키 (없으면 본인 키)
 *  - 관리자(ADMIN): VIP 와 동일 + 회원 관리
 */
export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  plan: UserPlan;
  disabled: boolean;
  openaiKey: string | null;   // 복호화된 본인 키
  youtubeKey: string | null;
};

export const KEY_REQUIRED_CODE = "KEY_REQUIRED";

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  const email = session?.user?.email;
  if (!id && !email) return null;

  const u = await prisma.user.findFirst({
    where: id ? { id } : { email: email ?? undefined },
    select: {
      id: true, email: true, name: true, role: true, plan: true, disabled: true,
      openaiKeyEnc: true, youtubeKeyEnc: true,
    },
  });
  if (!u || !u.email) return null;

  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    plan: u.plan,
    disabled: u.disabled,
    openaiKey: decryptSecret(u.openaiKeyEnc),
    youtubeKey: decryptSecret(u.youtubeKeyEnc),
  };
}

export function isPrivileged(u: Pick<CurrentUser, "role" | "plan">): boolean {
  return u.role === "ADMIN" || u.plan === "VIP";
}

type Guard =
  | { user: CurrentUser; error?: undefined }
  | { user?: undefined; error: NextResponse };

export async function requireUser(): Promise<Guard> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "로그인이 필요합니다.", code: "UNAUTHENTICATED" }, { status: 401 }) };
  }
  if (user.disabled) {
    return { error: NextResponse.json({ error: "비활성화된 계정입니다. 관리자에게 문의하세요.", code: "DISABLED" }, { status: 403 }) };
  }
  return { user };
}

export async function requireAdmin(): Promise<Guard> {
  const g = await requireUser();
  if (g.error) return g;
  if (g.user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "관리자 권한이 필요합니다.", code: "FORBIDDEN" }, { status: 403 }) };
  }
  return g;
}

/** OpenAI 키 — VIP/관리자: 서버 공용 키 우선(없으면 본인 키), 일반: 본인 키만 */
export function resolveOpenAIKey(u: CurrentUser): string | null {
  if (isPrivileged(u)) return process.env.OPENAI_API_KEY || u.openaiKey;
  return u.openaiKey;
}

/** YouTube 키 — VIP/관리자: 서버 공용 키 → 워크스페이스 공용 키 → 본인 키, 일반: 본인 키만 */
export async function resolveYoutubeKey(u: CurrentUser): Promise<string | null> {
  if (!isPrivileged(u)) return u.youtubeKey;
  if (process.env.YOUTUBE_API_KEY) return process.env.YOUTUBE_API_KEY;
  try {
    const rec = await prisma.apiKey.findUnique({ where: { service: "youtube" } });
    if (rec?.value) return rec.value;
  } catch { /* DB 일시 장애 → 본인 키로 */ }
  return u.youtubeKey;
}

/** 키 미등록 시 공통 응답 (프론트는 code === KEY_REQUIRED 면 API 설정 화면으로 안내) */
export function keyRequiredResponse(kind: "openai" | "youtube", u: CurrentUser): NextResponse {
  const label = kind === "openai" ? "OpenAI" : "YouTube Data API";
  const error = isPrivileged(u)
    ? `${label} 키가 서버에도 내 설정에도 없습니다. API 설정에서 등록하거나 관리자에게 문의하세요.`
    : `일반 회원은 본인의 ${label} 키를 등록해야 이 기능을 사용할 수 있습니다. API 설정에서 키를 등록하세요.`;
  return NextResponse.json({ error, code: KEY_REQUIRED_CODE, kind }, { status: 403 });
}
