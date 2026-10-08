import { NextRequest, NextResponse } from "next/server";
import type { UserPlan, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/access";

export const runtime = "nodejs";

const ROLES: UserRole[] = ["USER", "ADMIN"];
const PLANS: UserPlan[] = ["FREE", "VIP"];

const USER_SELECT = {
  id: true, email: true, name: true, role: true, plan: true, disabled: true,
  createdAt: true, lastLoginAt: true, adminNote: true,
  openaiKeyEnc: true, youtubeKeyEnc: true,
} as const;

type Row = {
  id: string; email: string | null; name: string | null; role: UserRole; plan: UserPlan; disabled: boolean;
  createdAt: Date; lastLoginAt: Date | null; adminNote: string | null;
  openaiKeyEnc: string | null; youtubeKeyEnc: string | null;
};

function toDto(u: Row) {
  return {
    id: u.id, email: u.email, name: u.name, role: u.role, plan: u.plan, disabled: u.disabled,
    createdAt: u.createdAt, lastLoginAt: u.lastLoginAt, adminNote: u.adminNote,
    hasOpenaiKey: !!u.openaiKeyEnc, hasYoutubeKey: !!u.youtubeKeyEnc,
  };
}

/** GET /api/admin/users — 회원 목록 + 통계 */
export async function GET() {
  const g = await requireAdmin();
  if (g.error) return g.error;

  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" }, select: USER_SELECT });
  const list = users.map(toDto);
  const stats = {
    total: list.length,
    vip: list.filter(u => u.plan === "VIP").length,
    admin: list.filter(u => u.role === "ADMIN").length,
    disabled: list.filter(u => u.disabled).length,
    withOpenaiKey: list.filter(u => u.hasOpenaiKey).length,
  };
  return NextResponse.json({ users: list, stats, meId: g.user.id });
}

/** 마지막 활성 관리자 보호 */
async function wouldRemoveLastAdmin(target: Row, next: { role?: UserRole; disabled?: boolean }): Promise<boolean> {
  if (target.role !== "ADMIN" || target.disabled) return false;
  const losesAdmin = next.role === "USER" || next.disabled === true;
  if (!losesAdmin) return false;
  const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", disabled: false } });
  return activeAdmins <= 1;
}

/** PATCH /api/admin/users — { id, role?, plan?, disabled?, adminNote? } */
export async function PATCH(req: NextRequest) {
  const g = await requireAdmin();
  if (g.error) return g.error;

  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
  if (!target) return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });

  const data: { role?: UserRole; plan?: UserPlan; disabled?: boolean; adminNote?: string | null } = {};
  if (body.role !== undefined) {
    if (!ROLES.includes(body.role)) return NextResponse.json({ error: "role 은 USER | ADMIN 이어야 합니다." }, { status: 400 });
    data.role = body.role;
  }
  if (body.plan !== undefined) {
    if (!PLANS.includes(body.plan)) return NextResponse.json({ error: "plan 은 FREE | VIP 이어야 합니다." }, { status: 400 });
    data.plan = body.plan;
  }
  if (body.disabled !== undefined) data.disabled = !!body.disabled;
  if (body.adminNote !== undefined) {
    const note = String(body.adminNote ?? "").trim().slice(0, 500);
    data.adminNote = note || null;
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ user: toDto(target) });

  if (id === g.user.id && (data.role === "USER" || data.disabled === true)) {
    return NextResponse.json({ error: "자기 자신의 관리자 권한을 해제하거나 비활성화할 수 없습니다." }, { status: 400 });
  }
  if (await wouldRemoveLastAdmin(target, data)) {
    return NextResponse.json({ error: "마지막 활성 관리자는 강등하거나 비활성화할 수 없습니다." }, { status: 400 });
  }

  const updated = await prisma.user.update({ where: { id }, data, select: USER_SELECT });
  return NextResponse.json({ user: toDto(updated) });
}

/** DELETE /api/admin/users — { id } */
export async function DELETE(req: NextRequest) {
  const g = await requireAdmin();
  if (g.error) return g.error;

  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  if (id === g.user.id) return NextResponse.json({ error: "자기 자신은 삭제할 수 없습니다." }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
  if (!target) return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
  if (await wouldRemoveLastAdmin(target, { role: "USER" })) {
    return NextResponse.json({ error: "마지막 활성 관리자는 삭제할 수 없습니다." }, { status: 400 });
  }

  // Account / Session / WorkspaceMember 는 onDelete: Cascade
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
