import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// YouTube API 응답 → VideoItem 형태로 변환 + AI 점수 산정
function scoreVideo(video: {
  views: number;
  likes: number;
  subs: number;
  daysAgo: number;
  duration: number; // 초
}): { score: number; grade: "S" | "A" | "B" } {
  let score = 0;

  // 구독자 대비 조회수 비율 (핵심 지표)
  const viewSubRatio = video.subs > 0 ? video.views / video.subs : 1;
  if (viewSubRatio > 2)       score += 30;
  else if (viewSubRatio > 0.8) score += 20;
  else if (viewSubRatio > 0.3) score += 10;
  else                          score += 3;

  // 좋아요 비율 (YouTube 평균 1~3%)
  const likeRate = video.views > 0 ? video.likes / video.views : 0;
  if (likeRate > 0.04)       score += 25; // 4% 이상 = 매우 높음
  else if (likeRate > 0.02)  score += 18; // 2% 이상 = 양호
  else if (likeRate > 0.008) score += 10; // 0.8% 이상 = 보통
  else                        score += 2;

  // 업로드 최신성
  if (video.daysAgo <= 3)       score += 20;
  else if (video.daysAgo <= 7)  score += 14;
  else if (video.daysAgo <= 14) score += 7;

  // 영상 길이 (8~30분이 K-콘텐츠 최적)
  const mins = video.duration / 60;
  if (mins >= 8 && mins <= 30)        score += 15;
  else if (mins >= 4 && mins < 8)     score += 9;
  else if (mins > 30 && mins <= 45)   score += 7;

  // 구독자 수 (적을수록 발굴 가치 높음)
  if (video.subs < 3000)        score += 10;
  else if (video.subs < 15000)  score += 6;
  else if (video.subs < 50000)  score += 3;

  const finalScore = Math.min(100, Math.max(10, score));
  // S: 72점+, A: 52점+, B: 나머지
  const grade = finalScore >= 72 ? "S" : finalScore >= 52 ? "A" : "B";
  return { score: finalScore, grade };
}

function parseDuration(iso: string): number {
  // PT14M23S → 863초
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] || "0") * 3600) + (parseInt(match[2] || "0") * 60) + parseInt(match[3] || "0");
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function getDaysAgo(publishedAt: string): { daysAgo: number; label: string } {
  const diff = Date.now() - new Date(publishedAt).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return { daysAgo: 0, label: "오늘" };
  if (days === 1) return { daysAgo: 1, label: "1일 전" };
  return { daysAgo: days, label: `${days}일 전` };
}

// 니치별 다국어 키워드 — 영어 + 일본어 + 스페인어 + 프랑스어 + 독일어 + 태국어 + 포르투갈어 + 베트남어
const NICHE_KEYWORDS: Record<string, string[]> = {
  "K-먹방": [
    "korean food vlog", "eating in korea", "korean convenience store food",
    "韓国 グルメ 旅行", "韓国 コンビニ 外国人",
    "comida coreana viaje", "comida coréia vlog",
    "cuisine coréenne voyage", "koreanisches Essen probieren",
    "อาหารเกาหลี เที่ยว", "ẩm thực hàn quốc du lịch",
  ],
  "K-바비큐": [
    "korean bbq foreigner", "samgyeopsal experience tourist",
    "韓国 焼肉 体験", "barbacoa coreana turista",
    "BBQ coréen expérience", "koreanisches BBQ", "ปิ้งย่างเกาหลี",
  ],
  "K-교통": [
    "seoul subway foreigner", "korean public transport tourist",
    "ソウル 地下鉄 外国人", "metro de seúl turista",
    "métro séoul touriste", "Seoul U-Bahn Tourist",
  ],
  "K-문화": [
    "jjimjilbang foreign", "korean culture shock foreigner",
    "韓国 文化 ショック", "choque cultural corea",
    "culture coréenne choc", "Kulturschock Korea",
    "วัฒนธรรมเกาหลี ชาวต่างชาติ",
  ],
  "K-의료": [
    "korea hospital tourist", "korean clinic foreigner",
    "韓国 病院 外国人", "hospital corea turista",
  ],
  "K-뷰티": [
    "korea beauty shopping tourist", "korean skincare haul",
    "韓国 コスメ 購入", "compras belleza corea",
    "cosmétique coréen shopping", "koreanische Kosmetik",
    "เครื่องสำอางเกาหลี ช้อปปิ้ง",
  ],
  "K-라이프": [
    "living in seoul foreigner daily life", "expat korea vlog",
    "韓国 生活 外国人", "vivir en corea experiencia",
    "vivre en corée vlog", "Leben in Korea Alltag",
    "ชีวิตในเกาหลี ต่างชาติ", "sống ở hàn quốc",
  ],
  "K-쇼핑": [
    "daiso korea shopping foreigner", "market in korea tourist",
    "韓国 ダイソー 買い物", "compras en corea mercado",
    "shopping corée marché",
  ],
  "K-관광": [
    "korea travel vlog tourist", "first time seoul foreigner",
    "韓国 旅行 初めて", "viaje corea primera vez",
    "voyage corée première fois", "Korea Reise zum ersten Mal",
    "เที่ยวเกาหลี ครั้งแรก", "du lịch hàn quốc lần đầu",
  ],
};

// 언어 코드 → 검색 우선 언어 매핑
const LANG_OPTIONS: { code: string; label: string; relevance: string }[] = [
  { code: "all",  label: "전체 언어", relevance: "" },
  { code: "en",   label: "English",   relevance: "en" },
  { code: "ja",   label: "日本語",    relevance: "ja" },
  { code: "es",   label: "Español",   relevance: "es" },
  { code: "fr",   label: "Français",  relevance: "fr" },
  { code: "de",   label: "Deutsch",   relevance: "de" },
  { code: "th",   label: "ไทย",       relevance: "th" },
  { code: "pt",   label: "Português", relevance: "pt" },
  { code: "vi",   label: "Tiếng Việt", relevance: "vi" },
  { code: "zh",   label: "中文",      relevance: "zh-Hans" },
  { code: "id",   label: "Bahasa",    relevance: "id" },
];

export async function POST(req: NextRequest) {
  try {
    const { maxSubs = 50000, maxViews = 20000, dayRange = 7, niche = "전체", lang = "all" } = await req.json();

    // YouTube API 키 가져오기
    let apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      try {
        const record = await prisma.apiKey.findUnique({ where: { service: "youtube" } });
        apiKey = record?.value ?? undefined;
      } catch { /* prisma not connected */ }
    }

    if (!apiKey) {
      return NextResponse.json({ error: "YouTube API 키가 설정되지 않았습니다. 설정 > API 설정에서 YouTube Data API v3 키를 입력해주세요." }, { status: 400 });
    }

    // 검색 키워드 선택
    let keywords: string[];
    if (niche !== "전체" && NICHE_KEYWORDS[niche]) {
      keywords = NICHE_KEYWORDS[niche];
    } else {
      keywords = Object.values(NICHE_KEYWORDS).flat().sort(() => Math.random() - 0.5);
    }

    // 언어 지정 시 해당 언어 키워드만 필터, 전체면 랜덤 믹스
    const langConfig = LANG_OPTIONS.find(l => l.code === lang);
    const relevanceLanguage = langConfig?.relevance || "";

    // API 쿼터 절약: 최대 3개 키워드로 제한
    const selectedKeywords = keywords.sort(() => Math.random() - 0.5).slice(0, 3);

    const publishedAfter = new Date(Date.now() - dayRange * 24 * 3600 * 1000).toISOString();
    const allVideoIds: string[] = [];
    const videoNicheMap: Record<string, string> = {};

    // 1단계: 키워드별 검색 (relevanceLanguage 옵션)
    for (const keyword of selectedKeywords) {
      const nicheLabel = niche !== "전체" ? niche
        : Object.entries(NICHE_KEYWORDS).find(([, kws]) => kws.includes(keyword))?.[0] ?? "K-관광";

      let searchUrl =
        `https://www.googleapis.com/youtube/v3/search?` +
        `part=snippet&type=video&q=${encodeURIComponent(keyword)}&` +
        `publishedAfter=${publishedAfter}&maxResults=15&` +
        `videoDuration=medium&` +
        `videoEmbeddable=true&videoSyndicated=true&key=${apiKey}`;

      // 전체 언어가 아니면 relevanceLanguage로 특정 언어 우선
      if (relevanceLanguage) {
        searchUrl += `&relevanceLanguage=${relevanceLanguage}`;
      }

      const searchRes = await fetch(searchUrl);
      if (!searchRes.ok) {
        const err = await searchRes.json();
        return NextResponse.json({ error: `YouTube 검색 실패: ${err.error?.message ?? searchRes.status}` }, { status: 400 });
      }
      const searchData = await searchRes.json();
      for (const item of searchData.items ?? []) {
        const vid = item.id?.videoId;
        if (vid && !allVideoIds.includes(vid)) {
          allVideoIds.push(vid);
          videoNicheMap[vid] = nicheLabel;
        }
      }
    }

    if (allVideoIds.length === 0) {
      return NextResponse.json({ videos: [] });
    }

    // 2단계: 영상 상세 정보 (조회수, 좋아요, 길이)
    const videoIds = allVideoIds.slice(0, 30).join(",");
    const videoRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails,status&id=${videoIds}&key=${apiKey}`
    );
    const videoData = await videoRes.json();

    // 3단계: 채널 구독자 수 (배치)
    const channelIds = [...new Set<string>((videoData.items ?? []).map((v: { snippet: { channelId: string } }) => v.snippet.channelId))].join(",");
    const channelRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelIds}&key=${apiKey}`
    );
    const channelData = await channelRes.json();
    const channelMap: Record<string, { subs: number; name: string }> = {};
    for (const ch of channelData.items ?? []) {
      channelMap[ch.id] = {
        subs: parseInt(ch.statistics?.subscriberCount ?? "0"),
        name: ch.snippet?.title ?? "",
      };
    }

    // 4단계: 필터링 + 점수 산정
    const results = [];
    for (const video of videoData.items ?? []) {
      const views = parseInt(video.statistics?.viewCount ?? "0");
      const likes = parseInt(video.statistics?.likeCount ?? "0");
      const channelId = video.snippet?.channelId;
      const ch = channelMap[channelId] ?? { subs: 0, name: "" };
      const subs = ch.subs;
      const durationSecs = parseDuration(video.contentDetails?.duration ?? "");
      const { daysAgo, label } = getDaysAgo(video.snippet?.publishedAt ?? "");

      // 필터: 구독자 & 조회수 상한
      if (subs > maxSubs) continue;
      if (views > maxViews) continue;
      if (daysAgo > dayRange) continue;

      // 필터: 임베드 불가 또는 한국 지역 제한 영상 제외
      const embeddable = video.status?.embeddable !== false;
      const restricted = video.contentDetails?.regionRestriction?.blocked?.includes("KR");
      if (!embeddable || restricted) continue;

      // ── 한국어 영상 제외 필터 ──────────────────────────────
      const audioLang = (video.snippet?.defaultAudioLanguage ?? "").toLowerCase();
      const defaultLang = (video.snippet?.defaultLanguage ?? "").toLowerCase();
      const videoTitle: string = video.snippet?.title ?? "";
      const channelTitle: string = video.snippet?.channelTitle ?? "";
      const description: string = (video.snippet?.description ?? "").slice(0, 500);

      // 1) 기본 오디오 언어가 한국어 → 한국어 나레이션 영상
      if (audioLang === "ko" || audioLang.startsWith("ko-")) continue;

      // 2) 기본 언어가 한국어 → 한국어 콘텐츠
      if (defaultLang === "ko" || defaultLang.startsWith("ko-")) continue;

      // 3) 제목에 한국어 문자가 포함 → 한국인이 만든 영상일 가능성 높음
      const koRegex = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]/;
      const titleHasKo = koRegex.test(videoTitle);
      const channelHasKo = koRegex.test(channelTitle);

      // 제목이 한글로만 이루어져 있거나, 한글 비율이 높으면 제외
      if (titleHasKo) {
        const koChars = (videoTitle.match(koRegex) || []).length;
        // 한글 문자가 제목 길이의 30% 이상이면 한국어 영상으로 판단
        if (koChars / videoTitle.length > 0.3) continue;
      }

      // 채널명이 완전 한글이면 제외 (한국 채널)
      if (channelHasKo) {
        const nonSpace = channelTitle.replace(/\s/g, "");
        const koCount = (nonSpace.match(/[\uAC00-\uD7AF]/g) || []).length;
        if (koCount / nonSpace.length > 0.5) continue;
      }

      // 4) 설명에 한국어 비율이 높으면 제외
      if (koRegex.test(description)) {
        const descKoCount = (description.match(/[\uAC00-\uD7AF]/g) || []).length;
        if (descKoCount > 30) continue; // 한글 30자 이상이면 한국어 콘텐츠
      }

      // ── 점수 산정 ─────────────────────────────────────────
      const { score, grade } = scoreVideo({ views, likes, subs, daysAgo, duration: durationSecs });

      // hasCC: 한국어 자막이 없는 외국어 영상인지 표시
      const isNonKorean = audioLang !== "" && !audioLang.startsWith("ko");

      results.push({
        id: video.id,
        ytId: video.id,
        title: videoTitle,
        channel: ch.name || channelTitle,
        subs: formatCount(subs),
        subsRaw: subs,
        views: formatCount(views),
        viewsRaw: views,
        likes: formatCount(likes),
        duration: formatDuration(durationSecs),
        niche: videoNicheMap[video.id] ?? "K-관광",
        grade,
        score,
        hasCC: isNonKorean,
        lang: audioLang || "unknown",
        uploadedAt: label,
        thumbnail: video.snippet?.thumbnails?.high?.url ?? video.snippet?.thumbnails?.default?.url ?? "",
        thumbnailFallback: "#3b82f6",
        reason: `구독자 ${formatCount(subs)} 채널에서 ${formatCount(views)} 조회 달성 · 좋아요 비율 ${views > 0 ? ((likes / views) * 100).toFixed(1) : 0}% · ${label} 업로드${audioLang ? ` · 언어: ${audioLang}` : ""}`,
      });
    }

    // 점수 내림차순 정렬
    results.sort((a, b) => b.score - a.score);

    return NextResponse.json({ videos: results.slice(0, 20), total: results.length });
  } catch (err) {
    return NextResponse.json({ error: `서버 오류: ${String(err)}` }, { status: 500 });
  }
}
