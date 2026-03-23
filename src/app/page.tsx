"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Play, CheckCircle, ArrowRight, Zap, TrendingUp, Clock, Users,
  Star, ChevronRight, Youtube, Subtitles, DollarSign, Calendar,
  X, BarChart2, Globe
} from "lucide-react";

const SOCIAL_PROOF = [
  { name: "김**", location: "서울", earning: "월 342만원", channel: "영어 강의 번역채널" },
  { name: "이**", location: "부산", earning: "월 187만원", channel: "미국 여행 자막채널" },
  { name: "박**", location: "인천", earning: "월 521만원", channel: "해외 요리 번역채널" },
  { name: "최**", location: "대전", earning: "월 89만원", channel: "영어 뉴스 자막채널" },
];

const STATS = [
  { label: "누적 신청자", value: "6,847", suffix: "명", icon: Users },
  { label: "평균 월 수익", value: "247", suffix: "만원", icon: DollarSign },
  { label: "자동화 시간 절약", value: "94", suffix: "%", icon: Clock },
  { label: "채널 개설 소요시간", value: "30", suffix: "분", icon: Zap },
];

const STEPS = [
  { num: "01", title: "해외 인기 영상 발굴", desc: "AI가 자동으로 조회수 높은 외국 영상을 찾아드립니다", color: "#ef4444" },
  { num: "02", title: "한국어 자막 자동 생성", desc: "GPT 기반 번역으로 3분 안에 한국어 자막 생성", color: "#f97316" },
  { num: "03", title: "채널 업로드 예약", desc: "최적 업로드 시간대에 자동으로 예약 업로드", color: "#eab308" },
  { num: "04", title: "리드 수집 & 강의 판매", desc: "설명란 자동화로 무료 특강 신청자를 자동 수집", color: "#22c55e" },
];

function CountdownTimer() {
  const [time, setTime] = useState({ h: 11, m: 47, s: 23 });

  useEffect(() => {
    const t = setInterval(() => {
      setTime(prev => {
        let { h, m, s } = prev;
        if (s > 0) return { h, m, s: s - 1 };
        if (m > 0) return { h, m: m - 1, s: 59 };
        if (h > 0) return { h: h - 1, m: 59, s: 59 };
        return { h: 11, m: 59, s: 59 };
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      {[{ val: time.h, label: "시" }, { val: time.m, label: "분" }, { val: time.s, label: "초" }].map(({ val, label }, i) => (
        <div key={i} style={{ textAlign: "center" }}>
          <div style={{
            background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)",
            borderRadius: 10, padding: "10px 16px", minWidth: 60,
            fontSize: 28, fontWeight: 800, color: "#f87171", fontFamily: "Outfit, sans-serif",
            fontVariantNumeric: "tabular-nums"
          }}>
            {String(val).padStart(2, "0")}
          </div>
          <div style={{ fontSize: 11, color: "#71717a", marginTop: 4 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

function LeadForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", kakao: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); onSuccess(); }, 1500);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <input
        className="input-dark" placeholder="이름" required
        value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
        style={{ fontSize: 15 }}
      />
      <input
        className="input-dark" type="email" placeholder="이메일 주소" required
        value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
      />
      <input
        className="input-dark" placeholder="카카오톡 ID (선택)"
        value={form.kakao} onChange={e => setForm({ ...form, kakao: e.target.value })}
      />
      <button className="btn-primary" type="submit" disabled={loading}
        style={{ fontSize: 17, padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {loading ? (
          <><div style={{ width: 20, height: 20, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> 신청 중...</>
        ) : (
          <><Zap size={20} /> 무료 특강 신청하기</>
        )}
      </button>
      <p style={{ fontSize: 12, color: "#71717a", textAlign: "center" }}>
        🔒 개인정보는 안전하게 보호됩니다 · 스팸 없음 · 언제든 해지 가능
      </p>
    </form>
  );
}

function SuccessModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20
    }}>
      <div className="card" style={{ maxWidth: 440, width: "100%", padding: 40, textAlign: "center", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: "#71717a", cursor: "pointer" }}>
          <X size={20} />
        </button>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>신청 완료!</h2>
        <p style={{ color: "#a1a1aa", marginBottom: 24, lineHeight: 1.6 }}>
          카카오 단톡방 링크를 이메일로 보내드렸습니다.<br />
          <strong style={{ color: "#f87171" }}>4월 5일 저녁 7시</strong> 무료 특강을 기대해주세요!
        </p>
        <Link href="/dashboard">
          <button className="btn-primary" style={{ width: "100%", fontSize: 16 }}>
            지금 바로 대시보드 사용해보기 →
          </button>
        </Link>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [success, setSuccess] = useState(false);
  const [count, setCount] = useState(6847);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => {
      if (Math.random() > 0.7) setCount(c => c + 1);
    }, 8000);
    return () => clearInterval(t);
  }, []);

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: "smooth" });

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Urgency Banner */}
      <div style={{
        background: "linear-gradient(90deg, #dc2626, #ea580c)", padding: "10px 20px",
        textAlign: "center", fontSize: 14, fontWeight: 700, color: "white",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8
      }}>
        <span style={{ animation: "pulse-glow 1s infinite" }}>🔥</span>
        선착순 마감 임박! 단톡방 입장 인원 <strong style={{ textDecoration: "underline" }}>{count}명</strong> 중 잔여석 <strong>32석</strong>
        <span style={{ animation: "pulse-glow 1s infinite" }}>🔥</span>
      </div>

      {/* Nav */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 32px", borderBottom: "1px solid rgba(63,63,70,0.4)",
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(9,9,11,0.9)", backdropFilter: "blur(16px)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ background: "var(--gradient-red)", width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Youtube size={20} color="white" />
          </div>
          <span style={{ fontFamily: "Outfit", fontWeight: 800, fontSize: 20 }}>
            <span className="gradient-text">KContent</span>Hub
          </span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn-secondary" onClick={scrollToForm} style={{ padding: "8px 20px", fontSize: 14 }}>
            무료 신청
          </button>
          <Link href="/dashboard">
            <button className="btn-primary" style={{ padding: "8px 20px", fontSize: 14 }}>
              대시보드 →
            </button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: "80px 20px 60px", textAlign: "center", maxWidth: 900, margin: "0 auto" }}>
        <div className="badge badge-red" style={{ marginBottom: 24, display: "inline-flex" }}>
          <span style={{ width: 6, height: 6, background: "#f87171", borderRadius: "50%", animation: "pulse-glow 1s infinite" }} />
          🔴 LIVE · 지금 {count.toLocaleString()}명 신청 완료
        </div>
        <h1 style={{ fontSize: "clamp(36px, 6vw, 72px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 24 }}>
          회사도 안 가고<br />
          <span className="gradient-text">외국인 영상에 자막만 달아</span><br />
          유튜브로 <span style={{ color: "#22c55e" }}>10억</span> 번 방법
        </h1>
        <p style={{ fontSize: 20, color: "#a1a1aa", lineHeight: 1.7, marginBottom: 40, maxWidth: 600, margin: "0 auto 40px" }}>
          촬영 ❌ &nbsp; 편집 ❌ &nbsp; 얼굴공개 ❌ <br />
          AI 자동화로 <strong style={{ color: "white" }}>하루 30분</strong>만 투자해 월 수익 창출
        </p>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 48 }}>
          <button className="btn-primary" onClick={scrollToForm}
            style={{ fontSize: 18, padding: "18px 40px", display: "flex", alignItems: "center", gap: 8 }}>
            <Zap size={22} /> 무료 특강 신청하기
          </button>
          <Link href="/dashboard">
            <button className="btn-secondary" style={{ fontSize: 16, padding: "16px 32px", display: "flex", alignItems: "center", gap: 8 }}>
              <Play size={18} /> 플랫폼 체험하기
            </button>
          </Link>
        </div>

        {/* Timer */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 20, flexWrap: "wrap", justifyContent: "center",
          background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 16, padding: "20px 32px"
        }}>
          <div>
            <div style={{ fontSize: 13, color: "#71717a", marginBottom: 8 }}>무료 라이브 특강 마감까지</div>
            <CountdownTimer />
          </div>
          <div style={{ height: 60, width: 1, background: "rgba(239,68,68,0.2)" }} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontWeight: 700, color: "#f87171", fontSize: 15 }}>📅 4월 5일 (일) 저녁 7시</div>
            <div style={{ color: "#71717a", fontSize: 13, marginTop: 4 }}>단 1회 진행 · 다시보기 없음</div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section style={{ padding: "40px 20px", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
          {STATS.map(({ label, value, suffix, icon: Icon }) => (
            <div key={label} className="card" style={{ padding: "24px 20px", textAlign: "center" }}>
              <Icon size={28} color="#f87171" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 36, fontWeight: 900, fontFamily: "Outfit" }}>
                <span className="gradient-text">{value}</span>
                <span style={{ fontSize: 20, color: "#f87171" }}>{suffix}</span>
              </div>
              <div style={{ fontSize: 13, color: "#71717a", marginTop: 6 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section style={{ padding: "60px 20px", maxWidth: 900, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: 36, fontWeight: 800, marginBottom: 48 }}>
          전자동 4단계 수익 시스템
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
          {STEPS.map(({ num, title, desc, color }) => (
            <div key={num} className="card" style={{ padding: 28, position: "relative", overflow: "hidden" }}>
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 3,
                background: `linear-gradient(90deg, ${color}, transparent)`
              }} />
              <div style={{ fontSize: 48, fontWeight: 900, color: color, opacity: 0.3, fontFamily: "Outfit", lineHeight: 1, marginBottom: 12 }}>{num}</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{title}</h3>
              <p style={{ fontSize: 14, color: "#a1a1aa", lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Social Proof */}
      <section style={{ padding: "60px 20px", maxWidth: 900, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: 32, fontWeight: 800, marginBottom: 12 }}>이미 수익 중인 분들</h2>
        <p style={{ textAlign: "center", color: "#71717a", marginBottom: 40 }}>실제 KContent Hub 사용자 수익 현황</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          {SOCIAL_PROOF.map(({ name, location, earning, channel }, i) => (
            <div key={i} className="card" style={{ padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: `hsl(${i * 60 + 10}, 70%, 50%)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, fontWeight: 700, color: "white"
                }}>{name[0]}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{name}</div>
                  <div style={{ fontSize: 12, color: "#71717a" }}>{location}</div>
                </div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#22c55e", marginBottom: 4 }}>{earning}</div>
              <div style={{ fontSize: 13, color: "#71717a" }}>{channel}</div>
              <div style={{ display: "flex", gap: 2, marginTop: 12 }}>
                {[1,2,3,4,5].map(s => <Star key={s} size={14} color="#eab308" fill="#eab308" />)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* What You Get */}
      <section style={{ padding: "60px 20px", maxWidth: 900, margin: "0 auto" }}>
        <div style={{
          background: "linear-gradient(135deg, rgba(239,68,68,0.05), rgba(249,115,22,0.05))",
          border: "1px solid rgba(239,68,68,0.2)", borderRadius: 24, padding: "48px 40px"
        }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 32, textAlign: "center" }}>
            플랫폼이 자동으로 해주는 것들
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 600, margin: "0 auto" }}>
            {[
              "해외 인기 영상 자동 발굴",
              "한국어 자막 3분 자동 생성",
              "최적 업로드 시간 분석",
              "제목·설명·태그 AI 자동 작성",
              "리드 수집 랜딩페이지 자동화",
              "수익 리포트 자동 집계",
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <CheckCircle size={20} color="#22c55e" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 15 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lead Form */}
      <section ref={formRef} id="apply" style={{ padding: "60px 20px 100px", maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
        <div className="badge badge-red" style={{ display: "inline-flex", marginBottom: 20 }}>
          🔥 무료 특강 신청 · 선착순 마감
        </div>
        <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>지금 바로 신청하세요</h2>
        <p style={{ color: "#a1a1aa", marginBottom: 32, lineHeight: 1.6 }}>
          무료 자료 + 무료 라이브 특강 모두 무료로 드립니다<br />
          단, 카카오 단톡방 정원 초과 시 입장 불가
        </p>
        <div className="card" style={{ padding: 32 }}>
          <LeadForm onSuccess={() => setSuccess(true)} />
        </div>
      </section>

      {success && <SuccessModal onClose={() => setSuccess(false)} />}

      {/* Footer */}
      <footer style={{
        textAlign: "center", padding: "32px 20px", borderTop: "1px solid var(--border)",
        color: "#52525b", fontSize: 13
      }}>
        <p style={{ marginBottom: 8 }}>© 2025 KContent Hub · 주식회사 케이컨텐츠허브</p>
        <p>사업자번호 000-00-00000 · 대표: 홍길동 · 서울특별시 강남구</p>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 12 }}>
          {["이용약관", "개인정보처리방침", "환불규정"].map(t => (
            <a key={t} href="#" style={{ color: "#52525b", textDecoration: "none" }}>{t}</a>
          ))}
        </div>
      </footer>
    </div>
  );
}
