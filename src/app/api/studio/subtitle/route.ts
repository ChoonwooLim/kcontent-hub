import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 120; // Whisper API는 시간이 걸릴 수 있음

const TMP_DIR = path.join(process.cwd(), "tmp_downloads");
const SAVED_DIR = path.join(TMP_DIR, "saved");

/**
 * POST /api/studio/subtitle
 * body: { action: "extract" | "translate", videoId?, fileVideoUrl?, subs? }
 *
 * extract: Whisper API 음성 분석 (파일 모드) 또는 YouTube CC 추출
 * translate: 자막을 한국어로 번역 (GPT-4o)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // ── 1. 자막 추출 (Whisper + YouTube CC fallback) ──
    if (action === "extract") {
      const { videoId, fileVideoUrl } = body;
      const openaiKey = process.env.OPENAI_API_KEY;

      // ── A. 파일 모드: Whisper API로 음성 분석 ──
      if (fileVideoUrl) {
        if (!openaiKey) return NextResponse.json({ error: "OpenAI API 키가 설정되지 않았습니다." }, { status: 500 });

        // 파일 경로 해석 (/api/downloads/파일명 → 서버 파일 경로)
        const filename = decodeURIComponent(fileVideoUrl.split("/").pop() || "");
        let filepath = path.join(SAVED_DIR, filename);
        if (!existsSync(filepath)) {
          filepath = path.join(TMP_DIR, filename);
        }

        if (!filepath.startsWith(TMP_DIR) || !existsSync(filepath)) {
          return NextResponse.json({ error: `영상 파일을 찾을 수 없습니다: ${filename}` }, { status: 404 });
        }

        // 파일 읽기 → FormData로 Whisper API 호출
        const fileBuffer = readFileSync(filepath);
        const fileBlob = new Blob([fileBuffer], { type: "video/mp4" });

        const formData = new FormData();
        formData.append("file", fileBlob, filename);
        formData.append("model", "whisper-1");
        formData.append("response_format", "verbose_json");
        formData.append("timestamp_granularities[]", "segment");

        const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiKey}`,
          },
          body: formData,
        });

        if (!whisperRes.ok) {
          const errData = await whisperRes.json().catch(() => ({}));
          return NextResponse.json({
            error: `Whisper API 오류 (${whisperRes.status}): ${JSON.stringify(errData).slice(0, 300)}`,
          }, { status: whisperRes.status });
        }

        const whisperData = await whisperRes.json() as {
          segments?: { id: number; start: number; end: number; text: string }[];
          text?: string;
          language?: string;
        };

        if (!whisperData.segments || whisperData.segments.length === 0) {
          // segment가 없으면 전체 텍스트를 하나의 자막으로
          return NextResponse.json({
            success: true,
            language: whisperData.language || "unknown",
            subs: [{
              id: 1,
              start: 0,
              end: 30,
              text: whisperData.text || "(음성이 감지되지 않았습니다)",
              type: "narration",
            }],
          });
        }

        const subs = whisperData.segments.map((seg, i) => ({
          id: i + 1,
          start: Math.round(seg.start * 10) / 10,
          end: Math.round(seg.end * 10) / 10,
          text: seg.text.trim(),
          type: "narration",
        }));

        return NextResponse.json({
          success: true,
          language: whisperData.language || "unknown",
          segmentCount: subs.length,
          subs,
          message: `Whisper 음성 분석 완료 — ${subs.length}개 자막 추출 (언어: ${whisperData.language || "unknown"})`,
        });
      }

      // ── B. YouTube CC 자막 추출 (원본 영상 URL로 접근 시) ──
      if (videoId) {
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
            error: "YouTube CC 자막 추출 실패 — 이 영상에는 자막이 없습니다.",
          }, { status: 422 });
        }
      }

      return NextResponse.json({ error: "fileVideoUrl 또는 videoId가 필요합니다." }, { status: 400 });
    }

    // ── 2. 한국어 번역 (GPT-4o) ──
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
