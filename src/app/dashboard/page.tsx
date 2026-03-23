"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Search, Cpu, Film, Globe, ArrowRight, TrendingUp,
  Clock, CheckCircle, AlertCircle, Loader, MoreHorizontal,
  Youtube, Play, Star
} from "lucide-react";

type Stage = "발굴 대기" | "AI 대본 생성" | "편집 중" | "업로드 대기" | "배포 완료";

type VideoItem = {
  id: string;
  title: string;
  channel: string;
  views: string;
  grade: "S" | "A" | "B";
  stage: Stage;
  niche: string;
  color: string;
  score: number;
  addedAt: string;
};

const INIT_ITEMS: VideoItem[] = [
  { id: "1", title: "한국 편의점 처음 가본 미국인 반응 브이로그", channel: "Jake in Seoul", views: "3.2K", grade: "S", stage: "편집 중", niche: "K-먹방", color: "#ef4444", score: 94, addedAt: "방금 전" },
  { id: "2", title: "Korean BBQ is LIFE changing - first time experience", channel: "TravelGirlMia", views: "8.1K", grade: "S", stage: "AI 대본 생성", niche: "K-바비큐", color: "#6366f1", score: 91, addedAt: "10분 전" },
  { id: "3", title: "Seoul subway system shocked me (SO CLEAN)", channel: "EuroTraveler", views: "5.4K", grade: "A", stage: "발굴 대기", niche: "K-교통", color: "#10b981", score: 82, addedAt: "23분 전" },
  { id: "4", title: "Trying all Korean street food in Myeongdong!", channel: "FoodieAlex", views: "12.7K", grade: "A", stage: "발굴 대기", niche: "K-먹방", color: "#f59e0b", score: 78, addedAt: "1시간 전" },
  { id: "5", title: "Korean hospital visit experience as a foreigner", channel: "NomadNick", views: "2.1K", grade: "S", stage: "업로드 대기", niche: "K-의료", color: "#a855f7", score: 96, addedAt: "2시간 전" },
  { id: "6", title: "I moved to Korea for 30 days - honest review", channel: "LifeInAsia", views: "18.3K", grade: "B", stage: "배포 완료", niche: "K-라이프", color: "#06b6d4", score: 71, addedAt: "어제" },
  { id: "7", title: "Jjimjilbang overnight stay - Korean spa 찜질방", channel: "WanderWendy", views: "4.9K", grade: "A", stage: "AI 대본 생성", niche: "K-문화", color: "#ec4899", score: 85, addedAt: "3시간 전" },
  { id: "8", title: "Korean drinking culture surprised me (Hof bar)", channel: "BerlinKorean", views: "6.6K", grade: "S", stage: "배포 완료", niche: "K-바", color: "#f97316", score: 89, addedAt: "어제" },
];

const STAGES: Stage[] = ["발굴 대기", "AI 대본 생성", "편집 중", "업로드 대기", "배포 완료"];

const STAGE_META: Record<Stage, { color: string; icon: React.ReactNode; badge: string }> = {
  "발굴 대기": { color: "#52525b", icon: <Search size={13} />, badge: "badge-gray" },
  "AI 대본 생성": { color: "#6366f1", icon: <Cpu size={13} />, badge: "badge-brand" },
  "편집 중": { color: "#10b981", icon: <Film size={13} />, badge: "badge-green" },
  "업로드 대기": { color: "#f59e0b", icon: <Clock size={13} />, badge: "badge-amber" },
  "배포 완료": { color: "#22c55e", icon: <CheckCircle size={13} />, badge: "badge-green" },
};

function GradeTag({ grade }: { grade: "S" | "A" | "B" }) {
  return <div className={`grade grade-${grade.toLowerCase()}`}>{grade}</div>;
}

function KanbanCard({ item }: { item: VideoItem }) {
  const meta = STAGE_META[item.stage];
  return (
    <div className="kanban-card">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.45, flex: 1 }}>
          {item.title}
        </div>
        <GradeTag grade={item.grade} />
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 10 }}>
        {item.channel} · {item.views} 조회
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className={`badge ${meta.badge}`} style={{ fontSize: 10.5 }}>
          {item.niche}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.addedAt}</span>
      </div>
      {item.stage === "AI 대본 생성" && (
        <div style={{ marginTop: 8 }}>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: "65%", background: "var(--gradient-brand)" }} />
          </div>
          <div style={{ fontSize: 10, color: "#6366f1", marginTop: 3 }}>대본 생성 중 65%...</div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [items] = useState<VideoItem[]>(INIT_ITEMS);

  const grouped = STAGES.reduce((acc, stage) => {
    acc[stage] = items.filter(i => i.stage === stage);
    return acc;
  }, {} as Record<Stage, VideoItem[]>);

  const completedToday = items.filter(i => i.stage === "배포 완료").length;
  const sGrade = items.filter(i => i.grade === "S").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1400 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>제작 파이프라인</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>오늘 처리 <strong style={{ color: "var(--text-secondary)" }}>12개</strong> · S등급 소재 <strong style={{ color: "#fbbf24" }}>{sGrade}개</strong> 대기 중</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/dashboard/hunter"><button className="btn btn-ghost btn-sm"><Search size={13} />소재 발굴</button></Link>
          <Link href="/dashboard/hunter"><button className="btn btn-brand btn-sm"><TrendingUp size={13} />자동 수집 실행</button></Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        {[
          { label: "오늘 배포 완료", val: `${completedToday}개`, color: "#10b981", sub: "목표 5개" },
          { label: "AI 대본 생성 중", val: "2개", color: "#6366f1", sub: "평균 3분" },
          { label: "S등급 발굴", val: `${sGrade}개`, color: "#f59e0b", sub: "이번 주" },
          { label: "이번 달 총 AdSense", val: "₩2.34M", color: "#22c55e", sub: "+23% ↑" },
        ].map(({ label, val, color, sub }) => (
          <div key={label} className="stat-card">
            <div className="stat-card-accent" style={{ background: color }} />
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "Outfit", color }}>{val}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Kanban Board */}
      <div>
        <div className="section-header">
          <div>
            <div className="section-title">콘텐츠 제작 보드</div>
            <div className="section-sub">드래그로 단계 이동 · 클릭하면 상세 편집</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 12 }}>
          {STAGES.map(stage => {
            const meta = STAGE_META[stage];
            const stageItems = grouped[stage] || [];
            return (
              <div key={stage} className="kanban-col">
                {/* Column Header */}
                <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ color: meta.color }}>{meta.icon}</div>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-secondary)", flex: 1 }}>{stage}</span>
                  <span style={{ fontSize: 11, background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: 5, padding: "1px 7px", color: "var(--text-muted)", fontWeight: 700 }}>
                    {stageItems.length}
                  </span>
                </div>
                {/* Cards */}
                <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: 8, minHeight: 200 }}>
                  {stageItems.map(item => <KanbanCard key={item.id} item={item} />)}
                  {stage === "발굴 대기" && (
                    <Link href="/dashboard/hunter" style={{ textDecoration: "none" }}>
                      <button style={{
                        width: "100%", padding: "10px", background: "transparent", border: "1px dashed var(--border-default)",
                        borderRadius: 8, color: "var(--text-muted)", fontSize: 12, cursor: "pointer", transition: "all 0.2s"
                      }}>
                        + 새 소재 추가
                      </button>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Today's Completions */}
      <div className="card" style={{ padding: 20 }}>
        <div className="section-header" style={{ marginBottom: 14 }}>
          <div className="section-title" style={{ fontSize: 15 }}>오늘 배포 완료</div>
          <Link href="/dashboard/analytics"><button className="btn btn-ghost btn-sm">수익 분석 →</button></Link>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>영상 제목</th>
              <th>니치</th>
              <th>등급</th>
              <th>플랫폼</th>
              <th>예상 일일 수익</th>
            </tr>
          </thead>
          <tbody>
            {items.filter(i => i.stage === "배포 완료").map(item => (
              <tr key={item.id}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 36, height: 24, borderRadius: 4, background: item.color + "30", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Play size={10} color={item.color} fill={item.color} />
                    </div>
                    <span style={{ color: "var(--text-primary)", fontSize: 13 }}>{item.title}</span>
                  </div>
                </td>
                <td><span className="badge badge-gray" style={{ fontSize: 11 }}>{item.niche}</span></td>
                <td><GradeTag grade={item.grade} /></td>
                <td>
                  <div style={{ display: "flex", gap: 4 }}>
                    <span className="badge badge-red" style={{ fontSize: 10 }}>YT</span>
                    <span className="badge badge-cyan" style={{ fontSize: 10 }}>TT</span>
                  </div>
                </td>
                <td style={{ color: "#4ade80", fontWeight: 700 }}>₩{(item.score * 340).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
