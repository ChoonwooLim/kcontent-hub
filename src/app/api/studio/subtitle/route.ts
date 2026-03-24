import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/studio/subtitle
 * body: { action: "extract" | "translate", videoId, subs? }
 *
 * extract: YouTube 자막(CC) 추출
 * translate: 영어 자막을 한국어로 번역
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // ── 1. 자막 추출 ──
    if (action === "extract") {
      const { videoId } = body;
      if (!videoId) return NextResponse.json({ error: "videoId가 필요합니다." }, { status: 400 });

      try {
        const { YoutubeTranscript } = await import("youtube-transcript");
        const raw = await YoutubeTranscript.fetchTranscript(videoId);

        const transcript = raw.map((seg: { offset: number; duration: number; text: string }, i: number) => {
          const startSec = Math.round((seg.offset / 1000) * 10) / 10;
          const endSec = Math.round((startSec + seg.duration / 1000) * 10) / 10;
          return {
            id: i + 1,
            start: startSec,
            end: endSec,
            text: seg.text,
            type: "narration",
          };
        });

        return NextResponse.json({ success: true, subs: transcript });
      } catch {
        return NextResponse.json({
          error: "자막 추출 실패 — YouTube 자막이 없거나 제한된 영상입니다.",
        }, { status: 422 });
      }
    }

    // ── 2. 한국어 번역 ──
    if (action === "translate") {
      const { subs } = body as { subs: { id: number; start: number; end: number; text: string; type: string }[] };
      if (!subs?.length) return NextResponse.json({ error: "자막 데이터가 필요합니다." }, { status: 400 });

      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) return NextResponse.json({ error: "OpenAI API 키가 설정되지 않았습니다." }, { status: 500 });

      const CHUNK_SIZE = 30;
      const translated: typeof subs = [];

      for (let i = 0; i < subs.length; i += CHUNK_SIZE) {
        const chunk = subs.slice(i, i + CHUNK_SIZE);
        const chunkText = chunk.map((s, idx) => `[${idx}] ${s.text}`).join("\n");

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o",
            temperature: 0.3,
            messages: [
              {
                role: "system",
                content: `당신은 영상 자막 번역 전문가입니다. 외국어 자막을 자연스러운 한국어로 번역하세요.

규칙:
1. 자연스러운 한국어 구어체 사용
2. 고유명사(장소, 음식 등)는 한글 + 영문 병기
3. JSON 배열로 반환: {"translations": [{"idx": 0, "ko": "번역문"}, ...]}`
              },
              {
                role: "user",
                content: `다음 영상 자막을 한국어로 번역:\n\n${chunkText}`
              }
            ],
            response_format: { type: "json_object" },
          }),
        });

        const data = await res.json();
        let translations: { idx: number; ko: string }[] = [];

        try {
          const content = data.choices?.[0]?.message?.content || "{}";
          const parsed = JSON.parse(content);
          translations = parsed.translations || parsed.result || (Array.isArray(parsed) ? parsed : []);
        } catch {
          translations = chunk.map((_, idx) => ({ idx, ko: chunk[idx].text }));
        }

        for (let j = 0; j < chunk.length; j++) {
          const tr = translations.find(t => t.idx === j);
          translated.push({
            ...chunk[j],
            text: tr?.ko || chunk[j].text,
          });
        }
      }

      return NextResponse.json({ success: true, subs: translated });
    }

    return NextResponse.json({ error: "action은 'extract' 또는 'translate'여야 합니다." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: `서버 오류: ${String(e).slice(0, 300)}` }, { status: 500 });
  }
}
