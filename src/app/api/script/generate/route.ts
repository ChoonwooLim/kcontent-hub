import { NextRequest, NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";
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
  const { url } = await req.json();

  const videoId = extractVideoId(url);
  if (!videoId) {
    return NextResponse.json({ error: "유효하지 않은 YouTube URL입니다." }, { status: 400 });
  }

  // API 키 로드
  const youtubeKey = await getApiKey("youtube", "YOUTUBE_API_KEY");
  const openaiKey  = await getApiKey("openai",  "OPENAI_API_KEY");

  if (!openaiKey) {
    return NextResponse.json({ error: "OpenAI API 키가 설정되지 않았습니다. 설정 → API 설정에서 입력해주세요." }, { status: 400 });
  }

  // ── 1단계: YouTube 영상 메타데이터 ──────────────────────────────
  let videoTitle = "";
  let videoDescription = "";
  let channelTitle = "";
  let duration = "";

  if (youtubeKey) {
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

  // ── 2단계: 실제 YouTube 자막 추출 ──────────────────────────────
  let transcriptText = "";
  let transcriptSegments: { offset: number; text: string }[] = [];

  try {
    // 영어 자막 우선, 없으면 자동생성 자막
    const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" });
    transcriptSegments = transcript.map(t => ({ offset: t.offset, text: t.text }));
    transcriptText = transcript.map(t => t.text).join(" ").slice(0, 6000);
  } catch {
    // 영어 자막 없으면 한국어 시도
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: "ko" });
      transcriptSegments = transcript.map(t => ({ offset: t.offset, text: t.text }));
      transcriptText = transcript.map(t => t.text).join(" ").slice(0, 6000);
    } catch {
      transcriptText = ""; // 자막 없음 — 제목/설명만으로 대본 생성
    }
  }

  if (!videoTitle && !transcriptText) {
    return NextResponse.json({
      error: "영상 정보를 가져올 수 없습니다. YouTube API 키를 확인하거나, 자막이 있는 영상을 사용해주세요."
    }, { status: 400 });
  }

  // ── 3단계: GPT-4o 한국어 대본 생성 ────────────────────────────
  const hasTranscript = transcriptText.length > 0;

  const systemPrompt = `당신은 K-콘텐츠 전문 번역·재창작 PD입니다.
해외 외국인이 한국을 방문하거나 한국 문화를 체험하는 YouTube 영상을 분석하여,
한국 시청자를 위한 감성 자막 대본으로 재창작하는 전문가입니다.

출력 규칙:
- JSON 형식으로만 응답 (마크다운 코드블록 없이 순수 JSON)
- 타임스탬프는 영상 자막 오프셋 기준으로 MM:SS 형식
- 대본 유형: hook(훅/충격), reaction(외국인반응), narration(나레이션), commentary(해설)
- 한국 시청자 감성 최적화: 국뽕, 공감, 충격, 재미 포인트 강조`;

  const userPrompt = `다음 YouTube 영상 정보를 바탕으로 한국어 자막 대본을 생성하세요.

영상 제목: ${videoTitle || "정보 없음"}
채널명: ${channelTitle || "정보 없음"}
${videoDescription ? `영상 설명: ${videoDescription}` : ""}
${hasTranscript ? `\n원본 자막 (영어):\n${transcriptText}` : "\n주의: 자막 없음 — 제목과 설명만으로 대본 창작"}

다음 JSON을 정확히 반환하세요:
{
  "title": "CTR 최적화 한국어 제목 (클릭 유도, 60자 이내)",
  "thumbnailTop": "썸네일 상단 텍스트 (충격/호기심 유발, 15자 이내)",
  "thumbnailBottom": "썸네일 하단 임팩트 문구 (12자 이내, 따옴표 포함 가능)",
  "script": [
    { "time": "00:00", "type": "hook", "ko": "시청자를 사로잡는 첫 문장" },
    { "time": "00:15", "type": "reaction", "ko": "외국인 반응 묘사" },
    ...최소 8개 장면
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
      max_tokens: 2000,
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

  let parsed: {
    title: string;
    thumbnailTop: string;
    thumbnailBottom: string;
    script: { time: string; type: string; ko: string }[];
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

  return NextResponse.json({
    videoId,
    videoTitle,
    channelTitle,
    hasTranscript,
    title: parsed.title,
    thumbnailTop: parsed.thumbnailTop,
    thumbnailBottom: parsed.thumbnailBottom,
    script: parsed.script,
  });
}
