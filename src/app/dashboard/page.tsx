"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp, Youtube, Subtitles, Calendar, DollarSign,
  Play, ArrowUp, ArrowRight, Zap, Search, BarChart2,
  CheckCircle, Clock, Globe, Star
} from "lucide-react";

const STAT_DATA = [
  { label: "이번 달 수익", value: "₩2,340,000", change: "+23%", up: true, color: "green", icon: DollarSign },
  { label: "분석한 영상", value: "1,284", change: "+156", up: true, color: "blue", icon: Youtube },
  { label: "생성된 자막", value: "847", change: "+89", up: true, color: "orange", icon: Subtitles },
  { label: "예약 업로드", value: "32", change: "이번 주 8개", up: true, color: "red", icon: Calendar },
];

const RECENT_ACTIVITY = [
  { type: "subtitle", title: "미국 역사 채널 영상 - 자막 생성 완료", time: "2분 전", status: "done", icon: CheckCircle },
  { type: "upload", title: "'일상 영어' 영상 - 업로드 예약 완료", time: "15분 전", status: "done", icon: Calendar },
  { type: "lead", title: "새 리드 7명 수집 - 무료 특강 신청", time: "1시간 전", status: "done", icon: Zap },
  { type: "search", title: "트렌드 영상 47개 발굴 - 검토 대기", time: "3시간 전", status: "pending", icon: Search },
];

const TRENDING_VIDEOS = [
  { title: "10 Secrets to Learn English Fast", views: "2.3M", subs: "1.2M", category: "교육", difficulty: "쉬움" },
  { title: "Day in my Life NYC Vlog 2025", views: "890K", subs: "450K", category: "브이로그", difficulty: "쉬움" },
  { title: "Gordon Ramsay's Best Recipes", views: "5.1M", subs: "2.8M", category: "요리", difficulty: "보통" },
  { title: "Crazy Science Experiments Vol.3", views: "3.7M", subs: "1.9M", category: "과학", difficulty: "쉬움" },
];

function StatCard({ label, value, change, up, color, icon: Icon }: typeof STAT_DATA[0]) {
  const colorMap: Record<string, string> = {
    green: "#22c55e", blue: "#3b82f6", orange: "#f97316", red: "#ef4444"
  };
  const clr = colorMap[color];

  return (
    <div className={`stat-card stat-card-${color}`} style={{ flex: "1 1 200px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 13, color: "#71717a", marginBottom: 8 }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "Outfit", color: "white" }}>{value}</div>
        </div>
        <div style={{ background: `${clr}20`, padding: 10, borderRadius: 10 }}>
          <Icon size={22} color={clr} />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 12, fontSize: 13 }}>
        {up && <ArrowUp size={14} color="#22c55e" />}
        <span style={{ color: up ? "#4ade80" : "#f87171" }}>{change}</span>
        <span style={{ color: "#52525b" }}>지난 달 대비</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [revenue, setRevenue] = useState(2340000);

  useEffect(() => {
    const t = setInterval(() => {
      setRevenue(r => r + Math.floor(Math.random() * 500 + 100));
    }, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>안녕하세요 👋</h1>
          <p style={{ color: "#71717a", fontSize: 15 }}>오늘도 자동으로 수익이 올라가고 있습니다</p>
        </div>
        <Link href="/dashboard/finder">
          <button className="btn-primary" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Search size={18} /> 새 영상 발굴하기
          </button>
        </Link>
      </div>

      {/* Live Revenue */}
      <div style={{
        background: "linear-gradient(135deg, rgba(239,68,68,0.08), rgba(249,115,22,0.05))",
        border: "1px solid rgba(239,68,68,0.2)", borderRadius: 16, padding: "24px 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16
      }}>
        <div>
          <div style={{ fontSize: 13, color: "#71717a", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, background: "#22c55e", borderRadius: "50%", animation: "pulse-glow 1s infinite" }} />
            실시간 누적 수익
          </div>
          <div style={{ fontFamily: "Outfit", fontSize: 48, fontWeight: 900 }}>
            <span className="gradient-text">₩{revenue.toLocaleString()}</span>
          </div>
          <div style={{ fontSize: 13, color: "#71717a", marginTop: 6 }}>
            AdSense + 강의 판매 합산 · 자동 집계
          </div>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          {[
            { label: "AdSense", val: "₩890,000", color: "#f97316" },
            { label: "강의 판매", val: "₩1,450,000", color: "#22c55e" },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#71717a", marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "Outfit" }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {STAT_DATA.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Two Column */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Recent Activity */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>최근 활동</h2>
            <span className="badge badge-green">실시간</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {RECENT_ACTIVITY.map(({ type, title, time, status, icon: Icon }, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: "12px", borderRadius: 10, background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(63,63,70,0.3)"
              }}>
                <div style={{
                  background: status === "done" ? "rgba(34,197,94,0.1)" : "rgba(234,179,8,0.1)",
                  padding: 8, borderRadius: 8, flexShrink: 0
                }}>
                  <Icon size={16} color={status === "done" ? "#4ade80" : "#facc15"} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "white", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {title}
                  </div>
                  <div style={{ fontSize: 12, color: "#52525b" }}>{time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trending Videos */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>발굴 추천 영상</h2>
            <Link href="/dashboard/finder" style={{ color: "#f87171", fontSize: 13, display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
              더보기 <ArrowRight size={14} />
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {TRENDING_VIDEOS.map(({ title, views, subs, category, difficulty }, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px", borderRadius: 10, background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(63,63,70,0.3)", cursor: "pointer",
                transition: "all 0.2s"
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 8,
                  background: `hsl(${i * 70 + 15}, 70%, 40%)`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                }}>
                  <Play size={16} color="white" fill="white" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {title}
                  </div>
                  <div style={{ fontSize: 12, color: "#52525b", marginTop: 2 }}>
                    조회수 {views} · 구독자 {subs}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
                  <span className="badge badge-blue" style={{ fontSize: 11, padding: "2px 8px" }}>{category}</span>
                  <span className="badge badge-green" style={{ fontSize: 11, padding: "2px 8px" }}>{difficulty}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        {[
          { href: "/dashboard/finder", icon: Search, label: "콘텐츠 파인더", desc: "해외 인기 영상 검색", color: "#3b82f6" },
          { href: "/dashboard/studio", icon: Subtitles, label: "자막 스튜디오", desc: "URL 입력 → 자막 자동 생성", color: "#f97316" },
          { href: "/dashboard/scheduler", icon: Calendar, label: "업로드 스케줄러", desc: "자동 업로드 예약 관리", color: "#a855f7" },
          { href: "/dashboard/earnings", icon: BarChart2, label: "수익 트래커", desc: "채널별 수익 분석", color: "#22c55e" },
        ].map(({ href, icon: Icon, label, desc, color }) => (
          <Link key={href} href={href} style={{ textDecoration: "none" }}>
            <div className="card" style={{ padding: 20, cursor: "pointer", transition: "all 0.2s" }}>
              <div style={{ background: `${color}20`, width: 44, height: 44, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <Icon size={22} color={color} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 13, color: "#71717a" }}>{desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
