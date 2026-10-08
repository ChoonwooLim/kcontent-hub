import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toShareDto } from "@/lib/share";
import ShareViewer from "./ShareViewer";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const s = await prisma.subtitleShare.findUnique({ where: { token }, select: { title: true } }).catch(() => null);
  return { title: s ? `${s.title} · KContent Studio` : "공유 자막 영상 · KContent Studio" };
}

/**
 * /share/[token] — 자막 작업 공유 뷰어
 *  - 비공개 링크: 로그인한 회원 누구나 (일반 회원 포함, API 키 등록 여부 무관)
 *  - 공개 링크: 로그인 없이 열람
 */
export default async function SharePage({ params }: Props) {
  const { token } = await params;
  const share = await prisma.subtitleShare.findUnique({
    where: { token },
    include: { createdBy: { select: { name: true, email: true } } },
  });
  if (!share) notFound();

  const session = await auth();
  if (!share.isPublic && !session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/share/${token}`)}`);
  }

  // 조회수 (응답을 막지 않음)
  prisma.subtitleShare.update({ where: { id: share.id }, data: { views: { increment: 1 } } }).catch(() => {});

  const canManage = !!session?.user && (session.user.id === share.createdById || session.user.role === "ADMIN");

  return (
    <ShareViewer
      share={toShareDto(share, { includeSubs: true })}
      viewerEmail={session?.user?.email ?? null}
      canManage={canManage}
    />
  );
}
