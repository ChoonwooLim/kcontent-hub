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

  // 구독자 대비 조회수 비율 (핵심 지표 - 낮은 구독자에 높은 조회수 = 바이럴 가능성)
  const viewSubRatio = video.subs > 0 ? video.views / video.subs : 0;
  if (viewSubRatio > 3) score += 30;
  else if (viewSubRatio > 1.5) score += 18;
  else if (viewSubRatio > 0.5) score += 8;

  // 좋아요 비율 (engagement rate)
  const likeRate = video.views > 0 ? video.likes / video.views : 0;
  if (likeRate > 0.06) score += 25;
  else if (likeRate > 0.03) score += 15;
  else if (likeRate > 0.01) score += 8;

  // 업로드 최신성
  if (video.daysAgo <= 3) score += 20;
  else if (video.daysAgo <= 7) score += 12;
  else if (video.daysAgo <= 14) score += 6;

  // 영상 길이 (10~25분이 최적)
  const mins = video.duration / 60;
  if (mins >= 10 && mins <= 25) score += 15;
  else if (mins >= 5 && mins < 10) score += 8;
  else if (mins > 25 && mins <= 40) score += 6;

  // 구독자 수 (적을수록 발굴 가치 높음)
  if (video.subs < 2000) score += 10;
  else if (video.subs < 10000) score += 6;
  else if (video.subs < 50000) score += 3;

  const finalScore = Math.min(100, Math.max(10, score));
  const grade = finalScore >= 88 ? "S" : finalScore >= 72 ? "A" : "B";
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

const NICHE_KEYWORDS: Record<string, string[]> = {
  "K-먹방": ["korean food vlog", "eating in korea", "korean convenience store food foreign"],
  "K-바비큐": ["korean bbq foreigner", "samgyeopsal experience tourist"],
  "K-교통": ["seoul subway foreigner", "korean public transport tourist"],
  "K-문화": ["jjimjilbang foreign", "korean culture shock foreigner"],
  "K-의료": ["korea hospital tourist", "korean clinic foreigner"],
  "K-뷰티": ["korea beauty shopping tourist", "korean skincare haul"],
  "K-라이프": ["living in seoul foreigner daily life", "expat korea vlog"],
  "K-쇼핑": ["daiso korea shopping foreigner", "market in korea tourist"],
  "K-관광": ["korea travel vlog tourist", "first time seoul foreigner"],
};

export async function POST(req: NextRequest) {
  try {
    const { maxSubs = 50000, maxViews = 20000, dayRange = 7, niche = "전체" } = await req.json();

    // YouTube API 키 가져오기 (DB 우선, localStorage fallback 불가능 → DB에서만)
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
    const keywords = niche !== "전체" && NICHE_KEYWORDS[niche]
      ? NICHE_KEYWORDS[niche]
      : Object.values(NICHE_KEYWORDS).flat().sort(() => Math.random() - 0.5).slice(0, 3);

    const publishedAfter = new Date(Date.now() - dayRange * 24 * 3600 * 1000).toISOString();
    const allVideoIds: string[] = [];
    const videoNicheMap: Record<string, string> = {};

    // 1단계: 키워드별 검색
    for (const keyword of keywords.slice(0, 2)) {
      const nicheLabel = niche !== "전체" ? niche
        : Object.entries(NICHE_KEYWORDS).find(([, kws]) => kws.includes(keyword))?.[0] ?? "K-관광";

      const searchRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?` +
        `part=snippet&type=video&q=${encodeURIComponent(keyword)}&` +
        `publishedAfter=${publishedAfter}&maxResults=15&` +
        `videoDuration=medium&relevanceLanguage=en&key=${apiKey}`
      );
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
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${apiKey}`
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

      // 필터: 구독자 & 조회수 상한, 영어 제목
      if (subs > maxSubs) continue;
      if (views > maxViews) continue;
      if (daysAgo > dayRange) continue;

      const { score, grade } = scoreVideo({ views, likes, subs, daysAgo, duration: durationSecs });

      results.push({
        id: video.id,
        ytId: video.id,
        title: video.snippet?.title ?? "",
        channel: ch.name || (video.snippet?.channelTitle ?? ""),
        subs: formatCount(subs),
        subsRaw: subs,
        views: formatCount(views),
        viewsRaw: views,
        likes: formatCount(likes),
        duration: formatDuration(durationSecs),
        niche: videoNicheMap[video.id] ?? "K-관광",
        grade,
        score,
        hasCC: (video.snippet?.defaultAudioLanguage ?? "") !== "ko",
        uploadedAt: label,
        thumbnail: video.snippet?.thumbnails?.high?.url ?? video.snippet?.thumbnails?.default?.url ?? "",
        thumbnailFallback: "#3b82f6",
        reason: `구독자 ${formatCount(subs)} 채널에서 ${formatCount(views)} 조회 달성 · 좋아요 비율 ${views > 0 ? ((likes / views) * 100).toFixed(1) : 0}% · ${label} 업로드`,
      });
    }

    // 점수 내림차순 정렬
    results.sort((a, b) => b.score - a.score);

    return NextResponse.json({ videos: results.slice(0, 20), total: results.length });
  } catch (err) {
    return NextResponse.json({ error: `서버 오류: ${String(err)}` }, { status: 500 });
  }
}
