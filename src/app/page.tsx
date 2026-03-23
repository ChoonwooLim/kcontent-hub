"use client";
import Link from "next/link";
import { Youtube, Zap, ArrowRight, CheckCircle, TrendingUp, Cpu, Globe, Film } from "lucide-react";

const FEATURES = [
  { icon: Youtube, label: "소재 수집기", desc: "구독자·조회수 낮은 외국인 영상 400개씩 자동 스캔 · S등급 선별", color: "#ef4444" },
  { icon: Cpu, label: "AI 대본 엔진", desc: "GPT-4o Vision으로 K-문화 서사 한국어 대본 + 타임라인 자동 생성", color: "#6366f1" },
  { icon: Film, label: "편집 스튜디오", desc: "타임라인 자막 편집 · 썸네일 생성 · 브라우저 내 FFmpeg 자막 소각", color: "#10b981" },
  { icon: Globe, label: "멀티플랫폼 배포", desc: "YouTube · Shorts · TikTok · Reels 원클릭 동시 업로드 + 최적 스케줄", color: "#f59e0b" },
];

export default function HomePage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-void)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      {/* Ambient glow */}
      <div style={{ position: "fixed", top: "20%", left: "50%", transform: "translateX(-50%)", width: 600, height: 300, background: "radial-gradient(ellipse, rgba(99,102,241,0.08), transparent 70%)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 720, width: "100%", textAlign: "center", position: "relative" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 40 }}>
          <div style={{ background: "var(--gradient-brand)", width: 48, height: 48, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 30px var(--brand-glow)" }}>
            <Film size={24} color="white" />
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontFamily: "Outfit", fontWeight: 800, fontSize: 22, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              KContent Studio
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>K-컬처 영상 자동 제작 파이프라인</div>
          </div>
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 20, letterSpacing: "-0.03em" }}>
          <span className="gradient-text">외국인 영상</span>을<br />K-문화 콘텐츠로
          <br /><span style={{ color: "var(--text-primary)" }}>자동 변환</span>
        </h1>
        <p style={{ fontSize: 16, color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 520, margin: "0 auto 36px", letterSpacing: "0.01em" }}>
          한국을 방문한 외국인의 로우뷰 영상 발굴 →{" "}
          <strong style={{ color: "var(--text-primary)" }}>AI K-문화 서사 대본</strong> 자동 생성 → 자막 편집 →{" "}
          <strong style={{ color: "var(--text-primary)" }}>유튜브 / 틱톡 / 릴스</strong> 멀티 배포
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 56, flexWrap: "wrap" }}>
          <Link href="/dashboard" style={{ textDecoration: "none" }}>
            <button className="btn btn-brand btn-lg" style={{ fontSize: 16, padding: "14px 32px" }}>
              <Zap size={18} /> 스튜디오 시작하기
            </button>
          </Link>
          <Link href="/dashboard/hunter" style={{ textDecoration: "none" }}>
            <button className="btn btn-ghost btn-lg" style={{ fontSize: 15, padding: "14px 24px" }}>
              <Youtube size={16} /> 소재 수집기 체험
              <ArrowRight size={15} />
            </button>
          </Link>
        </div>

        {/* Feature Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          {FEATURES.map(({ icon: Icon, label, desc, color }, i) => (
            <div key={i} className="card" style={{ padding: "20px 16px", textAlign: "left", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color, borderRadius: "12px 12px 0 0" }} />
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <Icon size={18} color={color} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 32, justifyContent: "center", marginTop: 40, flexWrap: "wrap" }}>
          {[
            { val: "10억+", label: "실증된 수익 모델" },
            { val: "30분", label: "영상 1편 제작 시간" },
            { val: "4개", label: "동시 배포 플랫폼" },
          ].map(({ val, label }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "Outfit", color: "var(--text-primary)" }}>{val}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
