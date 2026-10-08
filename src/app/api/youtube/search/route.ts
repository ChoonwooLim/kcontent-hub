import { NextRequest, NextResponse } from "next/server";
import { requireUser, resolveYoutubeKey, keyRequiredResponse } from "@/lib/access";
import { resolveNicheKeywords, MAX_KEYWORDS_PER_SCAN } from "@/lib/niches";
import { ytDlpSearch } from "@/lib/ytsearch";

/** YouTube Data API 오류 → 사용자 안내 문구 (쿼터 초과는 초기화 시각까지) */
function friendlyYoutubeError(err: { error?: { message?: string; errors?: { reason?: string }[] } }, status: number): string {
  const msg = err?.error?.message ?? `HTTP ${status}`;
  const reason = err?.error?.errors?.[0]?.reason ?? "";
  if (/quota/i.test(msg) || /quota/i.test(reason)) {
    return "YouTube Data API 일일 쿼터(10,000 units)를 모두 사용했습니다. 쿼터는 매일 태평양 시간 자정(한국 시간 오후 4~5시)에 초기화됩니다. "
      + "검색은 yt-dlp(쿼터 0)로 처리하므로 상세 조회(1~2 units)만 남으면 다시 수집할 수 있습니다. 일반 회원은 본인 키, VIP/관리자는 서버 키의 쿼터를 사용합니다.";
  }
  return `YouTube API 오류: ${msg}`;
}

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
    const { maxSubs = 50000, maxViews = 20000, dayRange = 7, niche = "전체", lang = "all", keywords: customInput = "" } = await req.json();
    // 상한값 0 = 무제한 (구독자·조회수·업로드 기간)
    const subsCap = Number(maxSubs) > 0 ? Number(maxSubs) : 0;
    const viewsCap = Number(maxViews) > 0 ? Number(maxViews) : 0;
    const dayCap = Number(dayRange) > 0 ? Number(dayRange) : 0;

    // YouTube API 키 — VIP/관리자: 서버 공용 키, 일반 회원: 본인 키
    const guard = await requireUser();
    if (guard.error) return guard.error;
    const apiKey = await resolveYoutubeKey(guard.user);
    if (!apiKey) return keyRequiredResponse("youtube", guard.user);

    // 검색 키워드 선택 — 직접 입력 > 특정 분야 > 그룹 전체 > 전체 분야. 언어 선택 시 그 언어 키워드 우선 (정의: src/lib/niches.ts)
    const selection = resolveNicheKeywords(String(niche), typeof customInput === "string" ? customInput : "", String(lang));
    if (selection.keywords.length === 0) {
      return NextResponse.json({ error: "검색 키워드를 1개 이상 입력하세요. (쉼표로 구분, 외국어 권장)" }, { status: 400 });
    }

    const langConfig = LANG_OPTIONS.find(l => l.code === lang);
    const relevanceLanguage = langConfig?.relevance || "";
    const wantLang = lang && lang !== "all" ? String(lang).toLowerCase() : "";

    // 키워드 최대 3개 (직접 입력·언어 선택은 앞에서부터, 전체 언어는 랜덤 샘플링)
    const selectedKeywords = (selection.ordered
      ? selection.keywords
      : [...selection.keywords].sort(() => Math.random() - 0.5)
    ).slice(0, MAX_KEYWORDS_PER_SCAN);

    const publishedAfterParam = dayCap > 0
      ? `publishedAfter=${new Date(Date.now() - dayCap * 24 * 3600 * 1000).toISOString()}&`
      : "";
    const allVideoIds: string[] = [];
    const videoNicheMap: Record<string, string> = {};
    const addIds = (ids: string[], label: string) => {
      for (const vid of ids) {
        if (vid && !allVideoIds.includes(vid)) { allVideoIds.push(vid); videoNicheMap[vid] = label; }
      }
    };

    // 1단계: 검색 — yt-dlp 웹 검색(Data API 쿼터 0)을 키워드별 병렬로 수행, 실패한 키워드만 Data API search.list(100 units)로 폴백
    const dlpResults = await Promise.all(selectedKeywords.map(async keyword => {
      try {
        const hits = await ytDlpSearch(keyword, dayCap, 30);
        return { keyword, ids: hits.map(h => h.id) as string[] | null };
      } catch {
        return { keyword, ids: null as string[] | null };
      }
    }));
    for (const res of dlpResults) if (res.ids) addIds(res.ids, selection.labelFor(res.keyword));
    const failedKeywords = dlpResults.filter(res => !res.ids).map(res => res.keyword);
    const searchEngine = failedKeywords.length === 0 ? "yt-dlp" : failedKeywords.length === selectedKeywords.length ? "data-api" : "mixed";

    for (const keyword of failedKeywords) {
      let searchUrl =
        `https://www.googleapis.com/youtube/v3/search?` +
        `part=snippet&type=video&q=${encodeURIComponent(keyword)}&` +
        `${publishedAfterParam}maxResults=50&` +
        `videoDuration=medium&` +
        `videoEmbeddable=true&videoSyndicated=true&key=${apiKey}`;
      if (relevanceLanguage) searchUrl += `&relevanceLanguage=${relevanceLanguage}`;

      const searchRes = await fetch(searchUrl);
      if (!searchRes.ok) {
        const err = await searchRes.json().catch(() => ({}));
        return NextResponse.json({ error: friendlyYoutubeError(err, searchRes.status) }, { status: 400 });
      }
      const searchData = await searchRes.json();
      addIds(
        ((searchData.items ?? []) as { id?: { videoId?: string } }[]).map(it => it.id?.videoId ?? "").filter(Boolean),
        selection.labelFor(keyword),
      );
    }

    if (allVideoIds.length === 0) {
      return NextResponse.json({ videos: [], total: 0, title: selection.title, keywordsUsed: selectedKeywords, mode: selection.mode, langFallback: selection.langFallback, searchEngine, lang });
    }

    // 2단계: 영상 상세 정보 (조회수, 좋아요, 길이, 언어) — 50개까지 1 unit
    const videoIds = allVideoIds.slice(0, 50).join(",");
    const videoRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails,status&id=${videoIds}&key=${apiKey}`
    );
    if (!videoRes.ok) {
      const err = await videoRes.json().catch(() => ({}));
      return NextResponse.json({ error: friendlyYoutubeError(err, videoRes.status) }, { status: 400 });
    }
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

      // 필터: 구독자 · 조회수 · 기간 상한 (0 = 무제한)
      if (subsCap > 0 && subs > subsCap) continue;
      if (viewsCap > 0 && views > viewsCap) continue;
      if (dayCap > 0 && daysAgo > dayCap) continue;

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

      // ── 쇼츠(60초 미만) 제외 — yt-dlp 검색은 길이 필터가 없음 ──
      if (durationSecs > 0 && durationSecs < 60) continue;

      // ── 선택한 언어와 다른 언어로 표시된 영상 제외 (언어 메타데이터가 있는 영상만 판단) ──
      if (wantLang) {
        const known = audioLang || defaultLang;
        if (known && !known.startsWith(wantLang)) continue;
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
        niche: videoNicheMap[video.id] ?? selection.title,
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

    return NextResponse.json({
      videos: results.slice(0, 20), total: results.length,
      title: selection.title, keywordsUsed: selectedKeywords, mode: selection.mode,
      langFallback: selection.langFallback, searchEngine, lang,
    });
  } catch (err) {
    return NextResponse.json({ error: `서버 오류: ${String(err)}` }, { status: 500 });
  }
}
