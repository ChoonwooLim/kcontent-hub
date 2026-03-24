import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// 원작자 알림 메시지 템플릿 — 언어별
const OUTREACH_TEMPLATES: Record<string, (channel: string, title: string) => string> = {
  en: (channel, title) =>
    `Hi ${channel}! 👋\n\nI'm a Korean content creator and I absolutely loved your video "${title}"! Your unique perspective on Korea really resonated with Korean viewers.\n\nI'd love to feature highlights from your video in a Korean-language compilation for my audience, with full credit and a link to your original video. This would help introduce your channel to Korean viewers!\n\n✅ Your channel name & link will be prominently displayed\n✅ Original video link included in description\n✅ Any revenue from the compilation can be discussed\n\nWould you be open to this collaboration? I'd be happy to share the final video with you before publishing.\n\nThank you! 🙏`,

  ja: (channel, title) =>
    `${channel}さん、こんにちは！ 👋\n\n「${title}」の動画を拝見しました！韓国についてのあなたの視点がとても素晴らしいです。\n\n韓国の視聴者向けに、あなたの動画のハイライトを韓国語コンテンツとして紹介させていただきたいです。もちろん、チャンネル名と元の動画リンクを明記いたします。\n\n✅ チャンネル名とリンクを表示\n✅ 元動画のリンクを説明欄に掲載\n✅ 収益についてもご相談可能\n\nこのコラボレーションにご興味がありましたら、ぜひお知らせください！\n\nよろしくお願いします 🙏`,

  es: (channel, title) =>
    `¡Hola ${channel}! 👋\n\n¡Me encantó tu video "${title}"! Tu perspectiva sobre Corea es realmente única y conecta con los espectadores coreanos.\n\nMe gustaría presentar lo mejor de tu video en un contenido en coreano para mi audiencia, dándote todo el crédito con un enlace a tu video original.\n\n✅ Tu nombre de canal y enlace serán destacados\n✅ Enlace al video original en la descripción\n✅ Podemos discutir sobre los ingresos\n\n¿Estarías abierto/a a esta colaboración?\n\n¡Gracias! 🙏`,

  default: (channel, title) =>
    `Hi ${channel}! 👋\n\nI loved your video "${title}" about Korea! I'd like to feature highlights from your video in a Korean-language compilation for Korean viewers, with full credit and link to your original video.\n\n✅ Full credit with channel name & link\n✅ Original video link in description\n✅ Revenue sharing can be discussed\n\nWould you be interested in this collaboration?\n\nThank you! 🙏`,
};

function generateOutreachMessage(channel: string, title: string, lang?: string): { lang: string; message: string } {
  const msgLang = lang && lang !== "unknown" ? lang : "en";
  const templateFn = OUTREACH_TEMPLATES[msgLang] || OUTREACH_TEMPLATES.default;
  return { lang: msgLang, message: templateFn(channel, title) };
}

// GET /api/pipeline — 전체 파이프라인 영상 목록
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { workspaceMembers: true },
    });
    const workspaceId = user?.workspaceMembers[0]?.workspaceId;
    if (!workspaceId) return NextResponse.json({ videos: [] });

    const videos = await prisma.pipelineVideo.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      include: { publishes: true, outreaches: true, editClips: true },
    });
    return NextResponse.json({ videos });
  } catch (e) {
    return NextResponse.json({ error: "DB 오류", detail: String(e) }, { status: 500 });
  }
}

// POST /api/pipeline — 새 영상 추가 (소재 수집기에서 호출)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { workspaceMembers: true },
    });
    const workspaceId = dbUser?.workspaceMembers[0]?.workspaceId;
    if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 });

    const body = await req.json();

    const {
      title, channel, channelId, originalUrl, ytVideoId,
      views, likes, duration, subs, lang,
      grade, score, niche, aiReason, hasCC, thumbnail,
    } = body;

    // 중복 검사: 같은 YouTube 영상이 이미 저장되어 있으면 기존 레코드 반환
    if (ytVideoId) {
      const existing = await prisma.pipelineVideo.findFirst({
        where: { ytVideoId, workspaceId },
        include: { outreaches: true },
      });
      if (existing) {
        return NextResponse.json({
          video: existing,
          outreach: existing.outreaches[0] || null,
          action: "already_saved",
          message: "이미 파이프라인에 저장된 영상입니다.",
        });
      }
    }

    // 영상 저장
    const video = await prisma.pipelineVideo.create({
      data: {
        workspaceId,
        title: title || "",
        channel: channel || "",
        channelId: channelId || null,
        originalUrl: originalUrl || "",
        ytVideoId: ytVideoId || null,
        views: views || null,
        likes: likes || null,
        duration: duration || null,
        subs: subs || null,
        lang: lang || null,
        grade: grade || "B",
        score: score || 70,
        niche: niche || null,
        aiReason: aiReason || null,
        hasCC: hasCC || false,
        thumbnail: thumbnail || null,
        stage: "발굴 대기",
      },
    });

    // 원작자 알림 메시지 자동 생성
    const { lang: msgLang, message } = generateOutreachMessage(channel, title, lang);
    const outreach = await prisma.creatorOutreach.create({
      data: {
        videoId: video.id,
        type: "comment",
        lang: msgLang,
        message,
        status: "draft",
      },
    });

    return NextResponse.json({
      video,
      outreach,
      action: "created",
      message: "파이프라인에 저장 완료! 원작자 알림 메시지가 생성되었습니다.",
    }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "저장 실패", detail: String(e) }, { status: 500 });
  }
}
