"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Users, Crown, ShieldCheck, Ban, Trash2, Search, RefreshCw, KeyRound, Loader, AlertCircle, Check
} from "lucide-react";
import { useMe } from "@/lib/hooks/use-me";

type Role = "USER" | "ADMIN";
type Plan = "FREE" | "VIP";

type AdminUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: Role;
  plan: Plan;
  disabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  adminNote: string | null;
  hasOpenaiKey: boolean;
  hasYoutubeKey: boolean;
};

type Stats = { total: number; vip: number; admin: number; disabled: number; withOpenaiKey: number };

const PLAN_LABEL: Record<Plan, string> = { FREE: "일반", VIP: "VIP" };
const ROLE_LABEL: Record<Role, string> = { USER: "회원", ADMIN: "관리자" };

function fmtDate(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("ko-KR", { year: "2-digit", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminPage() {
  const { me, loading: meLoading } = useMe();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [meId, setMeId] = useState<string>("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || `오류 (${res.status})`); return; }
      setUsers(data.users);
      setStats(data.stats);
      setMeId(data.meId);
      const n: Record<string, string> = {};
      for (const u of data.users as AdminUser[]) n[u.id] = u.adminNote ?? "";
      setNotes(n);
      setError(null);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(null), 2500); };

  const patch = async (id: string, data: Partial<Pick<AdminUser, "role" | "plan" | "disabled" | "adminNote">>, label: string) => {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...data }),
      });
      const resp = await res.json().catch(() => ({}));
      if (!res.ok) { setError(resp.error || `변경 실패 (${res.status})`); return; }
      setUsers(prev => prev.map(u => (u.id === id ? resp.user : u)));
      flash(`✓ ${label}`);
      // 통계 갱신
      setUsers(prev => {
        setStats({
          total: prev.length,
          vip: prev.filter(u => u.plan === "VIP").length,
          admin: prev.filter(u => u.role === "ADMIN").length,
          disabled: prev.filter(u => u.disabled).length,
          withOpenaiKey: prev.filter(u => u.hasOpenaiKey).length,
        });
        return prev;
      });
    } catch (e) { setError(String(e)); }
    finally { setBusy(null); }
  };

  const remove = async (u: AdminUser) => {
    if (!confirm(`${u.email} 계정을 삭제할까요?\n저장된 세션·멤버십 정보가 함께 삭제되며 되돌릴 수 없습니다.`)) return;
    setBusy(u.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id }),
      });
      const resp = await res.json().catch(() => ({}));
      if (!res.ok) { setError(resp.error || `삭제 실패 (${res.status})`); return; }
      flash(`✓ ${u.email} 삭제됨`);
      load();
    } catch (e) { setError(String(e)); }
    finally { setBusy(null); }
  };

  if (!meLoading && me && me.user.role !== "ADMIN") {
    return (
      <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
        <ShieldCheck size={32} style={{ margin: "0 auto 10px", display: "block", opacity: 0.4 }} />
        관리자만 접근할 수 있는 화면입니다.
      </div>
    );
  }

  const filtered = users.filter(u => {
    if (!q.trim()) return true;
    const hay = `${u.email ?? ""} ${u.name ?? ""} ${u.adminNote ?? ""}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  const statCards = stats ? [
    { label: "총 회원", val: stats.total, icon: <Users size={16} />, color: "#818cf8" },
    { label: "VIP", val: stats.vip, icon: <Crown size={16} />, color: "#fbbf24" },
    { label: "관리자", val: stats.admin, icon: <ShieldCheck size={16} />, color: "#34d399" },
    { label: "본인 키 등록", val: stats.withOpenaiKey, icon: <KeyRound size={16} />, color: "#22d3ee" },
    { label: "비활성", val: stats.disabled, icon: <Ban size={16} />, color: "#f87171" },
  ] : [];

  const selectStyle: React.CSSProperties = { fontSize: 12, padding: "5px 8px", borderRadius: 6, minWidth: 84 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>회원 관리</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            가입자 목록 · 등급(일반/VIP) · 역할(회원/관리자) 조정 · 계정 비활성화
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading} style={{ gap: 6 }}>
          <RefreshCw size={13} style={loading ? { animation: "spin 1s linear infinite" } : undefined} /> 새로고침
        </button>
      </div>

      {/* 통계 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        {statCards.map(s => (
          <div key={s.label} className="card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: s.color + "18", border: `1px solid ${s.color}30`, color: s.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "Outfit", lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 등급 정책 안내 */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>등급별 권한</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, fontSize: 12, lineHeight: 1.6 }}>
          <div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
            <span className="badge badge-gray" style={{ fontSize: 10, marginRight: 6 }}>일반</span>
            본인 OpenAI 키·YouTube 키를 등록해야 기능 화면이 열립니다. 번역·Whisper 비용은 본인 키로 과금됩니다.
          </div>
          <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.25)" }}>
            <span className="badge badge-amber" style={{ fontSize: 10, marginRight: 6 }}>VIP</span>
            번역은 twinverse-ai <strong>OpenClaw</strong>, Whisper·YouTube 는 서버 공용 키를 사용합니다. 키 등록은 선택입니다.
          </div>
          <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.25)" }}>
            <span className="badge badge-green" style={{ fontSize: 10, marginRight: 6 }}>관리자</span>
            VIP 권한 + 이 화면에서 회원 등급·역할 조정, 계정 비활성화·삭제.
          </div>
        </div>
      </div>

      {(error || notice) && (
        <div style={{
          fontSize: 12, padding: "8px 12px", borderRadius: 6, display: "flex", alignItems: "center", gap: 6,
          color: error ? "#f87171" : "#34d399",
          background: error ? "rgba(239,68,68,0.06)" : "rgba(52,211,153,0.06)",
          border: `1px solid ${error ? "rgba(239,68,68,0.2)" : "rgba(52,211,153,0.2)"}`,
        }}>
          {error ? <AlertCircle size={13} /> : <Check size={13} />}
          {error || notice}
        </div>
      )}

      {/* 검색 + 테이블 */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 10 }}>
          <div className="input-group" style={{ flex: 1, maxWidth: 360 }}>
            <Search size={14} className="input-icon" />
            <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="이메일 · 이름 · 메모 검색" style={{ fontSize: 13, padding: "8px 12px 8px 36px" }} />
          </div>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{filtered.length}명 표시</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ fontSize: 12, minWidth: 980 }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
                {["회원", "가입", "최근 로그인", "등급", "역할", "API 키", "상태", "메모", ""].map(h => (
                  <th key={h} style={{ padding: "10px 12px", fontWeight: 600, fontSize: 11, borderBottom: "1px solid var(--border-subtle)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}><Loader size={16} style={{ animation: "spin 1s linear infinite" }} /></td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>표시할 회원이 없습니다.</td></tr>
              )}
              {filtered.map(u => {
                const self = u.id === meId;
                const rowBusy = busy === u.id;
                return (
                  <tr key={u.id} style={{ borderBottom: "1px solid rgba(30,30,46,0.6)", opacity: u.disabled ? 0.55 : 1 }}>
                    <td style={{ padding: "10px 12px", minWidth: 200 }}>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                        {u.name || u.email?.split("@")[0]}
                        {self && <span className="badge badge-brand" style={{ fontSize: 9 }}>나</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>{u.email}</div>
                    </td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "var(--text-secondary)" }}>{fmtDate(u.createdAt)}</td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "var(--text-secondary)" }}>{fmtDate(u.lastLoginAt)}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <select
                        className="input" style={{ ...selectStyle, color: u.plan === "VIP" ? "#fbbf24" : undefined }}
                        value={u.plan} disabled={rowBusy}
                        onChange={e => patch(u.id, { plan: e.target.value as Plan }, `${u.email} → ${PLAN_LABEL[e.target.value as Plan]} 등급`)}
                      >
                        <option value="FREE">일반</option>
                        <option value="VIP">VIP</option>
                      </select>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <select
                        className="input" style={{ ...selectStyle, color: u.role === "ADMIN" ? "#34d399" : undefined }}
                        value={u.role} disabled={rowBusy || self}
                        title={self ? "자기 자신의 역할은 변경할 수 없습니다" : undefined}
                        onChange={e => patch(u.id, { role: e.target.value as Role }, `${u.email} → ${ROLE_LABEL[e.target.value as Role]}`)}
                      >
                        <option value="USER">회원</option>
                        <option value="ADMIN">관리자</option>
                      </select>
                    </td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                      <span className={`badge ${u.hasOpenaiKey ? "badge-green" : "badge-gray"}`} style={{ fontSize: 10, marginRight: 4 }}>OpenAI {u.hasOpenaiKey ? "✓" : "–"}</span>
                      <span className={`badge ${u.hasYoutubeKey ? "badge-green" : "badge-gray"}`} style={{ fontSize: 10 }}>YT {u.hasYoutubeKey ? "✓" : "–"}</span>
                    </td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={rowBusy || self}
                        title={self ? "자기 자신은 비활성화할 수 없습니다" : (u.disabled ? "계정 활성화" : "계정 비활성화 (로그인 차단)")}
                        onClick={() => patch(u.id, { disabled: !u.disabled }, `${u.email} ${u.disabled ? "활성화" : "비활성화"}`)}
                        style={{ gap: 5, fontSize: 11, color: u.disabled ? "#f87171" : "#34d399", borderColor: u.disabled ? "rgba(239,68,68,0.3)" : "rgba(52,211,153,0.3)" }}
                      >
                        {u.disabled ? <><Ban size={11} /> 비활성</> : <><Check size={11} /> 활성</>}
                      </button>
                    </td>
                    <td style={{ padding: "10px 12px", minWidth: 160 }}>
                      <input
                        className="input" style={{ fontSize: 11, padding: "5px 8px", borderRadius: 6 }}
                        value={notes[u.id] ?? ""} placeholder="메모"
                        disabled={rowBusy}
                        onChange={e => setNotes(n => ({ ...n, [u.id]: e.target.value }))}
                        onBlur={e => { if ((e.target.value || "") !== (u.adminNote || "")) patch(u.id, { adminNote: e.target.value }, "메모 저장"); }}
                      />
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      <button
                        className="btn-icon" disabled={rowBusy || self} onClick={() => remove(u)}
                        title={self ? "자기 자신은 삭제할 수 없습니다" : "계정 삭제"}
                        style={{ opacity: self ? 0.25 : 0.6 }}
                      >
                        {rowBusy ? <Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={13} color="#f87171" />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
