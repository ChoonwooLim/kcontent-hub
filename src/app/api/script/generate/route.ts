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
  const { url, studioTitle, studioSubs, localDuration } = await req.json();

  const videoId = extractVideoId(url) || "";
  const isLocalFile = url.match(/\.(mp4|webm|mkv|mov)$/i) || url.includes("/api/downloads/");

  if (!videoId && !isLocalFile && !(studioSubs && Array.isArray(studioSubs))) {
    return NextResponse.json({ error: "유효하지 않은 YouTube URL이거나 대본 데이터가 없습니다. (URL: " + url + ")" }, { status: 400 });
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

  // 로컬 파일의 경우 파일명 자체를 임시 타이틀로 사용
  if (!videoTitle && isLocalFile) {
    try {
      videoTitle = decodeURIComponent(url.split("/").pop() || "로컬 영상 대본").replace(/\.[^/.]+$/, "");
    } catch {
      videoTitle = "로컬 영상 대본";
    }
  }

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

  // ── 2단계: 실제 자막 및 타임스탬프 추출 (스튜디오 데이터 우선) ─────────────────────────
  let transcriptText = "";

  function fmtT(sec: number) {
    if (!sec || isNaN(sec)) return "00:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  if (studioSubs && Array.isArray(studioSubs)) {
    // 스튜디오에서 전달받은 자막 (정확한 start time 포함)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transcriptText = studioSubs.map((t: any) => `[${fmtT(t.start)}] ${t.text}`).join("\n").slice(0, 10000);
  } else if (videoId) {
    try {
      const { YoutubeTranscript } = await import("youtube-transcript");
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" });
      // youtube-transcript offset은 보통 밀리초(ms) 또는 초 단위. (일반적으로 초 단위가 많음)
      transcriptText = transcript.map(t => `[${fmtT(t.offset / (t.offset > 10000 ? 1000 : 1))}] ${t.text}`).join("\n").slice(0, 10000);
    } catch {
      // 영어 자막 없으면 한국어 시도
      try {
        const { YoutubeTranscript } = await import("youtube-transcript");
        const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: "ko" });
        transcriptText = transcript.map(t => `[${fmtT(t.offset / (t.offset > 10000 ? 1000 : 1))}] ${t.text}`).join("\n").slice(0, 10000);
      } catch {
        transcriptText = ""; // 자막 없음 — 제목/설명만으로 대본 생성
      }
    }
  }

  if (!videoTitle && !transcriptText) {
    return NextResponse.json({
      error: "상세 영상 정보를 가져올 수 없습니다. 원본 URL을 확인하시거나 자막 스튜디오를 거쳐서 자막을 함께 추출해 주세요."
    }, { status: 400 });
  }

  // ── 3단계: GPT-4o 한국어 대본 생성 ────────────────────────────
  const hasTranscript = transcriptText.length > 0;

  const systemPrompt = `당신은 대한민국 최고 시청률을 자랑하는 예능/다큐 유튜브 "코릿치(Koritch)" 채널의 메인 대본 PD이자 스토리텔러입니다. 당신이 쓴 대본은 흡입력이 뛰어나 시청자가 1초도 눈을 떼지 못하게 만듭니다.

■ 코릿치 채널 정체성:
- 외국인의 한국 방문기나 K-컬처 리액션 영상을 발굴해, 한국인 시청자들의 '국뽕', '감동', '폭소', '격공'을 극한으로 끌어올리는 것이 목표입니다.
- 단순 번역을 넘어 영상의 서사를 재창조하고 짜임새 있는 방송급 콘텐츠로 기획합니다.

■ 코릿치 영상 구조 (완벽한 3막 구조):

[파트1: 인트로 나레이션] (티저 & 후킹)
- 시작부터 시청자의 멱살을 잡고 끌고 가는 강렬한 오프닝 멘트
- 영상의 가장 하이라이트가 될 소구 포인트를 매력적으로 브리핑
- "과연 이 외국인은 한국에서 무사히 살아남았을까요? 바로 보시죠!" 식의 기대감 폭발 전환 멘트

[파트2: 본편 보조 나레이션] (감정을 쥐락펴락하는 코멘터리)
- 원본 영상 사이사이에 치고 빠지며 지루할 틈을 주지 않는 맛깔나는 조미료 역할
- 상황 전개에 대한 '핵심 요약', 문화 차이에 대한 '재치 있는 해설', 시청자 입장을 대변하는 '사이다 리액션'
- 시청자의 감정선에 맞춰 유머와 감동을 밀당 적재적소에 꽂아 넣습니다.

[파트3: 아웃트로 나레이션] (여운과 구독 유도)
- 영상을 총평하며 가슴이 따뜻해지는 감성 한 스푼 추가
- 극적인 구독/좋아요 유도 멘트와 시그니처 맺음말 ("지금까지 코릿치였습니다!")

■ 대본 작성 핵심 수칙:
1. AI가 쓴 티가 나는 기계적이고 딱딱한 문장 절대 금지.
2. 유재석/신동엽이나 인기 유튜버처럼 입에 착착 감기는 찰진 구어체와 방송 용어 활용.
3. 영상의 특정 장면(외국인의 당황한 표정, 경이로운 풍경 등)을 머릿속에 그리며 생생한 디테일을 추가하세요.
4. JSON 형식 응답 (마크다운 코드블록 금지).
- 대본 유형 종류: intro(인트로), hook(훅), context(맥락설명), reaction(반응해설), humor(유머/재미), emotion(감성), outro(아웃트로)`;

  // 영상 길이 기반 보조 나레이션 수 계산
  function parseDurationSecs(iso: string): number {
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    return (parseInt(m[1]||"0")*3600) + (parseInt(m[2]||"0")*60) + parseInt(m[3]||"0");
  }
  let durationSecs = parseDurationSecs(duration);
  if (localDuration && !isNaN(localDuration)) {
    durationSecs = Math.floor(localDuration);
  }

  const midNarrationCount = Math.max(durationSecs > 0 ? 2 : 5, Math.floor(durationSecs / 90)); 
  const durationLabel = durationSecs > 0
    ? `${Math.floor(durationSecs/60)}분 ${durationSecs%60}초`
    : "알 수 없음";

  const durationLimitPrompt = durationSecs > 0 
    ? `\n⚠ 🚨 중요: 전체 영상 길이는 ${durationLabel}입니다. 절대로 ${durationLabel}를 초과하는 타임스탬프를 생성하지 마세요! (초과 시 오류 발생)` 
    : "";

  const userPrompt = `다음 외국인 영상을 프로 방송 작가의 시선으로 분석하여, 시청자가 열광할 퀄리티 높은 나레이션 대본을 작성하세요.

■ 파악한 영상 정보:
- 제목: ${videoTitle || "정보 없음"}
- 채널: ${channelTitle || "정보 없음"}
- 총 분량: ${durationLabel} ${durationLimitPrompt}
${videoDescription ? `- 설명: ${videoDescription}` : ""}
${hasTranscript ? `\n■ [핵심] 원본 자막 (이 내용을 바탕으로 스토리를 구성하세요):\n${transcriptText}` : "\n⚠ 자막 데이터 없음 — 제목과 설명을 기반으로 창의적이고 풍성한 대본을 상상해서 작성하세요."}

■ 본격적인 코릿치 대본 집필 요구사항:
1. [파트1: 폭풍 인트로] (3~5개 나레이션 연속)
   - 시청자의 궁금증을 폭발시키는 후킹 멘트로 시작하세요.
   - 영상의 핵심 재미 포인트를 재치 있게 짚어주며 본편 시청을 강하게 유도하세요.

2. [파트2: 본편 코멘터리] (영상 길이에 맞춰 ${midNarrationCount}개 이상 넉넉히 배치)
   - 자막의 맥락을 분석하여 감정이 고조되거나 문화적 차이가 돋보이는 '결정적 타임스탬프'마다 치고 들어오세요.
   - 단순 상황 설명이 아니라, 시청자가 무릎을 탁 치게 만드는 통찰, 공감, 익살스러운 해설을 달아주세요. (단답형 코멘트 금지)

3. [파트3: 마무리 아웃트로] (2~3개 나레이션)
   - 진한 여운을 남기는 한 줄 평과 함께, 아주 자연스럽게 구독/좋아요를 유도하세요.

지금 바로, 뻔한 대본이 아닌 생명력이 느껴지는 프로의 JSON 작품을 보여주세요.

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
