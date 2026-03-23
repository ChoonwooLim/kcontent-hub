import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/keys — 저장된 모든 API 키 조회
export async function GET() {
  try {
    const keys = await prisma.apiKey.findMany();
    const result: Record<string, string> = {};
    for (const k of keys) result[k.service] = k.value;
    return NextResponse.json({ keys: result });
  } catch (e) {
    return NextResponse.json({ error: "DB 연결 오류", detail: String(e) }, { status: 500 });
  }
}

// POST /api/keys — API 키 저장 (upsert)
export async function POST(req: NextRequest) {
  try {
    const body: Record<string, string> = await req.json();
    const results = await Promise.all(
      Object.entries(body).map(([service, value]) =>
        prisma.apiKey.upsert({
          where: { service },
          update: { value, verified: false },
          create: { service, value, verified: false },
        })
      )
    );
    return NextResponse.json({ saved: results.length });
  } catch (e) {
    return NextResponse.json({ error: "저장 실패", detail: String(e) }, { status: 500 });
  }
}
