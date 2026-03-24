"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play, Pause, Download, SkipBack, Volume2, VolumeX,
  Palette, Send, Check, Link2, Loader, AlertCircle
} from "lucide-react";

/* ── 타입 ────────────────────────────────────────────────── */
type SubLine = {
  id: number;
  start: number;   // 초 단위
  end: number;
  text: string;
  type: string;
};

type StudioData = {
  videoId: string;
  videoTitle: string;
  channelTitle: string;
  title: string;
  thumbnailTop: string;
  thumbnailBottom: string;
  downloadedFileUrl?: string;
  downloadedFilename?: string;
  script: { time: string; type: string; ko: string }[];
};

/* ── 상수 ────────────────────────────────────────────────── */
const TYPE_COLORS: Record<string, string> = {
  narration: "#10b981",
  reaction: "#6366f1",
  hook: "#f59e0b",
  commentary: "#ec4899",
};

const TYPE_LABELS: Record<string, string> = {
  narration: "나레이션",
  reaction: "반응",
  hook: "훅",
  commentary: "해설",
};

const FONT_PRESETS = [
  { name: "기본 흰색", color: "#ffffff", bg: "rgba(0,0,0,0.7)", font: "Inter" },
  { name: "노란 강조", color: "#fbbf24", bg: "rgba(0,0,0,0.8)", font: "Outfit" },
  { name: "K-뉴스", color: "#ffffff", bg: "rgba(239,68,68,0.85)", font: "Outfit" },
  { name: "모노 코드", color: "#7c85f0", bg: "rgba(10,10,20,0.9)", font: "JetBrains Mono" },
];



/* ── 유틸 ────────────────────────────────────────────────── */
function timeToSec(t: string): number {
  const p = t.split(":").map(Number);
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  return p[0] * 60 + p[1];
}
function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function scriptToSubs(script: StudioData["script"]): SubLine[] {
  return script.map((line, i, arr) => {
    const start = timeToSec(line.time);
    const next = arr[i + 1] ? timeToSec(arr[i + 1].time) : start + 10;
    return {
      id: i + 1,
      start,
      end: Math.max(start + 1, next - 0.5),
      text: line.ko,
      type: line.type,
    };
  });
}

function generateSRT(subs: SubLine[]): string {
  return subs.map((s, i) => {
    const fmt = (t: number) => {
      const h = Math.floor(t / 3600);
      const m = Math.floor((t % 3600) / 60);
      const sec = Math.floor(t % 60);
      const ms = Math.round((t % 1) * 1000);
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
    };
    return `${i + 1}\n${fmt(s.start)} --> ${fmt(s.end)}\n${s.text}\n`;
  }).join("\n");
}

function generateVTT(subs: SubLine[]): string {
  const fmt = (t: number) => {
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const sec = Math.floor(t % 60);
    const ms = Math.round((t % 1) * 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
  };
  return "WEBVTT\n\n" + subs.map((s, i) =>
    `${i + 1}\n${fmt(s.start)} --> ${fmt(s.end)}\n${s.text}\n`
  ).join("\n");
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── YouTube IFrame Player 타입 ──────────────────────────── */
import type { YTPlayer } from "@/lib/youtube-player";


/* ── 메인 컴포넌트 ───────────────────────────────────────── */
export default function StudioPage() {
  /* 상태 */
  const [videoId, setVideoId] = useState<string>("");
  const [fileVideoUrl, setFileVideoUrl] = useState<string>("");  // 서버 다운로드 파일 URL
  const [urlInput, setUrlInput] = useState("");
  const [subs, setSubs] = useState<SubLine[]>([]);
  const [videoTitle, setVideoTitle] = useState("데모 영상");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(65);
  const [selectedSub, setSelectedSub] = useState<number | null>(null);
  const [preset, setPreset] = useState(0);
  const [muted, setMuted] = useState(false);
  const [exported, setExported] = useState(false);
  const [ytReady, setYtReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subtitleLoading, setSubtitleLoading] = useState<string | null>(null);
  const [subtitleError, setSubtitleError] = useState<string | null>(null);
  const [subtitleStep, setSubtitleStep] = useState<"extracted" | "translated" | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);  // HTML5 video 플레이어
  const isFileMode = !!fileVideoUrl && !videoId;  // 파일 모드 여부

  const playerRef = useRef<YTPlayer | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  /* ── sessionStorage에서 대본 데이터 로드 ────────────────── */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("studio_data");
      if (raw) {
        const data: StudioData = JSON.parse(raw);

        // ★ 이전 상태 전체 초기화
        setSubs([]);
        setSubtitleStep(null);
        setSubtitleError(null);
        setSubtitleLoading(null);
        setSelectedSub(null);
        setCurrentTime(0);
        setPlaying(false);
        setExported(false);

        // 다운로드 파일이 있으면 파일 모드로
        if (data.downloadedFileUrl) {
          setFileVideoUrl(data.downloadedFileUrl);
          setVideoId("");  // YouTube 모드 해제
          setVideoTitle(data.downloadedFilename || data.title || data.videoTitle || "");
        } else if (data.videoId) {
          setFileVideoUrl("");
          setVideoId(data.videoId);
          setVideoTitle(data.title || data.videoTitle || "");
        }

        // script가 있으면 변환, 없으면 빈 배열 유지
        if (data.script?.length) {
          setSubs(scriptToSubs(data.script));
        }

        sessionStorage.removeItem("studio_data");
      }
    } catch { /* ignore */ }
  }, []);

  /* ── HTML5 Video 플레이어 이벤트 ────────────────────────── */
  useEffect(() => {
    if (!isFileMode || !videoRef.current) return;
    const v = videoRef.current;
    const onLoaded = () => { setDuration(v.duration); setLoading(false); };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setCurrentTime(v.currentTime);
    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTime);
    setLoading(true);
    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTime);
    };
  }, [isFileMode, fileVideoUrl]);

  /* ── YouTube IFrame API 로드 ───────────────────────────── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.YT) { setYtReady(true); return; }

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => setYtReady(true);
  }, []);

  /* ── 영상 ID 변경 시 YouTube 플레이어 생성 (파일모드가 아닐 때만) ─── */
  useEffect(() => {
    if (isFileMode || !ytReady || !videoId) return;

    // 기존 플레이어 파괴
    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch { /* ignore */ }
      playerRef.current = null;
    }

    setLoading(true);

    playerRef.current = new window.YT.Player("yt-player", {
      videoId,
      width: "100%",
      height: "100%",
      playerVars: {
        autoplay: 0,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
        fs: 0,
        iv_load_policy: 3,
        disablekb: 1,
        playsinline: 1,
      },
      events: {
        onReady: (e: { target: YTPlayer }) => {
          setDuration(e.target.getDuration());
          setLoading(false);
        },
        onStateChange: (e: { data: number }) => {
          if (e.data === window.YT.PlayerState.PLAYING) {
            setPlaying(true);
          } else if (e.data === window.YT.PlayerState.PAUSED || e.data === window.YT.PlayerState.ENDED) {
            setPlaying(false);
          }
        },
      },
    } as Record<string, unknown>);
  }, [ytReady, videoId, isFileMode]);

  /* ── 현재 시간 싱크 (100ms 간격) — YouTube 모드만 ──────── */
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);

    if (!isFileMode && playing && playerRef.current) {
      tickRef.current = setInterval(() => {
        if (playerRef.current) {
          setCurrentTime(playerRef.current.getCurrentTime());
        }
      }, 100);
    }

    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [playing, isFileMode]);

  /* ── 플레이어 컨트롤 (YouTube + 파일 모드 통합) ──────── */
  const togglePlay = useCallback(() => {
    if (isFileMode) {
      if (!videoRef.current) return;
      if (playing) { videoRef.current.pause(); } else { videoRef.current.play(); }
    } else {
      if (!playerRef.current) return;
      if (playing) { playerRef.current.pauseVideo(); } else { playerRef.current.playVideo(); }
    }
  }, [playing, isFileMode]);

  const seekTo = useCallback((sec: number) => {
    setCurrentTime(sec);
    if (isFileMode) {
      if (videoRef.current) videoRef.current.currentTime = sec;
    } else {
      if (playerRef.current) playerRef.current.seekTo(sec, true);
    }
  }, [isFileMode]);

  const toggleMute = useCallback(() => {
    if (isFileMode) {
      if (!videoRef.current) return;
      videoRef.current.muted = !videoRef.current.muted;
      setMuted(videoRef.current.muted);
    } else {
      if (!playerRef.current) return;
      if (playerRef.current.isMuted()) {
        playerRef.current.unMute();
        setMuted(false);
      } else {
        playerRef.current.mute();
        setMuted(true);
      }
    }
  }, [isFileMode]);

  /* ── URL 입력으로 영상 로드 (YouTube URL / 파일 URL 모두 지원) ── */
  const loadFromUrl = () => {
    const input = urlInput.trim();
    if (!input) return;
    
    // 서버 파일 URL인 경우 (/api/downloads/ 경로)
    if (input.startsWith("/api/downloads/") || input.includes("/api/downloads/")) {
      setFileVideoUrl(input);
      setVideoId("");
      setVideoTitle(decodeURIComponent(input.split("/").pop() || "영상 파일"));
      return;
    }
    
    try {
      const u = new URL(input);
      // YouTube URL
      let vid = "";
      if (u.hostname.includes("youtu.be")) vid = u.pathname.slice(1);
      else if (u.hostname.includes("youtube")) vid = u.searchParams.get("v") || "";
      if (vid) {
        setFileVideoUrl("");
        setVideoId(vid);
        setVideoTitle(input);
        return;
      }
      // 일반 영상 파일 URL
      if (input.match(/\.(mp4|webm|mkv|mov)$/i) || u.pathname.includes("/api/downloads/")) {
        setFileVideoUrl(input);
        setVideoId("");
        setVideoTitle(decodeURIComponent(u.pathname.split("/").pop() || "영상"));
        return;
      }
    } catch { /* not a valid URL */ }
  };

  /* ── 자막 수정 ────────────────────────────────────────── */
  const updateSubText = (id: number, text: string) => {
    setSubs(prev => prev.map(s => s.id === id ? { ...s, text } : s));
  };

  /* ── SRT/VTT 내보내기 ────────────────────────────────── */
  const handleExportSRT = () => {
    downloadFile(generateSRT(subs), `${videoTitle || "subtitles"}.srt`, "text/srt");
  };
  const handleExportVTT = () => {
    downloadFile(generateVTT(subs), `${videoTitle || "subtitles"}.vtt`, "text/vtt");
  };

  const handleSendPublisher = () => {
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  };

  /* ── 현재 활성 자막 ──────────────────────────────────── */
  const activeSub = subs.find(s => currentTime >= s.start && currentTime <= s.end);
  const p = FONT_PRESETS[preset];
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  /* ── 렌더 ─────────────────────────────────────────────── */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1100 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>편집 스튜디오</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          YouTube 원본 영상 재생 · 자막 실시간 싱크 · 스타일 편집 · SRT/VTT 내보내기
        </p>
      </div>

      {/* URL 입력 (영상 미로드 시 표시) */}
      {!videoId && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "var(--text-secondary)" }}>
            YouTube 영상 URL 입력
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="input-group" style={{ flex: 1 }}>
              <Link2 size={15} className="input-icon" />
              <input
                className="input" value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && loadFromUrl()}
                placeholder="YouTube URL 또는 /api/downloads/파일명.mp4"
              />
            </div>
            <button className="btn btn-brand" onClick={loadFromUrl} disabled={!urlInput.trim()}
              style={{ padding: "0 22px", whiteSpace: "nowrap" }}>
              영상 불러오기
            </button>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
            💡 YouTube URL, 영상 파일 경로 입력 또는 편집기에서 &quot;자막 스튜디오로 전송&quot; 클릭 시 자동 로드됩니다.
          </div>
        </div>
      )}

      {/* 영상 정보 */}
      {videoId && videoTitle && (
        <div style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)", display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <Play size={12} color="#818cf8" />
          <span style={{ color: "#a5b4fc", flex: 1 }}>
            <strong>{videoTitle}</strong>
            {duration > 0 && <span style={{ marginLeft: 8, color: "var(--text-muted)" }}>{formatTime(duration)}</span>}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => { setVideoId(""); setUrlInput(""); }}
            style={{ fontSize: 11, padding: "3px 10px" }}>
            다른 영상
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 18 }}>
        {/* ── 좌측: 영상 + 타임라인 + 자막편집 ──────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* YouTube 영상 플레이어 */}
          <div ref={containerRef} style={{
            background: "#000", borderRadius: 10, overflow: "hidden",
            border: "1px solid var(--border-default)", aspectRatio: "16/9",
            position: "relative",
          }}>
            {(videoId || isFileMode) ? (
              <>
                {/* 파일 모드: HTML5 video */}
                {isFileMode ? (
                  <video
                    ref={videoRef}
                    src={fileVideoUrl}
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    preload="metadata"
                  />
                ) : (
                  <div id="yt-player" style={{ width: "100%", height: "100%" }} />
                )}

                {/* 로딩 */}
                {loading && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", zIndex: 5 }}>
                    <Loader size={28} color="#818cf8" style={{ animation: "spin 1s linear infinite" }} />
                  </div>
                )}

                {/* 자막 오버레이 */}
                {activeSub && (
                  <div style={{
                    position: "absolute", bottom: "12%", left: "50%", transform: "translateX(-50%)",
                    background: p.bg, color: p.color, padding: "8px 18px", borderRadius: 6,
                    fontSize: 16, fontWeight: 600, fontFamily: p.font, textAlign: "center",
                    maxWidth: "80%", lineHeight: 1.5, whiteSpace: "pre-wrap",
                    transition: "opacity 0.2s", zIndex: 3,
                    pointerEvents: "none",
                  }}>
                    {activeSub.text}
                  </div>
                )}

                {/* 소스 표시 (파일 / YouTube) */}
                {isFileMode && (
                  <div style={{
                    position: "absolute", top: 10, left: 12,
                    background: "rgba(139,92,246,0.8)", color: "white",
                    padding: "3px 8px", borderRadius: 5,
                    fontSize: 10, fontWeight: 700, zIndex: 3, pointerEvents: "none",
                  }}>
                    📁 로컬 파일
                  </div>
                )}

                {/* 시간 표시 */}
                <div style={{
                  position: "absolute", top: 10, right: 12,
                  background: "rgba(0,0,0,0.6)", color: "white",
                  padding: "3px 8px", borderRadius: 5,
                  fontSize: 12, fontFamily: "JetBrains Mono, monospace",
                  zIndex: 3, pointerEvents: "none",
                }}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>

                {/* 클릭으로 재생/일시정지 */}
                <div
                  onClick={togglePlay}
                  style={{
                    position: "absolute", inset: 0, zIndex: 2, cursor: "pointer",
                  }}
                />
              </>
            ) : (
              /* 영상 미로드 상태 */
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #1a0a2e, #0a1628, #0d2818)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
                  <AlertCircle size={36} style={{ opacity: 0.3, margin: "0 auto 10px", display: "block" }} />
                  YouTube URL 또는 영상 파일 경로를 입력하거나<br />
                  편집기에서 &quot;자막 스튜디오로 전송&quot; 클릭
                </div>
              </div>
            )}
          </div>

          {/* 플레이어 컨트롤 */}
          <div className="card" style={{ padding: "12px 16px" }}>
            {/* 타임라인 */}
            <div style={{ position: "relative", marginBottom: 12, cursor: "pointer" }}
              onClick={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                const newTime = ((e.clientX - rect.left) / rect.width) * duration;
                seekTo(newTime);
              }}>
              <div className="timeline-track" style={{ height: 44, background: "var(--bg-input)" }}>
                {subs.map(s => (
                  <div key={s.id} className="timeline-segment"
                    style={{
                      left: `${(s.start / duration) * 100}%`,
                      width: `${((s.end - s.start) / duration) * 100}%`,
                      background: TYPE_COLORS[s.type] + "40",
                      color: TYPE_COLORS[s.type],
                      borderLeft: `2px solid ${TYPE_COLORS[s.type]}`
                    }}>
                    {s.text.slice(0, 16)}...
                  </div>
                ))}
                <div className="timeline-playhead" style={{ left: `${pct}%` }} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button className="btn-icon" onClick={() => seekTo(0)}><SkipBack size={14} /></button>
              <button onClick={togglePlay} style={{
                width: 36, height: 36, borderRadius: 8,
                background: "var(--gradient-brand)", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 12px var(--brand-glow)"
              }}>
                {playing ? <Pause size={16} color="white" fill="white" /> : <Play size={16} color="white" fill="white" />}
              </button>
              <div style={{ flex: 1, font: "12px JetBrains Mono, monospace", color: "var(--text-muted)" }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
              <button className="btn-icon" onClick={toggleMute}>
                {muted ? <VolumeX size={14} color="var(--text-muted)" /> : <Volume2 size={14} color="var(--text-muted)" />}
              </button>
            </div>
          </div>

          {/* 자막 편집 리스트 */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{
              padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>자막 편집</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{subs.length}개 장면</div>
            </div>
            <div style={{ maxHeight: 380, overflowY: "auto" }}>
              {subs.map(s => (
                <div key={s.id}
                  onClick={() => { setSelectedSub(s.id); seekTo(s.start); }}
                  style={{
                    display: "grid", gridTemplateColumns: "60px 40px 1fr",
                    borderBottom: "1px solid rgba(30,30,46,0.5)", cursor: "pointer",
                    background: selectedSub === s.id ? "rgba(99,102,241,0.05)"
                      : activeSub?.id === s.id ? "rgba(99,102,241,0.02)" : "transparent",
                    borderLeft: selectedSub === s.id ? "2px solid var(--brand)"
                      : activeSub?.id === s.id ? "2px solid rgba(99,102,241,0.3)" : "2px solid transparent",
                  }}>
                  <div style={{ padding: "10px 10px", fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
                    {formatTime(s.start)}
                  </div>
                  <div style={{ padding: "10px 4px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{
                      fontSize: 8, fontWeight: 700, color: TYPE_COLORS[s.type] ?? "#aaa",
                      background: (TYPE_COLORS[s.type] ?? "#aaa") + "18",
                      padding: "2px 5px", borderRadius: 3, letterSpacing: "0.04em",
                    }}>
                      {TYPE_LABELS[s.type] ?? s.type}
                    </span>
                  </div>
                  <textarea value={s.text} onChange={e => updateSubText(s.id, e.target.value)} rows={2}
                    style={{
                      margin: "8px 12px 8px 0", width: "calc(100% - 12px)",
                      background: "transparent", border: "none", outline: "none",
                      color: "var(--text-primary)", fontSize: 13, resize: "none",
                      fontFamily: "Inter, sans-serif", lineHeight: 1.5,
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 우측: 스타일 + 내보내기 ────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* 자막 스타일 */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              자막 스타일
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {FONT_PRESETS.map((fp, i) => (
                <button key={i} onClick={() => setPreset(i)}
                  style={{
                    padding: "10px 12px", borderRadius: 8,
                    border: `1px solid ${preset === i ? "var(--brand)" : "var(--border-default)"}`,
                    background: preset === i ? "var(--brand-dim)" : "var(--bg-elevated)",
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                    transition: "all 0.15s",
                  }}>
                  <div style={{
                    padding: "4px 10px", borderRadius: 5,
                    background: fp.bg, color: fp.color,
                    fontSize: 11, fontFamily: fp.font, fontWeight: 600, whiteSpace: "nowrap",
                  }}>
                    가나다 Abc
                  </div>
                  <span style={{ fontSize: 12, color: preset === i ? "#818cf8" : "var(--text-muted)", flex: 1, textAlign: "left" }}>
                    {fp.name}
                  </span>
                  {preset === i && <Check size={12} color="#818cf8" />}
                </button>
              ))}
            </div>
          </div>

          {/* 씬 타입 범례 */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              씬 타입
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {Object.entries(TYPE_COLORS).map(([type, color]) => (
                <div key={type} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "5px 10px", borderRadius: 6,
                  background: color + "10", border: `1px solid ${color}30`,
                  fontSize: 11, color: "var(--text-muted)",
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: "inline-block" }} />
                  {TYPE_LABELS[type]}
                </div>
              ))}
            </div>
          </div>

          {/* 썸네일 미리보기 */}
          {videoId && (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                썸네일
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                alt="thumbnail"
                style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border-default)" }}
              />
            </div>
          )}

          {/* 자막 워크플로우 */}
          {(videoId || isFileMode) && (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                자막 워크플로우
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* ① 자막 추출 */}
                <button
                  className="btn btn-brand btn-sm"
                  style={{ gap: 6, justifyContent: "flex-start" }}
                  disabled={subtitleLoading !== null}
                  onClick={async () => {
                    setSubtitleLoading("extract");
                    setSubtitleError(null);
                    try {
                      const res = await fetch("/api/studio/subtitle", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "extract", videoId: videoId || "", fileVideoUrl: fileVideoUrl || "" }),
                      });
                      const data = await res.json();
                      if (!res.ok) { setSubtitleError(data.error); return; }
                      setSubs(data.subs);
                      setSubtitleStep("extracted");
                    } catch (e) { setSubtitleError(String(e)); }
                    finally { setSubtitleLoading(null); }
                  }}
                >
                  {subtitleLoading === "extract"
                    ? <><Loader size={12} style={{ animation: "spin 0.9s linear infinite" }} />{isFileMode ? "Whisper 음성 분석 중..." : "자막 추출 중..."}</>
                    : <><Download size={12} />{isFileMode ? "① 음성 분석 자막 추출 (Whisper AI)" : "① 자막 추출 (YouTube CC)"}</>
                  }
                </button>
                {subtitleStep && (
                  <div style={{ fontSize: 10, color: "#34d399", marginLeft: 4 }}>✓ {subs.length}개 자막 추출됨</div>
                )}

                {/* ② 한국어 번역 */}
                <button
                  className="btn btn-brand btn-sm"
                  style={{
                    gap: 6, justifyContent: "flex-start",
                    background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                    borderColor: "#8b5cf6",
                  }}
                  disabled={subtitleLoading !== null || !subtitleStep}
                  onClick={async () => {
                    setSubtitleLoading("translate");
                    setSubtitleError(null);
                    try {
                      const res = await fetch("/api/studio/subtitle", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "translate", subs }),
                      });
                      const data = await res.json();
                      if (!res.ok) { setSubtitleError(data.error); return; }
                      setSubs(data.subs);
                      setSubtitleStep("translated");
                    } catch (e) { setSubtitleError(String(e)); }
                    finally { setSubtitleLoading(null); }
                  }}
                >
                  {subtitleLoading === "translate"
                    ? <><Loader size={12} style={{ animation: "spin 0.9s linear infinite" }} />번역 중 (GPT-4o)...</>
                    : <><Palette size={12} />② 한국어 번역 (GPT-4o)</>
                  }
                </button>
                {subtitleStep === "translated" && (
                  <div style={{ fontSize: 10, color: "#818cf8", marginLeft: 4 }}>✓ 한국어 번역 완료</div>
                )}

                {subtitleError && (
                  <div style={{ fontSize: 11, color: "#f87171", padding: "6px 8px", borderRadius: 6, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <AlertCircle size={11} style={{ marginRight: 4 }} />{subtitleError}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 내보내기 */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              내보내기
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={handleExportSRT}
                style={{ justifyContent: "flex-start", gap: 8 }}>
                <Download size={13} /> SRT 자막 파일 다운로드
              </button>
              <button className="btn btn-ghost btn-sm" onClick={handleExportVTT}
                style={{ justifyContent: "flex-start", gap: 8 }}>
                <Download size={13} /> VTT 자막 파일 다운로드
              </button>
            </div>
          </div>

          {/* 배포 전달 */}
          <a href="/dashboard/publisher" style={{ textDecoration: "none" }}>
            <button className="btn btn-brand" onClick={handleSendPublisher}
              style={{ width: "100%", padding: "12px", fontSize: 14, gap: 8 }}>
              {exported ? <><Check size={15} />배포 패널로 전송됨!</> : <><Send size={15} />배포 패널로 보내기</>}
            </button>
          </a>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
