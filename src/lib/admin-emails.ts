/**
 * 부트스트랩 관리자 이메일 목록.
 * - env ADMIN_EMAILS="a@x.com,b@y.com" 로 재정의 가능 (없으면 기본 목록)
 * - 해당 이메일은 가입 시 또는 로그인 시 자동으로 ADMIN 역할 + VIP 등급으로 승격된다
 */
const DEFAULT_ADMINS = ["admin@orbitron.io", "choonwoo49@gmail.com"];

export function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS;
  if (!raw) return DEFAULT_ADMINS;
  const list = raw.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  return list.length ? list : DEFAULT_ADMINS;
}

export function isBootstrapAdmin(email: string | null | undefined): boolean {
  return !!email && adminEmails().includes(email.trim().toLowerCase());
}
