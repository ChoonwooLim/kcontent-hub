import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

async function getApiKey(service: string, envVar: string): Promise<string | null> {
  const fromEnv = process.env[envVar];
  if (fromEnv) return fromEnv;
  try {
    const record = await prisma.apiKey.findUnique({ where: { service } });
    return record?.value ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { url, studioTitle, studioSubs } = await req.json();

  const videoId = extractVideoId(url) || "";
  if (!videoId && !(studioSubs && Array.isArray(studioSubs))) {
    return NextResponse.json({ error: "유효하지 않은 YouTube URL이거나 대본 데이터가 없습니다." }, { status: 400 });
  }

  // API 키 로드
  const youtubeKey = await getApiKey("youtube", "YOUTUBE_API_KEY");
  const openaiKey  = await getApiKey("openai",  "OPENAI_API_KEY");

  if (!openaiKey) {
    return NextResponse.json({ error: "OpenAI API 키가 설정되지 않았습니다. 설정 → API 설정에서 입력해주세요." }, { status: 400 });
  }

  // ── 1단계: YouTube 영상 메타데이터 ──────────────────────────────
  let videoTitle = studioTitle || "";
  let videoDescription = "";
  let channelTitle = "";
  let duration = "";

  if (youtubeKey && videoId) {
    try {
      const metaRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${youtubeKey}`
      );
      const metaData = await metaRes.json();
      const item = metaData.items?.[0];
      if (item) {
        videoTitle       = item.snippet?.title ?? "";
        videoDescription = (item.snippet?.description ?? "").slice(0, 800);
        channelTitle     = item.snippet?.channelTitle ?? "";
        duration         = item.contentDetails?.duration ?? "";
      }
    } catch { /* YouTube API 실패 시 자막만으로 진행 */ }
  }

  // ── 2단계: 실제 자막 추출 (스튜디오 데이터 우선) ─────────────────────────
  let transcriptText = "";

  if (studioSubs && Array.isArray(studioSubs)) {
    // 스튜디오에서 전달받은 자막 사용
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transcriptText = studioSubs.map((t: any) => t.text).join(" ").slice(0, 10000);
  } else if (videoId) {
    try {
      const { YoutubeTranscript } = await import("youtube-transcript");
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" });
      transcriptText = transcript.map(t => t.text).join(" ").slice(0, 10000);
    } catch {
      // 영어 자막 없으면 한국어 시도
      try {
        const { YoutubeTranscript } = await import("youtube-transcript");
        const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: "ko" });
        transcriptText = transcript.map(t => t.text).join(" ").slice(0, 10000);
      } catch {
        transcriptText = ""; // 자막 없음 — 제목/설명만으로 대본 생성
      }
    }
  }

  if (!videoTitle && !transcriptText) {
    return NextResponse.json({
      error: "영상 정보를 가져올 수 없습니다. YouTube API 키를 확인하거나, 자막이 있는 영상을 사용해주세요."
    }, { status: 400 });
  }

  // ── 3단계: GPT-4o 한국어 대본 생성 ────────────────────────────
  const hasTranscript = transcriptText.length > 0;

  const systemPrompt = `당신은 "코릿치(Koritch)" 채널의 전속 영상 대본 PD입니다.

■ 코릿치 채널 소개:
- 외국인이 한국을 방문하거나 한국 문화를 체험하는 유튜브 영상을 발굴
- 해당 영상에 한국어 자막을 입히고, 코릿치 MC의 나레이션을 추가하여 새로운 콘텐츠로 재탄생
- 한국인 시청자 대상 (국뽕, 감동, 재미, 공감 포인트 극대화)

■ 코릿치 영상 구조 (3파트):

[파트1: 인트로 나레이션] — 코릿치 MC가 직접 촬영한 영상 (20~30초)
- 코릿치 인사말로 시작
- 오늘 소개할 외국인 영상이 뭔지, 왜 이 영상을 골랐는지 설명
- 한국인 시청자가 관심 가질만한 핵심 포인트를 티저처럼 미리 언급
- "자, 그럼 바로 영상 보시죠!" 같은 전환 멘트로 마무리

[파트2: 본편 보조 나레이션] — 외국인 원본 영상이 재생되는 동안 중간중간 삽입
- 외국인이 말하는 것에 대한 보충 설명 (문화적 맥락, 배경 지식)
- 재미있는 코멘트나 감성 포인트 ("이 표정 보세요!", "여기서 소름 돋았습니다")
- 시청자 공감 유도 ("우리가 당연하다고 생각한 게 이렇게 특별한 거였네요")
- 영상의 핵심 장면마다 적절히 배치 (너무 자주 끊기지 않게, 1~2분마다 1개)

[파트3: 아웃트로 나레이션] — 코릿치 MC가 직접 촬영한 영상 (약 10초)
- 영상을 본 소감 한마디
- 구독/좋아요/알림 유도
- 코릿치 마무리 인사 ("코릿치였습니다, 다음 영상에서 만나요!")

■ 출력 규칙:
- JSON 형식으로만 응답 (마크다운 코드블록 없이 순수 JSON)
- 각 나레이션에 예상 소요 시간(초)을 durationSec 필드로 명시
- 대본 유형: intro(인트로), hook(훅), context(맥락설명), reaction(반응해설), humor(유머/재미), emotion(감성), outro(아웃트로)`;

  // 영상 길이 기반 보조 나레이션 수 계산
  function parseDurationSecs(iso: string): number {
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    return (parseInt(m[1]||"0")*3600) + (parseInt(m[2]||"0")*60) + parseInt(m[3]||"0");
  }
  const durationSecs = parseDurationSecs(duration);
  const midNarrationCount = Math.max(5, Math.floor(durationSecs / 90)); // 90초당 1개, 최소 5개
  const durationLabel = durationSecs > 0
    ? `${Math.floor(durationSecs/60)}분 ${durationSecs%60}초`
    : "알 수 없음";

  const userPrompt = `다음 외국인 YouTube 영상을 분석하여 "코릿치(Koritch)" 채널용 3파트 나레이션 대본을 생성하세요.

■ 분석할 영상 정보:
- 제목: ${videoTitle || "정보 없음"}
- 채널: ${channelTitle || "정보 없음"}
- 길이: ${durationLabel}
${videoDescription ? `- 설명: ${videoDescription}` : ""}
${hasTranscript ? `\n■ 원본 자막 (이 영상에는 이미 한국어 자막이 입혀져 있음):\n${transcriptText}` : "\n⚠ 자막 없음 — 제목과 설명만으로 대본 창작"}

■ 코릿치 대본 요구사항:

[파트1: 인트로] (20~30초 분량, 3~5개 나레이션)
- 코릿치 인사말 → 영상 소개 → 왜 볼만한지 → "바로 보시죠!" 전환

[파트2: 본편 보조 나레이션] (영상 길이: ${durationLabel}, ${midNarrationCount}개 이상)
- 원본 영상의 타임스탬프 기준으로 중간중간 삽입
- 보충 설명, 재미 코멘트, 감성 포인트 등
- 자막 내용을 분석하여 핵심 장면에 배치

[파트3: 아웃트로] (약 10초, 2~3개 나레이션)
- 소감 → 구독 유도 → 코릿치 마무리 인사

다음 JSON을 정확히 반환하세요:
{
  "title": "CTR 최적화 한국어 제목 (클릭 유도, 60자 이내)",
  "thumbnailTop": "썸네일 상단 텍스트 (충격/호기심 유발, 15자 이내)",
  "thumbnailBottom": "썸네일 하단 임팩트 문구 (12자 이내, 따옴표 포함 가능)",
  "intro": [
    { "order": 1, "type": "intro", "ko": "안녕하세요, 코릿치입니다!", "durationSec": 3 },
    { "order": 2, "type": "hook", "ko": "오늘은 외국인이 한국에서 ○○한 영상을 가져왔는데요", "durationSec": 5 },
    { "order": 3, "type": "context", "ko": "이 영상이 특별한 이유는...", "durationSec": 8 },
    { "order": 4, "type": "hook", "ko": "자, 그럼 바로 영상 보시죠!", "durationSec": 3 }
  ],
  "midRoll": [
    { "time": "00:30", "type": "context",  "ko": "여기서 잠깐! ○○은 한국의 ○○인데요", "durationSec": 5 },
    { "time": "01:15", "type": "reaction", "ko": "이 표정 보세요! 진짜 감동받은 거예요", "durationSec": 4 },
    { "time": "02:00", "type": "humor",    "ko": "이 부분에서 저도 빵 터졌습니다 ㅋㅋ", "durationSec": 3 },
    { "time": "03:30", "type": "emotion",  "ko": "우리가 당연하게 생각한 것들이...", "durationSec": 6 },
    ...${midNarrationCount}개 이상 (영상 전체에 걸쳐 균등 배치)
  ],
  "outro": [
    { "order": 1, "type": "emotion", "ko": "정말 따뜻한 영상이었습니다", "durationSec": 3 },
    { "order": 2, "type": "outro",   "ko": "구독과 좋아요는 코릿치에게 큰 힘이 됩니다!", "durationSec": 4 },
    { "order": 3, "type": "outro",   "ko": "코릿치였습니다, 다음 영상에서 만나요!", "durationSec": 3 }
  ]
}`;

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!openaiRes.ok) {
    const err = await openaiRes.json();
    return NextResponse.json({
      error: `OpenAI API 오류: ${err.error?.message ?? openaiRes.status}`
    }, { status: 400 });
  }

  const openaiData = await openaiRes.json();
  const rawContent = openaiData.choices?.[0]?.message?.content ?? "";

  type NarrationLine = { time?: string; order?: number; type: string; ko: string; durationSec?: number };

  let parsed: {
    title: string;
    thumbnailTop: string;
    thumbnailBottom: string;
    intro?: NarrationLine[];
    midRoll?: NarrationLine[];
    outro?: NarrationLine[];
    script?: { time: string; type: string; ko: string }[]; // 하위 호환
  };

  try {
    // GPT가 가끔 마크다운 코드블록을 붙이는 경우 제거
    const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json({
      error: "대본 파싱 실패. 다시 시도해주세요.",
      raw: rawContent,
    }, { status: 500 });
  }

  // 3파트 → 기존 script 배열 호환 (프론트엔드 타임라인 뷰 유지)
  const script = parsed.script ?? [
    ...(parsed.intro || []).map(l => ({ time: l.time || `인트로 ${l.order || 0}`, type: l.type, ko: l.ko })),
    ...(parsed.midRoll || []).map(l => ({ time: l.time || "", type: l.type, ko: l.ko })),
    ...(parsed.outro || []).map(l => ({ time: l.time || `아웃트로 ${l.order || 0}`, type: l.type, ko: l.ko })),
  ];

  return NextResponse.json({
    videoId,
    videoTitle,
    channelTitle,
    hasTranscript,
    title: parsed.title,
    thumbnailTop: parsed.thumbnailTop,
    thumbnailBottom: parsed.thumbnailBottom,
    // 3파트 구조
    intro: parsed.intro || [],
    midRoll: parsed.midRoll || [],
    outro: parsed.outro || [],
    // 하위 호환 (기존 타임라인 뷰)
    script,
  });
}
