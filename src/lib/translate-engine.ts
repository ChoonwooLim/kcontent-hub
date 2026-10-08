import { type CurrentUser, isPrivileged } from "@/lib/access";

/**
 * 자막 번역 엔진 선택
 *
 * 서버 env
 *   TRANSLATE_PROVIDER   openclaw | openai (기본 openai)
 *   OPENCLAW_GATEWAY_URL 예) http://192.168.219.117:18790  (twinverse-ai socat 프록시, LAN 전용)
 *   OPENCLAW_TOKEN       게이트웨이 gateway.auth.token (Orbitron secrets)
 *   OPENCLAW_AGENT_ID    기본 codex-pro → model "openclaw/codex-pro"
 *   TRANSLATE_FALLBACK   openai(기본) | none — OpenClaw 실패 시 OpenAI 대체 여부
 *
 * 등급별
 *   VIP / 관리자 : 위 서버 설정 그대로 (OpenClaw 사용 가능). OpenAI 키는 서버 키, 없으면 본인 키
 *   일반(FREE)   : OpenClaw 불가. 본인 OpenAI 키로만 번역, 키 없으면 error
 */
export type Provider = "openai" | "openclaw";
export type Tier = "admin" | "vip" | "free";

export type EngineConfig = {
  provider: Provider;
  openaiKey: string | null;
  openclaw: { url: string; token: string; agent: string } | null;
  fallbackToOpenAI: boolean;
  note?: string;
  tier: Tier;
};

export function loadEngineConfig(openaiKey: string | null, allowOpenClaw: boolean, tier: Tier): EngineConfig {
  const url = (process.env.OPENCLAW_GATEWAY_URL || "").trim().replace(/\/+$/, "");
  const token = (process.env.OPENCLAW_TOKEN || "").trim();
  const agent = (process.env.OPENCLAW_AGENT_ID || "codex-pro").trim();
  const openclaw = allowOpenClaw && url && token ? { url, token, agent } : null;
  const wanted = (process.env.TRANSLATE_PROVIDER || "openai").trim().toLowerCase();
  const provider: Provider = wanted === "openclaw" && openclaw ? "openclaw" : "openai";
  const fallbackToOpenAI =
    (process.env.TRANSLATE_FALLBACK || "openai").trim().toLowerCase() !== "none" && !!openaiKey;
  const note = allowOpenClaw && wanted === "openclaw" && !openclaw
    ? "OpenClaw 설정 누락(OPENCLAW_GATEWAY_URL / OPENCLAW_TOKEN) → OpenAI 사용 중"
    : undefined;
  return { provider, openaiKey, openclaw, fallbackToOpenAI, note, tier };
}

export function engineLabel(cfg: Pick<EngineConfig, "openclaw" | "tier">, provider: Provider): string {
  if (provider === "openclaw") return `OpenClaw · ${cfg.openclaw?.agent ?? "?"}`;
  return cfg.tier === "free" ? "OpenAI GPT-4o (내 API 키)" : "OpenAI GPT-4o";
}

export function chunkSizeFor(cfg: Pick<EngineConfig, "provider">): number {
  // OpenClaw 는 호출당 에이전트 컨텍스트 오버헤드(약 18k 토큰)가 커서 청크를 키운다
  return cfg.provider === "openclaw" ? 60 : 30;
}

export function tierOf(u: Pick<CurrentUser, "role" | "plan">): Tier {
  return u.role === "ADMIN" ? "admin" : u.plan === "VIP" ? "vip" : "free";
}

export function engineForUser(
  u: CurrentUser,
): { ok: true; cfg: EngineConfig } | { ok: false; error: string } {
  const tier = tierOf(u);
  if (isPrivileged(u)) {
    return { ok: true, cfg: loadEngineConfig(process.env.OPENAI_API_KEY || u.openaiKey || null, true, tier) };
  }
  if (!u.openaiKey) {
    return { ok: false, error: "일반 회원은 본인의 OpenAI API 키를 등록해야 번역할 수 있습니다. API 설정에서 키를 등록하세요." };
  }
  return {
    ok: true,
    cfg: {
      provider: "openai",
      openaiKey: u.openaiKey,
      openclaw: null,
      fallbackToOpenAI: false,
      note: "일반 회원 — 본인 OpenAI 키로 번역 (VIP 는 OpenClaw 사용)",
      tier,
    },
  };
}
