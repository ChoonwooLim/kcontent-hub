import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { apiKey } = await req.json();

  if (!apiKey || !apiKey.startsWith("sk-")) {
    return NextResponse.json({ valid: false, error: "유효하지 않은 키 형식입니다. 'sk-'로 시작해야 합니다." }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (res.status === 401) {
      return NextResponse.json({ valid: false, error: "인증 실패: API 키가 올바르지 않습니다." });
    }
    if (res.status === 429) {
      return NextResponse.json({ valid: false, error: "요청 한도 초과. 키는 유효하나 현재 사용 불가 상태입니다." });
    }
    if (!res.ok) {
      return NextResponse.json({ valid: false, error: `OpenAI 오류 (${res.status}): ${res.statusText}` });
    }

    const data = await res.json();
    const models: string[] = data.data?.map((m: { id: string }) => m.id) ?? [];
    const hasGpt4o = models.some((m) => m.includes("gpt-4o"));
    const hasWhisper = models.some((m) => m.includes("whisper"));

    return NextResponse.json({
      valid: true,
      modelCount: models.length,
      hasGpt4o,
      hasWhisper,
      message: `키 유효 · 모델 ${models.length}개 접근 가능`,
    });
  } catch {
    return NextResponse.json({ valid: false, error: "네트워크 오류: OpenAI 서버에 연결할 수 없습니다." }, { status: 500 });
  }
}
