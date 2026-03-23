"use client";
import { useState } from "react";
import {
  Youtube, Globe, Send, Clock, Check, X, ChevronDown,
  Calendar, Zap, BarChart2, Settings, Play, AlertCircle, Plus
} from "lucide-react";

type Platform = "youtube" | "shorts" | "tiktok" | "reels";

const PLATFORMS: { id: Platform; name: string; handle: string; icon: string; color: string; format: string; connected: boolean }[] = [
  { id: "youtube", name: "YouTube", handle: "@KContentKR", icon: "YT", color: "#ff0000", format: "가로 (16:9)", connected: true },
  { id: "shorts", name: "YouTube Shorts", handle: "@KContentKR Shorts", icon: "S", color: "#ff0000", format: "세로 (9:16) · 60초 이하", connected: true },
  { id: "tiktok", name: "TikTok", handle: "@kcontent.kr", icon: "TT", color: "#69c9d0", format: "세로 (9:16)", connected: true },
  { id: "reels", name: "Instagram Reels", handle: "@kcontent_kr", icon: "IG", color: "#e1306c", format: "세로 (9:16) · 90초 이하", connected: false },
];

const BEST_TIMES = [
  { day: "월", time: "저녁 7시", ctr: 9.2 },
  { day: "화", time: "저녁 8시", ctr: 8.7 },
  { day: "수", time: "저녁 7시", ctr: 9.0 },
  { day: "목", time: "저녁 9시", ctr: 8.1 },
  { day: "금", time: "저녁 6시", ctr: 10.1 },
  { day: "토", time: "낮 12시", ctr: 9.8 },
  { day: "일", time: "저녁 8시", ctr: 9.4 },
];

const QUEUE = [
  { id: "q1", title: "미국인이 한국 편의점 보고 경악한 이유", niche: "K-먹방", duration: "14:23", status: "ready" as const },
  { id: "q2", title: "외국인이 한국 병원 처음 갔다가 충격 받은 순간", niche: "K-의료", duration: "12:07", status: "processing" as const },
  { id: "q3", title: "서울 지하철 보고 뉴욕 지하철 욕한 미국인", niche: "K-교통", duration: "10:55", status: "scheduled" as const },
];

type UploadStatus = "idle" | "uploading" | "done";

export default function PublisherPage() {
  const [selected, setSelected] = useState<Set<Platform>>(new Set(["youtube", "tiktok"]));
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [scheduleMode, setScheduleMode] = useState<"now" | "best" | "custom">("best");
  const [selectedDay, setSelectedDay] = useState(4); // 금요일 기본

  const togglePlatform = (id: Platform) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  };

  const handleUpload = () => {
    setUploadStatus("uploading");
    setUploadProgress(0);
    let p = 0;
    const t = setInterval(() => {
      p += Math.random() * 8 + 3;
      if (p >= 100) { p = 100; clearInterval(t); setTimeout(() => setUploadStatus("done"), 300); }
      setUploadProgress(Math.min(p, 100));
    }, 200);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 1000 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>멀티플랫폼 배포</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>YouTube · Shorts · TikTok · Reels 원클릭 동시 업로드 + AI 최적 업로드 시간 추천</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18 }}>
        {/* Left */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Upload Queue */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>업로드 큐</div>
              <span className="badge badge-amber">{QUEUE.length}개 대기</span>
            </div>
            <div>
              {QUEUE.map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: "1px solid rgba(30,30,46,0.4)" }}>
                  <div style={{ width: 40, height: 28, background: "var(--bg-elevated)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Play size={12} color="var(--text-muted)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{item.niche} · {item.duration}</div>
                  </div>
                  <span className={`badge ${item.status === "ready" ? "badge-green" : item.status === "processing" ? "badge-brand" : "badge-amber"}`} style={{ fontSize: 10, flexShrink: 0 }}>
                    {item.status === "ready" ? "준비됨" : item.status === "processing" ? "처리 중" : "예약됨"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Platform Selection */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>배포 플랫폼 선택</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {PLATFORMS.map(p => (
                <div key={p.id}
                  onClick={() => p.connected && togglePlatform(p.id)}
                  className={`platform-card ${selected.has(p.id) ? "selected" : ""} ${!p.connected ? "" : ""}`}
                  style={{ opacity: p.connected ? 1 : 0.5, cursor: p.connected ? "pointer" : "default" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: p.color + "20", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: `1px solid ${p.color}30` }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: p.color }}>{p.icon}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{p.handle} · {p.format}</div>
                  </div>
                  {!p.connected ? (
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>연결하기</button>
                  ) : selected.has(p.id) ? (
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Check size={12} color="white" />
                    </div>
                  ) : (
                    <div style={{ width: 22, height: 22, borderRadius: "50%", border: "1px solid var(--border-default)", flexShrink: 0 }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Upload Button */}
          {uploadStatus === "idle" && (
            <button className="btn btn-brand" onClick={handleUpload}
              style={{ padding: "14px", fontSize: 15, gap: 10, justifyContent: "center" }}
              disabled={selected.size === 0}>
              <Send size={16} />
              {selected.size}개 플랫폼에 동시 업로드
            </button>
          )}

          {uploadStatus === "uploading" && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width={16} height={16} viewBox="0 0 24 24" style={{ animation: "spin 0.9s linear infinite" }}><circle cx={12} cy={12} r={10} fill="none" stroke="var(--brand)" strokeWidth={3} strokeDasharray="40 60" /></svg>
                업로드 중... {Math.round(uploadProgress)}%
              </div>
              <div className="progress-track" style={{ height: 8 }}>
                <div className="progress-fill" style={{ width: `${uploadProgress}%`, background: "var(--gradient-brand)", height: "100%", borderRadius: 4 }} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {Array.from(selected).map(pid => {
                  const plat = PLATFORMS.find(p => p.id === pid)!;
                  return (
                    <span key={pid} className="badge badge-brand" style={{ fontSize: 11 }}>
                      <span style={{ animation: "pulse-dot 1s infinite", display: "inline-block", width: 5, height: 5, background: plat.color, borderRadius: "50%" }} />
                      {plat.name} 업로드 중
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {uploadStatus === "done" && (
            <div className="card" style={{ padding: 20, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(16,185,129,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Check size={18} color="#34d399" />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#34d399" }}>배포 완료!</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{selected.size}개 플랫폼 업로드 성공</div>
                </div>
              </div>
              {Array.from(selected).map(pid => {
                const plat = PLATFORMS.find(p => p.id === pid)!;
                return (
                  <div key={pid} style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                    <Check size={11} color="#34d399" />
                    {plat.name} — {plat.handle}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Schedule + Best Time */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Schedule Mode */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>업로드 시간</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { id: "now" as const, label: "지금 바로 업로드", sub: "즉시 배포" },
                { id: "best" as const, label: "AI 최적 시간 추천", sub: "금요일 저녁 6시 (CTR 10.1%)" },
                { id: "custom" as const, label: "직접 설정", sub: "날짜·시간 선택" },
              ].map(({ id, label, sub }) => (
                <button key={id} onClick={() => setScheduleMode(id)}
                  style={{
                    padding: "10px 12px", borderRadius: 8, cursor: "pointer", border: `1px solid ${scheduleMode === id ? "var(--brand)" : "var(--border-default)"}`,
                    background: scheduleMode === id ? "var(--brand-dim)" : "var(--bg-elevated)", textAlign: "left", transition: "all 0.15s"
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: scheduleMode === id ? "#818cf8" : "var(--text-secondary)" }}>{label}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Best Time by Day */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>요일별 최적 업로드 시간</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {BEST_TIMES.map(({ day, time, ctr }, i) => (
                <div key={day} onClick={() => setSelectedDay(i)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 7, cursor: "pointer",
                    background: selectedDay === i ? "var(--brand-dim)" : "transparent",
                    border: `1px solid ${selectedDay === i ? "rgba(99,102,241,0.25)" : "transparent"}` }}>
                  <span style={{ width: 22, fontSize: 12, fontWeight: 700, color: selectedDay === i ? "#818cf8" : "var(--text-muted)", textAlign: "center" }}>{day}</span>
                  <span style={{ flex: 1, fontSize: 12, color: selectedDay === i ? "var(--text-primary)" : "var(--text-secondary)" }}>{time}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div className="progress-track" style={{ width: 48, height: 3 }}>
                      <div className="progress-fill" style={{ width: `${(ctr / 12) * 100}%`, background: selectedDay === i ? "var(--brand)" : "#3f3f5a" }} />
                    </div>
                    <span style={{ fontSize: 10, color: selectedDay === i ? "#818cf8" : "var(--text-muted)", minWidth: 32 }}>{ctr}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Auto-credit */}
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 }}>원본 크레딧 자동 삽입</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 10 }}>
              📌 원본 영상: @JakeInSeoul<br />
              All credits to the original creator. This channel adds Korean subtitles and commentary.
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <span className="badge badge-green" style={{ fontSize: 10 }}>✓ 태그 자동 삽입</span>
              <span className="badge badge-gray" style={{ fontSize: 10 }}>저작권 보호</span>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}
