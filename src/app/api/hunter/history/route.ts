import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/hunter/history — 최근 검색 기록 조회
export async function GET() {
  try {
    const ws = await prisma.workspace.findFirst();
    if (!ws) return NextResponse.json({ searches: [] });

    // 가장 최근 검색 1건 반환
    const latest = await prisma.hunterSearch.findFirst({
      where: { workspaceId: ws.id },
      orderBy: { createdAt: "desc" },
    });

    if (!latest) return NextResponse.json({ searches: [], videos: [] });

    return NextResponse.json({
      searches: [latest],
      videos: JSON.parse(latest.resultsJson || "[]"),
      searchParams: {
        niche: latest.niche,
        maxSubs: latest.maxSubs,
        maxViews: latest.maxViews,
        minSubs: latest.minSubs,
        minViews: latest.minViews,
        dayRange: latest.dayRange,
        lang: latest.lang,
        keywords: latest.keywords ?? "",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/hunter/history — 검색 결과 저장
export async function POST(req: NextRequest) {
  try {
    const { niche, maxSubs, maxViews, minSubs, minViews, dayRange, lang, videos, keywords } = await req.json();

    const ws = await prisma.workspace.findFirst();
    if (!ws) return NextResponse.json({ error: "No workspace" }, { status: 403 });

    const record = await prisma.hunterSearch.create({
      data: {
        niche: niche || "전체",
        maxSubs: typeof maxSubs === "number" ? maxSubs : 50000,   // 0 = 무제한
        maxViews: typeof maxViews === "number" ? maxViews : 20000,
        minSubs: typeof minSubs === "number" ? minSubs : 0,
        minViews: typeof minViews === "number" ? minViews : 0,
        dayRange: typeof dayRange === "number" ? dayRange : 7,
        lang: lang || "all",
        keywords: typeof keywords === "string" && keywords.trim() ? keywords.trim().slice(0, 500) : null,
        resultCount: Array.isArray(videos) ? videos.length : 0,
        resultsJson: JSON.stringify(videos || []),
        workspaceId: ws.id,
      },
    });

    return NextResponse.json({ id: record.id, saved: true }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
