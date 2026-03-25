import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// workspace ID를 안전하게 가져오는 헬퍼
async function getWorkspaceId(): Promise<string | null> {
  try {
    const session = await auth();
    if (session?.user?.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: { workspaceMembers: true },
      });
      if (user?.workspaceMembers[0]?.workspaceId) {
        return user.workspaceMembers[0].workspaceId;
      }
    }
  } catch { /* auth 실패 시 fallback */ }

  // Fallback: 첫 번째 workspace 사용
  try {
    const ws = await prisma.workspace.findFirst();
    return ws?.id || null;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, dataUrl, layersJson, workspaceId: bodyWsId } = body;

    const workspaceId = bodyWsId && bodyWsId !== "test-workspace1" ? bodyWsId : await getWorkspaceId();

    if (!dataUrl || !workspaceId) {
      return NextResponse.json({ error: "No dataUrl or valid workspace fallback" }, { status: 400 });
    }

    const saved = await prisma.thumbnailAsset.create({
      data: {
        title: title || "제작된 썸네일",
        dataUrl,
        layersJson,
        workspaceId,
      }
    });

    return NextResponse.json({ success: true, id: saved.id }, { status: 200 });
  } catch (error) {
    console.error("Save Thumbnail Error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const qsWsId = searchParams.get("workspaceId");
    const workspaceId = qsWsId && qsWsId !== "test-workspace1" ? qsWsId : await getWorkspaceId();

    if (!workspaceId) {
      return NextResponse.json({ error: "No valid workspace fallback" }, { status: 400 });
    }

    const thumbnails = await prisma.thumbnailAsset.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ success: true, thumbnails }, { status: 200 });
  } catch (error) {
    console.error("Get Thumbnails Error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, title, dataUrl, layersJson } = body;

    if (!id || !dataUrl) {
      return NextResponse.json({ error: "No id or dataUrl" }, { status: 400 });
    }

    const updated = await prisma.thumbnailAsset.update({
      where: { id },
      data: {
        title: title || undefined,
        dataUrl,
        layersJson,
      }
    });

    return NextResponse.json({ success: true, id: updated.id }, { status: 200 });
  } catch (error) {
    console.error("Update Thumbnail Error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

