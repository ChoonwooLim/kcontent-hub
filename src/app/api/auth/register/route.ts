import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "이메일과 비밀번호는 필수입니다." }, { status: 400 });
    }

    // 이메일 중복 검사
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "이미 가입된 이메일입니다." }, { status: 409 });
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 10);

    // 사용자 생성
    const user = await prisma.user.create({
      data: {
        name: name || email.split("@")[0],
        email,
        password: hashedPassword,
      },
    });

    // 기본 워크스페이스에 멤버로 추가
    try {
      const workspace = await prisma.workspace.findFirst();
      if (workspace) {
        await prisma.workspaceMember.create({
          data: {
            userId: user.id,
            workspaceId: workspace.id,
            role: "MEMBER",
          },
        });
      }
    } catch { /* workspace 연결 실패 시 무시 */ }

    return NextResponse.json({
      success: true,
      message: "회원가입 완료! 로그인해주세요.",
    }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "회원가입 실패", detail: String(e) }, { status: 500 });
  }
}
