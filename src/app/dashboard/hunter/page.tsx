"use client";
import { useState } from "react";
import {
  Search, SlidersHorizontal, Play, Eye, ThumbsUp, Clock,
  Download, RefreshCw, Zap, X, ExternalLink, AlertCircle,
  Check, Copy, BookmarkCheck, Loader, Mail, MessageSquare
} from "lucide-react";

const NICHES = ["전체", "K-먹방", "K-바비큐", "K-교통", "K-문화", "K-의료", "K-뷰티", "K-라이프", "K-쇼핑", "K-관광"];
const LANGS = [
  { code: "all", label: "🌐 전체 언어" },
  { code: "en",  label: "🇺🇸 English" },
  { code: "ja",  label: "🇯🇵 日本語" },
  { code: "es",  label: "🇪🇸 Español" },
  { code: "fr",  label: "🇫🇷 Français" },
  { code: "de",  label: "🇩🇪 Deutsch" },
  { code: "th",  label: "🇹🇭 ไทย" },
  { code: "pt",  label: "🇧🇷 Português" },
  { code: "vi",  label: "🇻🇳 Tiếng Việt" },
  { code: "zh",  label: "🇨🇳 中文" },
  { code: "id",  label: "🇮🇩 Bahasa" },
];
const STORAGE_KEY = "kcontent_hunter_videos";

type VideoItem = {
  id: string; ytId: string; title: string; channel: string;
  subs: string; views: string; likes: string; duration: string;
  niche: string; grade: "S" | "A" | "B"; score: number;
  hasCC: boolean; lang?: string; uploadedAt: string;
  thumbnail: string; thumbnailFallback: string; reason: string;
};

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

function VideoModal({ video, onClose }: { video: VideoItem; onClose: () => void }) {
  const ytUrl = `https://www.youtube.com/watch?v=${video.ytId}`;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 860, background: "var(--bg-surface)",
        borderRadius: 16, overflow: "hidden",
        border: "1px solid var(--border-default)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
      }}>
        {/* 실제 YouTube iframe 임베드 (임베드 가능 영상만 수집됨) */}
        <div style={{ position: "relative", paddingTop: "56.25%", background: "#000" }}>
          <iframe
            src={`https://www.youtube.com/embed/${video.ytId}?autoplay=1&rel=0`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
          />
        </div>
        {/* 하단 정보 바 */}
        <div style={{ padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{video.title}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{video.channel} · 구독자 {video.subs} · {video.views} 조회 · {video.duration}</div>
          </div>
          <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
            <a href={ytUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <button className="btn btn-ghost btn-sm" style={{ gap: 6 }}><ExternalLink size={12} />YouTube</button>
            </a>
            <a href={`/dashboard/script?url=${encodeURIComponent(ytUrl)}`} style={{ textDecoration: "none" }}>
              <button className="btn btn-brand btn-sm" style={{ gap: 6 }}><Zap size={12} />AI 대본 생성</button>
            </a>
            <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: "6px 8px" }}><X size={14} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 원작자 알림 모달 ─────────────────────────────────── */
type OutreachData = {
  videoTitle: string;
  channel: string;
  lang: string;
  message: string;
  ytUrl: string;
};

function OutreachModal({ data, onClose }: { data: OutreachData; onClose: () => void }) {
  const [message, setMessage] = useState(data.message);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"comment" | "email">("comment");

  const copyMessage = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openYouTube = () => {
    window.open(data.ytUrl, "_blank");
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 640, background: "var(--bg-surface)",
        borderRadius: 16, overflow: "hidden",
        border: "1px solid var(--border-default)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
      }}>
        {/* 헤더 */}
        <div style={{
          padding: "18px 20px", borderBottom: "1px solid var(--border-subtle)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: "linear-gradient(135deg, #10b981, #34d399)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <BookmarkCheck size={16} color="white" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                  ✅ 파이프라인 저장 완료
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                  원작자에게 보낼 협업 요청 메시지가 생성되었습니다
                </div>
              </div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: "6px 8px" }}>
            <X size={14} />
          </button>
        </div>

        {/* 영상 정보 */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-elevated)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{data.videoTitle}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{data.channel} · 언어: {data.lang.toUpperCase()}</div>
        </div>

        {/* 탭 */}
        <div style={{ padding: "10px 20px 0", display: "flex", gap: 6 }}>
          {([
            { key: "comment" as const, icon: <MessageSquare size={12} />, label: "YouTube 댓글" },
            { key: "email" as const, icon: <Mail size={12} />, label: "이메일/DM" },
          ]).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "7px 14px", borderRadius: "8px 8px 0 0", fontSize: 12, fontWeight: 600,
                cursor: "pointer",
                background: activeTab === tab.key ? "var(--bg-elevated)" : "transparent",
                border: activeTab === tab.key ? "1px solid var(--border-default)" : "1px solid transparent",
                borderBottom: activeTab === tab.key ? "1px solid var(--bg-elevated)" : "none",
                color: activeTab === tab.key ? "var(--text-primary)" : "var(--text-muted)",
                transition: "all 0.15s",
              }}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* 메시지 편집 */}
        <div style={{ padding: "14px 20px" }}>
          <textarea value={message} onChange={e => setMessage(e.target.value)}
            style={{
              width: "100%", minHeight: 220, padding: 14, borderRadius: 10,
              background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
              color: "var(--text-primary)", fontSize: 13, lineHeight: 1.7,
              resize: "vertical", fontFamily: "inherit",
            }}
          />
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
            💡 메시지를 자유롭게 편집할 수 있습니다. {activeTab === "comment" ? "복사 후 YouTube 영상 댓글에 붙여넣기하세요." : "복사 후 이메일이나 SNS DM으로 전송하세요."}
          </div>
        </div>

        {/* 하단 액션 */}
        <div style={{
          padding: "14px 20px", borderTop: "1px solid var(--border-subtle)",
          display: "flex", gap: 8, justifyContent: "flex-end",
        }}>
          <button className="btn btn-ghost btn-sm" onClick={openYouTube} style={{ gap: 6 }}>
            <ExternalLink size={12} />YouTube 영상 열기
          </button>
          <button className="btn btn-brand btn-sm" onClick={copyMessage}
            style={{
              gap: 6, minWidth: 130,
              background: copied ? "#10b981" : undefined,
              transition: "all 0.2s",
            }}>
            {copied ? <><Check size={12} />복사 완료!</> : <><Copy size={12} />메시지 복사</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HunterPage() {
  const [selectedNiche, setSelectedNiche] = useState("전체");
  const [maxSubs, setMaxSubs] = useState("50000");
  const [maxViews, setMaxViews] = useState("20000");
  const [dayRange, setDayRange] = useState("7");
  const [searchLang, setSearchLang] = useState("all");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoItem[]>(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [playing, setPlaying] = useState<VideoItem | null>(null);

  // 저장 관련 상태
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [outreachModal, setOutreachModal] = useState<OutreachData | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 파이프라인 저장 핸들러
  const handleSave = async (v: VideoItem) => {
    setSavingId(v.id);
    setSaveError(null);
    try {
      const ytUrl = `https://www.youtube.com/watch?v=${v.ytId}`;
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: v.title,
          channel: v.channel,
          originalUrl: ytUrl,
          ytVideoId: v.ytId,
          views: v.views,
          likes: v.likes,
          duration: v.duration,
          subs: v.subs,
          lang: v.lang || "unknown",
          grade: v.grade,
          score: v.score,
          niche: v.niche,
          aiReason: v.reason,
          hasCC: v.hasCC,
          thumbnail: v.thumbnail,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSaveError(data.error || "저장에 실패했습니다.");
        return;
      }

      // 성공 — 저장 완료 상태 업데이트
      setSavedIds(prev => new Set(prev).add(v.id));

      // 원작자 알림 모달 표시
      if (data.outreach) {
        setOutreachModal({
          videoTitle: v.title,
          channel: v.channel,
          lang: data.outreach.lang || v.lang || "en",
          message: data.outreach.message,
          ytUrl,
        });
      }
    } catch (e) {
      setSaveError(`네트워크 오류: ${String(e)}`);
    } finally {
      setSavingId(null);
    }
  };

  const runScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch("/api/youtube/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxSubs: parseInt(maxSubs),
          maxViews: parseInt(maxViews),
          dayRange: parseInt(dayRange),
          niche: selectedNiche,
          lang: searchLang,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "검색에 실패했습니다.");
        return;
      }
      setVideos(data.videos ?? []);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.videos ?? []));
    } catch (e) {
      setError(`네트워크 오류: ${String(e)}`);
    } finally {
      setScanning(false);
    }
  };

  const filtered = selectedNiche === "전체" ? videos : videos.filter(v => v.niche === selectedNiche);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 1100 }}>
      {playing && <VideoModal video={playing} onClose={() => setPlaying(null)} />}
      {outreachModal && <OutreachModal data={outreachModal} onClose={() => setOutreachModal(null)} />}

      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>소재 수집기</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>전세계 외국인이 한국을 방문한 영상을 YouTube API로 실시간 발굴 · 한국어 영상 자동 제외 · S/A/B 등급화</p>
      </div>

      {/* Config Panel */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>구독자 상한</label>
            <select className="input" style={{ cursor: "pointer" }} value={maxSubs} onChange={e => setMaxSubs(e.target.value)}>
              <option value="5000">5천 이하</option>
              <option value="10000">1만 이하</option>
              <option value="50000">5만 이하</option>
              <option value="100000">10만 이하</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>조회수 상한</label>
            <select className="input" style={{ cursor: "pointer" }} value={maxViews} onChange={e => setMaxViews(e.target.value)}>
              <option value="5000">5천 이하</option>
              <option value="20000">2만 이하</option>
              <option value="50000">5만 이하</option>
              <option value="100000">10만 이하</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>업로드 기간</label>
            <select className="input" style={{ cursor: "pointer" }} value={dayRange} onChange={e => setDayRange(e.target.value)}>
              <option value="7">최근 7일</option>
              <option value="14">최근 14일</option>
              <option value="30">최근 30일</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>언어</label>
            <select className="input" style={{ cursor: "pointer" }} value={searchLang} onChange={e => setSearchLang(e.target.value)}>
              {LANGS.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
          <button className={`btn ${scanning ? "btn-ghost" : "btn-brand"}`} onClick={runScan} disabled={scanning}
            style={{ padding: "10px 24px", gap: 8, whiteSpace: "nowrap" }}>
            {scanning
              ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />수집 중...</>
              : <><Zap size={14} />AI 자동 수집 시작</>}
          </button>
        </div>

        {scanning && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
              YouTube Data API v3 검색 + 채널 구독자 수 조회 + AI 점수 산정 중...
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: "100%", background: "var(--gradient-brand)", animation: "indeterminate 1.5s ease-in-out infinite" }} />
            </div>
          </div>
        )}

        {/* 에러 */}
        {(error || saveError) && (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)", display: "flex", gap: 10, alignItems: "flex-start" }}>
            <AlertCircle size={15} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13, color: "#fca5a5" }}>{error || saveError}</div>
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
          <button onClick={() => { setVideos([]); localStorage.removeItem(STORAGE_KEY); }}
            style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
            초기화
          </button>
        </div>
      )}

      {/* Results */}
      {filtered.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(v => (
            <div key={v.id} className="card" style={{ padding: 0, overflow: "hidden", transition: "all 0.2s" }}>
              <div style={{ display: "flex" }} onClick={() => setSelected(selected === v.id ? null : v.id)}>
                {/* Thumbnail */}
                <div
                  style={{ width: 140, flexShrink: 0, position: "relative", cursor: "pointer", background: "#111", overflow: "hidden" }}
                  onClick={e => { e.stopPropagation(); setPlaying(v); }}>
                  {v.thumbnail ? (
                    <img src={v.thumbnail} alt={v.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: v.thumbnailFallback }} />
                  )}
                  {/* Play overlay */}
                  <div style={{
                    position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(0,0,0,0.3)",
                  }}>
                    <div style={{
                      width: 38, height: 38, background: "rgba(0,0,0,0.6)", borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      border: "2px solid rgba(255,255,255,0.3)", transition: "all 0.15s",
                    }}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.background = "rgba(255,0,0,0.7)"; el.style.transform = "scale(1.1)"; }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.background = "rgba(0,0,0,0.6)"; el.style.transform = "scale(1)"; }}>
                      <Play size={15} color="white" fill="white" />
                    </div>
                  </div>
                  {!v.hasCC && (
                    <div style={{ position: "absolute", bottom: 5, left: 5 }}>
                      <span className="badge badge-amber" style={{ fontSize: 9 }}>자막 없음</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, padding: "14px 16px", minWidth: 0, cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.45, flex: 1 }}>{v.title}</div>
                    <ScoreMeter score={v.score} grade={v.grade} />
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{v.channel} · 구독자 {v.subs}</div>
                  <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--text-muted)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Eye size={12} />{v.views}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><ThumbsUp size={12} />{v.likes}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={12} />{v.duration}</span>
                    <span>{v.uploadedAt}</span>
                    <span className="badge badge-gray" style={{ fontSize: 10 }}>{v.niche}</span>
                    {v.lang && v.lang !== "unknown" && (
                      <span className="badge badge-cyan" style={{ fontSize: 9 }}>{v.lang.toUpperCase()}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded */}
              {selected === v.id && (
                <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "14px 16px", background: "var(--bg-elevated)" }}>
                  <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
                    <Zap size={14} color="#818cf8" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 600, marginBottom: 3 }}>AI 점수 근거</div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{v.reason}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" style={{ gap: 6 }} onClick={() => setPlaying(v)}>
                      <Play size={12} fill="currentColor" />영상 미리보기
                    </button>
                    <a href={`/dashboard/script?url=${encodeURIComponent(`https://youtube.com/watch?v=${v.ytId}`)}`} style={{ textDecoration: "none" }}>
                      <button className="btn btn-brand btn-sm"><Zap size={12} />AI 대본 생성</button>
                    </a>
                    <button
                      className={`btn ${savedIds.has(v.id) ? 'btn-brand' : 'btn-ghost'} btn-sm`}
                      style={{
                        gap: 6,
                        background: savedIds.has(v.id) ? '#10b981' : undefined,
                        borderColor: savedIds.has(v.id) ? '#10b981' : undefined,
                        color: savedIds.has(v.id) ? 'white' : undefined,
                        transition: 'all 0.2s',
                      }}
                      disabled={savingId === v.id}
                      onClick={(e) => { e.stopPropagation(); handleSave(v); }}
                    >
                      {savingId === v.id ? (
                        <><Loader size={12} style={{ animation: 'spin 0.9s linear infinite' }} />저장 중...</>
                      ) : savedIds.has(v.id) ? (
                        <><BookmarkCheck size={12} />저장됨</>
                      ) : (
                        <><Download size={12} />저장</>
                      )}
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ color: "var(--text-muted)" }} onClick={() => setSelected(null)}>건너뛰기</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : !scanning && !error && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
          <Search size={40} style={{ opacity: 0.2, margin: "0 auto 12px" }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>수집 대기 중</div>
          <div style={{ fontSize: 13 }}>설정 페이지에서 YouTube API 키를 등록한 후 수집을 시작하세요</div>
        </div>
      )}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes indeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }
        .progress-fill { overflow: hidden; }
      `}</style>
    </div>
  );
}
