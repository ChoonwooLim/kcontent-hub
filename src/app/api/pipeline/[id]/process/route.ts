import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const STAGES = ["발굴 대기", "요약 편집", "HD 저장", "자막 추출", "한글 변환", "대본 생성", "배포 완료"] as const;

// POST /api/pipeline/[id]/process — 파이프라인 다음 단계 자동 처리
// body: { action: "transcribe" | "translate" | "generate_script" | "advance" }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json();
    const { action } = body;

    const video = await prisma.pipelineVideo.findUnique({
      where: { id },
      include: { editClips: { where: { included: true }, orderBy: { order: "asc" } } },
    });
    if (!video) return NextResponse.json({ error: "영상 없음" }, { status: 404 });

    // ── 1. 자막 추출 (Whisper-compatible, YouTube 자막 fallback) ──
    if (action === "transcribe") {
      // YouTube transcript 시도
      let transcript: { time: string; text: string; startSec: number; endSec: number }[] = [];

      try {
        const { YoutubeTranscript } = await import("youtube-transcript");
        const raw = await YoutubeTranscript.fetchTranscript(video.ytVideoId || video.originalUrl);

        transcript = raw.map((seg: { offset: number; duration: number; text: string }) => {
          const startSec = seg.offset / 1000;
          const endSec = startSec + seg.duration / 1000;
          return {
            time: secToTime(startSec),
            text: seg.text,
            startSec: Math.round(startSec * 10) / 10,
            endSec: Math.round(endSec * 10) / 10,
          };
        });
      } catch {
        return NextResponse.json({
          error: "자막 추출 실패 — YouTube 자막이 없거나, 제한된 영상입니다.",
          suggestion: "수동 자막 입력이 필요합니다.",
        }, { status: 422 });
      }

      // 클립 구간에 맞는 자막만 필터링
      const clips = video.editClips;
      let filteredTranscript = transcript;

      if (clips.length > 0) {
        filteredTranscript = transcript.filter(seg => {
          return clips.some(clip => {
            const clipStart = timeToSec(clip.startTime);
            const clipEnd = timeToSec(clip.endTime);
            return seg.startSec >= clipStart && seg.startSec < clipEnd;
          });
        });
      }

      await prisma.pipelineVideo.update({
        where: { id },
        data: {
          transcriptJson: JSON.stringify(filteredTranscript),
          stage: "자막 추출",
        },
      });

      return NextResponse.json({
        success: true,
        stage: "자막 추출",
        segmentCount: filteredTranscript.length,
        transcript: filteredTranscript.slice(0, 10), // 미리보기
        message: `${filteredTranscript.length}개 자막 세그먼트 추출 완료`,
      });
    }

    // ── 2. 한글 자막 변환 ──
    if (action === "translate") {
      if (!video.transcriptJson) {
        return NextResponse.json({ error: "먼저 자막 추출을 완료해야 합니다" }, { status: 400 });
      }

      const transcript = JSON.parse(video.transcriptJson) as { time: string; text: string; startSec: number; endSec: number }[];
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) return NextResponse.json({ error: "OpenAI API 키가 설정되지 않았습니다" }, { status: 500 });

      // 자막을 청크로 나누기 (GPT 토큰 제한 고려)
      const CHUNK_SIZE = 30;
      const translated: { time: string; original: string; ko: string; startSec: number; endSec: number }[] = [];

      for (let i = 0; i < transcript.length; i += CHUNK_SIZE) {
        const chunk = transcript.slice(i, i + CHUNK_SIZE);
        const chunkText = chunk.map((s, idx) => `[${idx}] ${s.time} | ${s.text}`).join("\n");

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
1. 각 자막의 타임스탬프를 유지하면서 한국어로 번역
2. 자연스러운 한국어 구어체 사용 (시청자 친화적)
3. 고유명사(장소, 음식 등)는 한국어 음역 + 영문 병기
4. JSON 배열로 반환: [{"idx": 0, "ko": "번역문"}, ...]`
              },
              {
                role: "user",
                content: `다음 영상 자막을 자연스러운 한국어로 번역해주세요:\n\n${chunkText}`
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
          // fallback: 원문 유지
          translations = chunk.map((_, idx) => ({ idx, ko: chunk[idx].text }));
        }

        for (let j = 0; j < chunk.length; j++) {
          const tr = translations.find(t => t.idx === j);
          translated.push({
            time: chunk[j].time,
            original: chunk[j].text,
            ko: tr?.ko || chunk[j].text, // fallback
            startSec: chunk[j].startSec,
            endSec: chunk[j].endSec,
          });
        }
      }

      await prisma.pipelineVideo.update({
        where: { id },
        data: {
          translatedJson: JSON.stringify(translated),
          stage: "한글 변환",
        },
      });

      return NextResponse.json({
        success: true,
        stage: "한글 변환",
        segmentCount: translated.length,
        translated: translated.slice(0, 10), // 미리보기
        message: `${translated.length}개 자막 한글 변환 완료`,
      });
    }

    // ── 3. AI 대본 생성 ──
    if (action === "generate_script") {
      if (!video.translatedJson) {
        return NextResponse.json({ error: "먼저 한글 자막 변환을 완료해야 합니다" }, { status: 400 });
      }

      const translated = JSON.parse(video.translatedJson) as { time: string; ko: string; startSec: number; endSec: number }[];
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) return NextResponse.json({ error: "OpenAI API 키가 설정되지 않았습니다" }, { status: 500 });

      const subtitleText = translated.map(s => `${s.time} ${s.ko}`).join("\n");

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          temperature: 0.7,
          messages: [
            {
              role: "system",
              content: `당신은 한국 유튜브 콘텐츠 제작 전문 작가입니다.
외국인이 한국을 체험한 영상의 한글 자막을 바탕으로, 
한국인 시청자를 위한 재편집 대본을 작성합니다.

대본 형식:
- 각 씬(scene)은 JSON 객체: {"time": "타임코드", "type": "hook|reaction|narration|commentary", "ko": "대사/나레이션 텍스트"}
- type 종류:
  · hook: 시선을 끄는 오프닝 (1~2개)
  · reaction: 외국인의 감정 반응 순간 (핵심)
  · narration: 한국 문화 설명 나레이션
  · commentary: 한국인 시청자를 위한 해설/논평

규칙:
1. 전체 3~5분 분량에 맞게 10~20개 씬 구성
2. 첫 씬은 반드시 hook (15초 이내 임팩트)
3. 외국인의 솔직한 반응을 살리되, 한국 문화적 맥락 추가
4. 한국인이 공감할 수 있는 코멘터리 포인트 2~3개 필수
5. JSON 배열로만 반환

제목도 함께 제안해주세요.
반환 형식: {"title": "제목", "thumbnailTop": "썸네일 상단", "thumbnailBottom": "썸네일 하단", "script": [...]}`
            },
            {
              role: "user",
              content: `영상 제목: ${video.title}
채널: ${video.channel}
원작자 언어: ${video.lang || "unknown"}
장르: ${video.niche || "K-문화"}

한글 자막:
${subtitleText}`
            }
          ],
          response_format: { type: "json_object" },
        }),
      });

      const data = await res.json();
      let scriptData: { title: string; thumbnailTop: string; thumbnailBottom: string; script: { time: string; type: string; ko: string }[] };

      try {
        const content = data.choices?.[0]?.message?.content || "{}";
        scriptData = JSON.parse(content);
      } catch {
        return NextResponse.json({ error: "AI 대본 파싱 실패" }, { status: 500 });
      }

      await prisma.pipelineVideo.update({
        where: { id },
        data: {
          titleKo: scriptData.title,
          thumbCopyTop: scriptData.thumbnailTop,
          thumbCopyBot: scriptData.thumbnailBottom,
          scriptJson: JSON.stringify(scriptData.script),
          stage: "대본 생성",
        },
      });

      return NextResponse.json({
        success: true,
        stage: "대본 생성",
        title: scriptData.title,
        sceneCount: scriptData.script?.length || 0,
        script: scriptData.script,
        message: `AI 대본 생성 완료 — ${scriptData.script?.length || 0}개 씬`,
      });
    }

    // ── 4. 단순 stage 이동 ──
    if (action === "advance") {
      const currentIdx = STAGES.indexOf(video.stage as typeof STAGES[number]);
      if (currentIdx < 0 || currentIdx >= STAGES.length - 1) {
        return NextResponse.json({ error: "더 이상 이동할 단계가 없습니다" }, { status: 400 });
      }
      const nextStage = STAGES[currentIdx + 1];
      const updated = await prisma.pipelineVideo.update({
        where: { id },
        data: { stage: nextStage },
      });
      return NextResponse.json({ video: updated, stage: nextStage });
    }

    return NextResponse.json({ error: "알 수 없는 action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: "처리 실패", detail: String(e) }, { status: 500 });
  }
}

function secToTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function timeToSec(t: string): number {
  const p = t.split(":").map(Number);
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  return p[0] * 60 + (p[1] || 0);
}
