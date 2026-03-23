"use client";
import { useState, useEffect } from "react";
import {
  Search, Filter, SlidersHorizontal, Play, Eye, ThumbsUp, Clock,
  TrendingUp, Download, RefreshCw, Star, ChevronDown, Zap, AlertTriangle
} from "lucide-react";

const NICHES = ["전체", "K-먹방", "K-바비큐", "K-교통", "K-문화", "K-의료", "K-뷰티", "K-라이프", "K-쇼핑", "K-관광"];
const REGIONS = ["전 세계", "미국", "유럽", "동남아", "호주/NZ", "중동"];

const MOCK_VIDEOS = [
  { id: "v1", title: "First time trying Korean convenience store food at 4AM", channel: "NightOwlSteve", subs: "2.1K", views: "3,420", likes: "287", duration: "14:23", niche: "K-먹방", grade: "S" as const, score: 97, hasCC: true, uploadedAt: "2일 전", thumbnail: "#7c3aed", reason: "새벽 편의점 = 국내 반응 폭발 예상 · 구독자 대비 조회수 비율 이상적" },
  { id: "v2", title: "Korean BBQ alone as a foreigner - awkward or amazing?", channel: "SoloTravelGirl", subs: "4.8K", views: "8,910", likes: "621", duration: "18:41", niche: "K-바비큐", grade: "S" as const, score: 93, hasCC: false, uploadedAt: "3일 전", thumbnail: "#b91c1c", reason: "혼자 고기집 = 한국인 공감 폭발 소재 · 스토리텔링 구조 탁월" },
  { id: "v3", title: "Seoul subway is INSANE (comparing to NYC and London)", channel: "MetroJunkie", subs: "12.3K", views: "5,200", likes: "418", duration: "10:55", niche: "K-교통", grade: "A" as const, score: 85, hasCC: true, uploadedAt: "1일 전", thumbnail: "#0369a1", reason: "지하철 비교 = 국뽕 자극 · 외국 대도시 대비 한국 지하철 우위 강조 가능" },
  { id: "v4", title: "I got sick in Korea - visiting a hospital as a tourist", channel: "NomadNick", subs: "3.2K", views: "2,100", likes: "193", duration: "12:07", niche: "K-의료", grade: "S" as const, score: 96, hasCC: false, uploadedAt: "당일", thumbnail: "#065f46", reason: "한국 의료 = 외국인 충격 단골 소재 · 의료비 저렴 + 의료 수준 높음 강조 가능" },
  { id: "v5", title: "Trying every Korean street food in Myeongdong (full day)", channel: "StreetFoodAdventurer", subs: "8.7K", views: "13,400", likes: "1,023", duration: "22:18", niche: "K-먹방", grade: "A" as const, score: 82, hasCC: true, uploadedAt: "4일 전", thumbnail: "#b45309", reason: "명동 먹거리 = 검증된 소재 · 다소 레드오션이나 신규 채널 초기 구독자 확보에 유리" },
  { id: "v6", title: "Korean jjimjilbang overnight experience (we almost cried)", channel: "SpaLoversUK", subs: "1.9K", views: "4,870", likes: "401", duration: "16:32", niche: "K-문화", grade: "S" as const, score: 91, hasCC: false, uploadedAt: "2일 전", thumbnail: "#6d28d9", reason: "찜질방 = 한국 고유 문화 · 외국인 감동/충격 반응 = K-문화 자부심 자극" },
];

type VideoItem = typeof MOCK_VIDEOS[0];

function ScoreMeter({ score, grade }: { score: number; grade: "S" | "A" | "B" }) {
  const color = grade === "S" ? "#f59e0b" : grade === "A" ? "#6366f1" : "#10b981";
  const r = 18; const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
      <svg width={56} height={56} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={28} cy={28} r={r} fill="none" stroke="var(--border-subtle)" strokeWidth={4} />
        <circle cx={28} cy={28} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 700 }}>{grade}등급</div>
      </div>
    </div>
  );
}

export default function HunterPage() {
  const [selectedNiche, setSelectedNiche] = useState("전체");
  const [scanning, setScanning] = useState(false);
  const [count, setCount] = useState(0);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const runScan = () => {
    setScanning(true);
    setVideos([]);
    setCount(0);
    let i = 0;
    const timer = setInterval(() => {
      i += Math.floor(Math.random() * 18 + 8);
      setCount(c => Math.min(c + Math.floor(Math.random() * 18 + 8), 487));
      if (i >= 487) {
        clearInterval(timer);
        setScanning(false);
        setVideos(MOCK_VIDEOS);
      }
    }, 80);
  };

  const filtered = selectedNiche === "전체" ? videos : videos.filter(v => v.niche === selectedNiche);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 1100 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>소재 수집기</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>구독자 적고 조회수 낮은 외국인 한국 방문 영상을 AI가 자동 발굴 · S/A/B 등급화</p>
      </div>

      {/* Config Panel */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>구독자 상한</label>
            <select className="input" style={{ cursor: "pointer" }}>
              {["5만 이하", "10만 이하", "20만 이하"].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>조회수 상한</label>
            <select className="input" style={{ cursor: "pointer" }}>
              {["2만 이하", "5만 이하", "10만 이하"].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>업로드 기간</label>
            <select className="input" style={{ cursor: "pointer" }}>
              {["최근 7일", "최근 14일", "최근 30일"].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <button className={`btn ${scanning ? "btn-ghost" : "btn-brand"}`} onClick={runScan} disabled={scanning}
            style={{ padding: "10px 24px", gap: 8, whiteSpace: "nowrap" }}>
            {scanning
              ? <><RefreshCw size={14} className="animate-spin" /> 수집 중 {count}개...</>
              : <><Zap size={14} /> AI 자동 수집 시작</>}
          </button>
        </div>

        {/* Scanning progress */}
        {scanning && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginBottom: 5 }}>
              <span>YouTube 크롤링 + AI 점수 산정 중...</span>
              <span>{count} / 487개</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${(count / 487) * 100}%`, background: "var(--gradient-brand)" }} />
            </div>
          </div>
        )}
      </div>

      {/* Niche Filter */}
      {videos.length > 0 && (
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
          <SlidersHorizontal size={14} color="var(--text-muted)" />
          {NICHES.map(n => (
            <button key={n} onClick={() => setSelectedNiche(n)}
              style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer", border: "1px solid",
                background: selectedNiche === n ? "var(--brand-dim)" : "transparent",
                borderColor: selectedNiche === n ? "rgba(99,102,241,0.3)" : "var(--border-default)",
                color: selectedNiche === n ? "#818cf8" : "var(--text-muted)", transition: "all 0.15s"
              }}>
              {n}
            </button>
          ))}
          <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 6 }}>
            {filtered.length}개 발굴됨 (S등급: {filtered.filter(v => v.grade === "S").length}개)
          </span>
        </div>
      )}

      {/* Results */}
      {filtered.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(v => (
            <div key={v.id} className="card" style={{ padding: 0, overflow: "hidden", cursor: "pointer", transition: "all 0.2s" }}
              onClick={() => setSelected(selected === v.id ? null : v.id)}>
              <div style={{ display: "flex", gap: 0 }}>
                {/* Thumbnail */}
                <div style={{ width: 120, flexShrink: 0, background: v.thumbnail, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  <div style={{ width: 36, height: 36, background: "rgba(0,0,0,0.4)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
                    <Play size={16} color="white" fill="white" />
                  </div>
                  {!v.hasCC && (
                    <div style={{ position: "absolute", bottom: 6, left: 6 }}>
                      <span className="badge badge-amber" style={{ fontSize: 9 }}>자막 없음</span>
                    </div>
                  )}
                </div>
                {/* Info */}
                <div style={{ flex: 1, padding: "14px 16px", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.45, flex: 1 }}>{v.title}</div>
                    <ScoreMeter score={v.score} grade={v.grade} />
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
                    {v.channel} · 구독자 {v.subs}
                  </div>
                  <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--text-muted)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Eye size={12} />{v.views}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><ThumbsUp size={12} />{v.likes}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={12} />{v.duration}</span>
                    <span>{v.uploadedAt}</span>
                    <span className="badge badge-gray" style={{ fontSize: 10 }}>{v.niche}</span>
                  </div>
                </div>
              </div>

              {/* Expanded: AI reason + actions */}
              {selected === v.id && (
                <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "14px 16px", background: "var(--bg-elevated)" }}>
                  <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
                    <Zap size={14} color="#818cf8" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 600, marginBottom: 3 }}>AI 선정 이유</div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{v.reason}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <a href={`/dashboard/script?url=https://youtube.com/watch?v=${v.id}`} style={{ textDecoration: "none" }}>
                      <button className="btn btn-brand btn-sm"><Zap size={12} />AI 대본 생성</button>
                    </a>
                    <button className="btn btn-ghost btn-sm"><Download size={12} />저장</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: "var(--text-muted)" }}>건너뛰기</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : !scanning && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
          <Search size={40} style={{ opacity: 0.2, margin: "0 auto 12px" }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>수집 대기 중</div>
          <div style={{ fontSize: 13 }}>위에서 조건 설정 후 "AI 자동 수집 시작" 을 클릭하세요</div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
