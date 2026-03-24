"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Film } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        redirect: true,
        email,
        password,
        callbackUrl: "/dashboard"
      });
      if (res?.error) {
        setError("이메일이나 비밀번호가 맞지 않습니다.");
      }
    } catch (err) {
      setError("오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-void)", padding: 20 }}>
      {/* Ambient glow */}
      <div style={{ position: "fixed", top: "20%", left: "50%", transform: "translateX(-50%)", width: 600, height: 300, background: "radial-gradient(ellipse, rgba(99,102,241,0.08), transparent 70%)", pointerEvents: "none" }} />

      <div className="card" style={{ width: "100%", maxWidth: 400, padding: 32, position: "relative", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 32 }}>
          <div style={{ background: "var(--gradient-brand)", width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 20px var(--brand-glow)" }}>
            <Film size={20} color="white" />
          </div>
          <div style={{ fontFamily: "Outfit", fontWeight: 800, fontSize: 20, color: "var(--text-primary)" }}>
            KContent Studio
          </div>
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 700, textAlign: "center", color: "var(--text-primary)", marginBottom: 8 }}>
          로그인
        </h2>
        <p style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 13, marginBottom: 32 }}>
          워크스페이스에 접근하려면 로그인하세요.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {error && (
            <div style={{ padding: 12, background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: 6, color: "#ef4444", fontSize: 13, textAlign: "center" }}>
              {error}
            </div>
          )}
          
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>이메일</label>
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
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>비밀번호</label>
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

          <button type="submit" className="btn btn-brand btn-lg" disabled={loading} style={{ marginTop: 8, width: "100%", justifyContent: "center" }}>
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
