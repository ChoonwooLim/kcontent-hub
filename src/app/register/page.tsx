"use client";
import { useState } from "react";
import Link from "next/link";
import { Film, ArrowLeft, UserPlus } from "lucide-react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      setLoading(false);
      return;
    }

    if (password.length < 4) {
      setError("비밀번호는 4자 이상이어야 합니다.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "회원가입에 실패했습니다.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-void)", padding: 20 }}>
        <div style={{ position: "fixed", top: "20%", left: "50%", transform: "translateX(-50%)", width: 600, height: 300, background: "radial-gradient(ellipse, rgba(16,185,129,0.08), transparent 70%)", pointerEvents: "none" }} />
        <div className="card" style={{ width: "100%", maxWidth: 400, padding: 32, textAlign: "center", position: "relative", zIndex: 10 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(16,185,129,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <UserPlus size={28} color="#10b981" />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
            🎉 가입 완료!
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24 }}>
            회원가입이 완료되었습니다.<br />로그인하여 스튜디오를 시작하세요.
          </p>
          <Link href="/login" style={{ textDecoration: "none" }}>
            <button className="btn btn-brand btn-lg" style={{ width: "100%", justifyContent: "center" }}>
              로그인하러 가기
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-void)", padding: 20 }}>
      {/* Ambient glow */}
      <div style={{ position: "fixed", top: "20%", left: "50%", transform: "translateX(-50%)", width: 600, height: 300, background: "radial-gradient(ellipse, rgba(99,102,241,0.08), transparent 70%)", pointerEvents: "none" }} />

      <div className="card" style={{ width: "100%", maxWidth: 420, padding: 32, position: "relative", zIndex: 10 }}>
        {/* Back link */}
        <Link href="/" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
          <ArrowLeft size={14} /> 홈으로
        </Link>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 32 }}>
          <div style={{ background: "var(--gradient-brand)", width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 20px var(--brand-glow)" }}>
            <Film size={20} color="white" />
          </div>
          <div style={{ fontFamily: "Outfit", fontWeight: 800, fontSize: 20, color: "var(--text-primary)" }}>
            KContent Studio
          </div>
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 700, textAlign: "center", color: "var(--text-primary)", marginBottom: 8 }}>
          회원가입
        </h2>
        <p style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 13, marginBottom: 32 }}>
          계정을 만들어 스튜디오를 시작하세요.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {error && (
            <div style={{ padding: 12, background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: 6, color: "#ef4444", fontSize: 13, textAlign: "center" }}>
              {error}
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>이름 (선택)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="nav-item"
              style={{ width: "100%", padding: "12px", border: "1px solid var(--border-subtle)", borderRadius: 8, background: "var(--bg-elevated)", color: "white" }}
              placeholder="홍길동"
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>이메일 *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="nav-item"
              style={{ width: "100%", padding: "12px", border: "1px solid var(--border-subtle)", borderRadius: 8, background: "var(--bg-elevated)", color: "white" }}
              placeholder="name@company.com"
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>비밀번호 *</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="nav-item"
              style={{ width: "100%", padding: "12px", border: "1px solid var(--border-subtle)", borderRadius: 8, background: "var(--bg-elevated)", color: "white" }}
              placeholder="••••••••"
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>비밀번호 확인 *</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="nav-item"
              style={{ width: "100%", padding: "12px", border: "1px solid var(--border-subtle)", borderRadius: 8, background: "var(--bg-elevated)", color: "white" }}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className="btn btn-brand btn-lg" disabled={loading} style={{ marginTop: 8, width: "100%", justifyContent: "center" }}>
            {loading ? "가입 진행 중..." : "회원가입"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "var(--text-muted)" }}>
          이미 계정이 있으신가요?{" "}
          <Link href="/login" style={{ color: "var(--brand)", fontWeight: 600, textDecoration: "none" }}>
            로그인
          </Link>
        </div>
      </div>
    </div>
  );
}
