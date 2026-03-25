import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, dataUrl, layersJson, workspaceId } = body;

    if (!dataUrl || !workspaceId) {
      return NextResponse.json({ error: "No dataUrl or workspaceId" }, { status: 400 });
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
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspaceId" }, { status: 400 });
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

