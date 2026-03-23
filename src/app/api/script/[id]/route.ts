import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET — 단일 대본 상세 조회
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const script = await prisma.script.findUnique({ where: { id } });
    if (!script) {
      return NextResponse.json({ error: "대본을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({
      ...script,
      script: JSON.parse(script.scriptJson),
    });
  } catch (err) {
    return NextResponse.json({ error: `DB 오류: ${String(err)}` }, { status: 500 });
  }
}
