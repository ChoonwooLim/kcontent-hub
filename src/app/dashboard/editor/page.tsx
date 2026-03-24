"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Scissors, Plus, Trash2, ArrowRight, Play,
  Loader, AlertCircle, ChevronRight, Check, X, Film,
  Zap, Download
} from "lucide-react";

/* YouTube IFrame Player API — 타입을 로컬로 정의 */
type YTPlayer = { seekTo: (s: number, a: boolean) => void; playVideo: () => void; pauseVideo: () => void; getCurrentTime: () => number; destroy: () => void };

/* ── 타입 ─────────────────────────────────────────────── */
type EditClip = {
  id: string;
  order: number;
  startTime: string;
  endTime: string;
  label: string | null;
  note: string | null;
  included: boolean;
};

type PipelineVideo = {
  id: string;
  title: string;
  channel: string;
  ytVideoId: string | null;
  originalUrl: string;
  thumbnail: string | null;
  duration: string | null;
  views: string | null;
  lang: string | null;
  grade: string;
  score: number;
  niche: string | null;
  stage: string;
  hasCC: boolean;
  transcriptJson: string | null;
  translatedJson: string | null;
  scriptJson: string | null;
  titleKo: string | null;
  summaryDuration: number | null;
  editClips: EditClip[];
};

const STAGES = ["발굴 대기", "요약 편집", "HD 저장", "자막 추출", "한글 변환", "대본 생성", "배포 완료"];
const STAGE_COLORS: Record<string, string> = {
  "발굴 대기": "#52525b", "요약 편집": "#f59e0b", "HD 저장": "#06b6d4",
  "자막 추출": "#8b5cf6", "한글 변환": "#6366f1", "대본 생성": "#10b981", "배포 완료": "#22c55e",
};
const CLIP_LABELS = ["훅", "반응", "하이라이트", "나레이션", "문화 설명", "엔딩"];

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}분 ${s}초`;
}

function timeToSec(t: string): number {
  const p = t.split(":").map(Number);
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  return p[0] * 60 + (p[1] || 0);
}

function clipDuration(clip: EditClip): number {
  return timeToSec(clip.endTime) - timeToSec(clip.startTime);
}

/* ── 파이프라인 진행 스텝퍼 ────────────────────────────── */
function PipelineStepper({ stage }: { stage: string }) {
  const currentIdx = STAGES.indexOf(stage);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
      {STAGES.map((s, i) => (
        <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{
            padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
            background: i <= currentIdx ? STAGE_COLORS[s] + "20" : "var(--bg-elevated)",
            color: i <= currentIdx ? STAGE_COLORS[s] : "var(--text-muted)",
            border: `1px solid ${i === currentIdx ? STAGE_COLORS[s] + "50" : "var(--border-subtle)"}`,
            transition: "all 0.2s",
          }}>
            {i < currentIdx ? <Check size={10} style={{ marginRight: 3 }} /> : null}
            {s}
          </div>
          {i < STAGES.length - 1 && (
            <ChevronRight size={12} color="var(--text-muted)" style={{ opacity: 0.3 }} />
          )}
        </div>
      ))}
    </div>
  );
}

/* ── 메인 편집기 페이지 ──────────────────────────────── */
export default function EditorPage() {
  const [videos, setVideos] = useState<PipelineVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null); // action name
  const [processResult, setProcessResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 클립 편집 상태
  const [newClipStart, setNewClipStart] = useState("00:00:00");
  const [newClipEnd, setNewClipEnd] = useState("00:03:00");
  const [newClipLabel, setNewClipLabel] = useState("하이라이트");

  // AI 분석 결과
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  // 인라인 클립 편집
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editLabel, setEditLabel] = useState("하이라이트");

  // 데이터 페치 + 파생 값
  const fetchVideos = useCallback(async () => {
    try {
      const res = await fetch("/api/pipeline");
      const data = await res.json();
      if (data.videos) setVideos(data.videos);
      return data.videos || [];
    } catch { return []; }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  // URL ?saveYtId=xxx 파라미터 → 자동 저장 + 선택
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const saveYtId = params.get("saveYtId");
    if (!saveYtId) return;

    // URL 파라미터 제거 (중복 실행 방지)
    window.history.replaceState({}, "", window.location.pathname);

    (async () => {
      try {
        // 파이프라인에 저장
        const res = await fetch("/api/pipeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `YouTube 영상 (${saveYtId})`,
            channel: "",
            originalUrl: `https://www.youtube.com/watch?v=${saveYtId}`,
            ytVideoId: saveYtId,
            grade: "B",
            score: 70,
            hasCC: false,
          }),
        });

        const data = await res.json();
        if (data.video) {
          // 목록 새로고침 후 해당 영상 자동 선택
          const refreshed = await fetchVideos();
          const found = refreshed.find((v: PipelineVideo) => v.ytVideoId === saveYtId);
          if (found) setSelectedId(found.id);
          else if (data.video.id) setSelectedId(data.video.id);
        }
      } catch (e) {
        setError(`영상 저장 오류: ${String(e)}`);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = videos.find(v => v.id === selectedId);
  const totalClipSec = selected?.editClips
    ?.filter(c => c.included)
    ?.reduce((acc, c) => acc + clipDuration(c), 0) || 0;

  // ── 클립 미리보기 (YouTube IFrame Player API) ──
  const playerRef = useRef<YTPlayer | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewClipIdx, setPreviewClipIdx] = useState(0);
  const [ytApiReady, setYtApiReady] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0); // 0~1 per clip

  // YouTube IFrame API 로드
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as unknown as Record<string, unknown>).YT) { setYtApiReady(true); return; }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    (window as unknown as Record<string, { (): void }>).onYouTubeIframeAPIReady = () => setYtApiReady(true);
  }, []);

  // Player 생성 (영상 선택 시)
  useEffect(() => {
    if (!ytApiReady || !selected?.ytVideoId) return;
    // 이전 player 정리
    if (playerRef.current) { try { playerRef.current.destroy(); } catch {} playerRef.current = null; }
    const el = document.getElementById("yt-player-container");
    if (!el) return;
    const div = document.createElement("div");
    div.id = "yt-player";
    el.innerHTML = "";
    el.appendChild(div);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    playerRef.current = new (window as any).YT.Player("yt-player", {
      videoId: selected.ytVideoId,
      width: "100%",
      height: "100%",
      playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
    }) as YTPlayer;
    return () => {
      if (previewTimerRef.current) clearInterval(previewTimerRef.current);
    };
  }, [ytApiReady, selected?.ytVideoId]);

  // 미리보기 시작
  const startPreview = () => {
    if (!selected || !playerRef.current) return;
    const clips = selected.editClips.filter(c => c.included);
    if (clips.length === 0) return;
    setPreviewMode(true);
    setPreviewClipIdx(0);
    playClipAt(0, clips);
  };

  // 특정 인덱스 클립 재생
  const playClipAt = (idx: number, clips: EditClip[]) => {
    if (!playerRef.current || idx >= clips.length) {
      stopPreview();
      return;
    }
    const clip = clips[idx];
    const startSec = timeToSec(clip.startTime);
    const endSec = timeToSec(clip.endTime);
    setPreviewClipIdx(idx);
    setPreviewProgress(0);
    playerRef.current.seekTo(startSec, true);
    playerRef.current.playVideo();

    // 구간 끝 감지 타이머
    if (previewTimerRef.current) clearInterval(previewTimerRef.current);
    previewTimerRef.current = setInterval(() => {
      if (!playerRef.current) return;
      const current = playerRef.current.getCurrentTime?.() || 0;
      const duration = endSec - startSec;
      const elapsed = current - startSec;
      setPreviewProgress(Math.min(1, Math.max(0, elapsed / duration)));
      if (current >= endSec - 0.3) {
        if (previewTimerRef.current) clearInterval(previewTimerRef.current);
        const nextIdx = idx + 1;
        if (nextIdx < clips.length) {
          playClipAt(nextIdx, clips);
        } else {
          stopPreview();
        }
      }
    }, 250);
  };

  // 미리보기 중지
  const stopPreview = () => {
    if (previewTimerRef.current) clearInterval(previewTimerRef.current);
    if (playerRef.current) try { playerRef.current.pauseVideo(); } catch {}
    setPreviewMode(false);
    setPreviewClipIdx(-1);
    setPreviewProgress(0);
  };

  // 개별 클립 미리보기
  const playSingleClip = (clip: EditClip) => {
    if (!playerRef.current) return;
    const startSec = timeToSec(clip.startTime);
    const endSec = timeToSec(clip.endTime);
    const clips = selected?.editClips.filter(c => c.included) || [];
    const idx = clips.findIndex(c => c.id === clip.id);
    setPreviewMode(true);
    setPreviewClipIdx(idx >= 0 ? idx : 0);
    setPreviewProgress(0);
    playerRef.current.seekTo(startSec, true);
    playerRef.current.playVideo();

    if (previewTimerRef.current) clearInterval(previewTimerRef.current);
    previewTimerRef.current = setInterval(() => {
      if (!playerRef.current) return;
      const current = playerRef.current.getCurrentTime?.() || 0;
      const duration = endSec - startSec;
      const elapsed = current - startSec;
      setPreviewProgress(Math.min(1, Math.max(0, elapsed / duration)));
      if (current >= endSec - 0.3) {
        stopPreview();
      }
    }, 250);
  };

  // 클립 추가
  const addClip = async () => {
    if (!selectedId) return;
    try {
      await fetch(`/api/pipeline/${selectedId}/clips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startTime: newClipStart, endTime: newClipEnd, label: newClipLabel }),
      });
      fetchVideos();
    } catch { /* ignore */ }
  };

  // 클립 삭제
  const deleteClip = async (clipId: string) => {
    if (!selectedId) return;
    try {
      await fetch(`/api/pipeline/${selectedId}/clips?clipId=${clipId}`, { method: "DELETE" });
      fetchVideos();
    } catch { /* ignore */ }
  };

  // 클립 토글
  const toggleClip = async (clip: EditClip) => {
    if (!selectedId) return;
    try {
      await fetch(`/api/pipeline/${selectedId}/clips`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clips: [{ id: clip.id, included: !clip.included }] }),
      });
      fetchVideos();
    } catch { /* ignore */ }
  };

  // 파이프라인 처리 (AI 분석 / 자막 추출 / 한글 변환 / 대본 생성)
  const processAction = async (action: string) => {
    if (!selectedId) return;
    setProcessing(action);
    setProcessResult(null);
    setError(null);
    try {
      const res = await fetch(`/api/pipeline/${selectedId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "처리 실패");
        return;
      }
      setProcessResult({ success: true, message: data.message || "완료" });
      // AI 분석 결과 요약 캡처
      if (action === "analyze_clips" && data.summary) {
        setAiSummary(data.summary);
      }
      fetchVideos();
    } catch (e) {
      setError(`네트워크 오류: ${String(e)}`);
    } finally {
      setProcessing(null);
    }
  };

  // stage 강제 이동
  const handleAdvance = async () => processAction("advance");

  // HD 다운로드 상태
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadMessage, setDownloadMessage] = useState("");

  // HD 다운로드 핸들러 (비동기 3단계: start → poll → file)
  const handleDownload = async (mode: "single" | "merged", clip?: EditClip) => {
    if (!selected?.ytVideoId) return;
    const dlId = mode === "merged" ? "merged" : clip?.id || "single";
    setDownloading(dlId);
    setDownloadError(null);
    setDownloadProgress(0);
    setDownloadMessage("작업 시작 중...");

    try {
      const clipsToSend = mode === "single" && clip
        ? [{ startTime: clip.startTime, endTime: clip.endTime, label: clip.label }]
        : (selected.editClips || []).filter(c => c.included).map(c => ({
            startTime: c.startTime, endTime: c.endTime, label: c.label,
          }));

      // 1단계: 작업 시작
      const startRes = await fetch(`/api/pipeline/${selected.id}/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", mode, ytVideoId: selected.ytVideoId, clips: clipsToSend }),
      });

      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({ error: "시작 실패" }));
        setDownloadError(err.error || "시작 실패");
        return;
      }

      const { jobId } = await startRes.json();

      // 2단계: 진행률 폴링 (1초 간격)
      let done = false;
      while (!done) {
        await new Promise(r => setTimeout(r, 1000));
        const statusRes = await fetch(`/api/pipeline/${selected.id}/download`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "status", jobId }),
        });

        if (!statusRes.ok) { setDownloadError("상태 조회 실패"); return; }

        const status = await statusRes.json();
        setDownloadProgress(status.progress);
        setDownloadMessage(status.message);

        if (status.status === "error") {
          setDownloadError(status.message);
          return;
        }

        if (status.status === "done") {
          done = true;
          setDownloadMessage("✅ 서버에 저장 완료!");

          // 서버 목록 새로고침
          try {
            const dlRes = await fetch("/api/downloads");
            if (dlRes.ok) {
              const dlData = await dlRes.json();
              if (dlData.files) {
                setDownloadedVideos(dlData.files.map((f: { id: string; filename: string; url: string; size: number; createdAt: string }) => ({
                  id: f.id,
                  filename: f.filename,
                  url: f.url,
                  size: f.size,
                  mode: f.filename.includes("merged") ? "merged" : "single",
                  clipCount: 0,
                  createdAt: new Date(f.createdAt),
                })));
              }
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      setDownloadError(`네트워크 오류: ${String(e)}`);
    } finally {
      setDownloading(null);
      setDownloadProgress(0);
      setDownloadMessage("");
    }
  };

  // 다운로드 완료된 영상 목록
  interface DownloadedVideo {
    id: string; filename: string; url: string;
    size: number; mode: string; clipCount: number; createdAt: Date;
  }
  const [downloadedVideos, setDownloadedVideos] = useState<DownloadedVideo[]>([]);

  // 서버에 저장된 다운로드 파일 목록 로드
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/downloads");
        if (!res.ok) return;
        const data = await res.json();
        if (data.files && data.files.length > 0) {
          const serverVideos: DownloadedVideo[] = data.files.map((f: { id: string; filename: string; url: string; size: number; createdAt: string }) => ({
            id: f.id,
            filename: f.filename,
            url: f.url,
            size: f.size,
            mode: f.filename.includes("merged") ? "merged" : "single",
            clipCount: 0,
            createdAt: new Date(f.createdAt),
          }));
          setDownloadedVideos(prev => {
            // 이미 있는 항목은 제외하고 서버 목록 병합
            const existingIds = new Set(prev.map(v => v.filename));
            const newOnes = serverVideos.filter(v => !existingIds.has(v.filename));
            return [...prev, ...newOnes];
          });
        }
      } catch { /* ignore */ }
    })();
  }, []);



  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 1200 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>영상 편집기</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          저장된 영상 선택 → 핵심 구간 클립 마킹 → 자막 추출 → 한글 변환 → AI 대본 생성 (7단계 파이프라인)
        </p>
      </div>

      {/* 영상 목록 + 편집 패널 */}
      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 18 }}>

        {/* ── 좌측: 저장된 영상 목록 ─────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 8 }}>
            <Film size={14} color="#818cf8" />
            <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>파이프라인 영상</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{videos.length}개</span>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <Loader size={24} color="#818cf8" style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : videos.length === 0 ? (
            <div className="card" style={{ padding: 30, textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
                저장된 영상이 없습니다
              </div>
              <Link href="/dashboard/hunter">
                <button className="btn btn-brand btn-sm"><Scissors size={12} />소재 수집기에서 영상 저장</button>
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 600, overflowY: "auto" }}>
              {videos.map(v => (
                <div key={v.id}
                  className="card" style={{
                    padding: "10px 12px", cursor: "pointer",
                    borderLeft: selectedId === v.id ? "3px solid #818cf8" : "3px solid transparent",
                    background: selectedId === v.id ? "rgba(99,102,241,0.04)" : undefined,
                    transition: "all 0.15s", position: "relative",
                  }}>
                  <div style={{ display: "flex", gap: 10 }} onClick={() => setSelectedId(v.id)}>
                    {v.thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.thumbnail} alt="" style={{ width: 60, height: 34, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {v.title}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                        {v.channel} · {v.duration || "?"}
                      </div>
                    </div>
                    {/* 삭제 버튼 */}
                    <button
                      style={{
                        position: "absolute", top: 6, right: 6,
                        background: "rgba(148,163,184,0.15)", border: "none",
                        borderRadius: 4, width: 20, height: 20,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", color: "#94a3b8", fontSize: 12,
                        opacity: 0.5, transition: "opacity 0.2s",
                      }}
                      title="목록에서 제거"
                      onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={e => (e.currentTarget.style.opacity = "0.5")}
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm(`"${v.title}"\n파이프라인 목록에서 제거하시겠습니까?`)) return;
                        try {
                          const res = await fetch("/api/pipeline", {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: v.id }),
                          });
                          if (res.ok) {
                            setVideos(prev => prev.filter(vid => vid.id !== v.id));
                            if (selectedId === v.id) setSelectedId(null);
                          } else {
                            const data = await res.json();
                            alert(`삭제 실패: ${data.error}`);
                          }
                        } catch (err) { alert(`오류: ${err}`); }
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }} onClick={() => setSelectedId(v.id)}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                      background: (STAGE_COLORS[v.stage] || "#52525b") + "20",
                      color: STAGE_COLORS[v.stage] || "#52525b",
                    }}>
                      {v.stage}
                    </span>
                    {v.niche && <span className="badge badge-gray" style={{ fontSize: 9 }}>{v.niche}</span>}
                    {v.editClips?.length > 0 && (
                      <span style={{ fontSize: 9, color: "#f59e0b" }}>✂ {v.editClips.length}클립</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 우측: 편집 패널 ────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {!selected ? (
            <div className="card" style={{ padding: 60, textAlign: "center" }}>
              <Scissors size={40} style={{ opacity: 0.15, margin: "0 auto 12px" }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>영상을 선택하세요</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>좌측 목록에서 편집할 영상을 클릭하면 파이프라인 도구가 표시됩니다</div>
            </div>
          ) : (
            <>
              {/* 파이프라인 스텝퍼 */}
              <div className="card" style={{ padding: "12px 16px" }}>
                <PipelineStepper stage={selected.stage} />
              </div>

              {/* 영상 정보 + 미리보기 */}
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ display: "flex" }}>
                  {/* YouTube Player API 컨테이너 */}
                  <div style={{ width: 380, flexShrink: 0, aspectRatio: "16/9", background: "#000", position: "relative" }}>
                    <div id="yt-player-container" style={{ width: "100%", height: "100%" }} />
                    {/* 미리보기 오버레이 */}
                    {previewMode && (
                      <div style={{
                        position: "absolute", top: 8, left: 8, right: 8,
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "6px 10px", borderRadius: 8,
                        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
                      }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: "50%",
                          background: "#ef4444", animation: "pulse 1.2s ease-in-out infinite",
                        }} />
                        <span style={{ fontSize: 11, color: "white", fontWeight: 600 }}>
                          클립 {previewClipIdx + 1}/{selected.editClips.filter(c => c.included).length}
                        </span>
                        <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.15)", overflow: "hidden" }}>
                          <div style={{
                            height: "100%", borderRadius: 2,
                            background: "#f59e0b", width: `${previewProgress * 100}%`,
                            transition: "width 0.2s linear",
                          }} />
                        </div>
                        <button onClick={stopPreview} style={{
                          background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 4,
                          padding: "2px 6px", cursor: "pointer", color: "white", fontSize: 10,
                        }}>■ 중지</button>
                      </div>
                    )}
                  </div>
                  <div style={{ padding: "14px 16px", flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>{selected.title}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
                      {selected.channel} · {selected.views || "?"} 조회 · {selected.duration || "?"} · {selected.lang?.toUpperCase() || "?"}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                      {selected.niche && <span className="badge badge-gray" style={{ fontSize: 10 }}>{selected.niche}</span>}
                      <span className={`badge ${selected.grade === "S" ? "badge-amber" : selected.grade === "A" ? "badge-brand" : "badge-gray"}`} style={{ fontSize: 10 }}>
                        {selected.grade}등급 · {selected.score}점
                      </span>
                      {selected.hasCC && <span className="badge badge-green" style={{ fontSize: 10 }}>CC자막</span>}
                    </div>
                    {/* 미리보기 버튼 */}
                    {(selected.editClips?.filter(c => c.included).length || 0) > 0 && (
                      <button
                        className="btn btn-brand btn-sm"
                        style={{
                          gap: 6, padding: "8px 16px",
                          background: previewMode ? "linear-gradient(135deg, #ef4444, #f87171)" : "linear-gradient(135deg, #f59e0b, #f97316)",
                          borderColor: previewMode ? "#ef4444" : "#f59e0b",
                        }}
                        onClick={previewMode ? stopPreview : startPreview}
                      >
                        {previewMode ? (
                          <><X size={12} />미리보기 중지</>
                        ) : (
                          <><Film size={12} />▶ 선별 구간 미리보기 ({selected.editClips.filter(c => c.included).length}개 클립 · {formatDuration(totalClipSec)})</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* ── STEP 1: 요약 편집 (AI 자동 분석 + 수동 편집) ──────── */}
              <div className="card" style={{ overflow: "hidden" }}>
                <div style={{
                  padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>
                      <span style={{ color: "#f59e0b", marginRight: 6 }}>①</span>
                      요약 편집 — AI 자동 분석 + 수동 편집
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      AI가 전체 영상을 분석하여 구독자가 좋아할 핵심 구간을 선별합니다 · 현재 {selected.editClips?.filter(c => c.included).length || 0}개 클립 / {formatDuration(totalClipSec)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {totalClipSec >= 180 && totalClipSec <= 300 && (
                      <span className="badge badge-green" style={{ fontSize: 10 }}>✓ 적정 길이</span>
                    )}
                    {totalClipSec > 0 && totalClipSec < 180 && (
                      <span className="badge badge-amber" style={{ fontSize: 10 }}>⚠ 너무 짧음</span>
                    )}
                    {totalClipSec > 300 && (
                      <span className="badge badge-red" style={{ fontSize: 10 }}>⚠ 5분 초과</span>
                    )}
                  </div>
                </div>

                {/* AI 분석 버튼 + 요약 */}
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", background: "rgba(99,102,241,0.02)" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <button className="btn btn-brand btn-sm" style={{ gap: 6, padding: "8px 16px" }}
                      onClick={() => processAction("analyze_clips")}
                      disabled={processing !== null}>
                      {processing === "analyze_clips" ? (
                        <><Loader size={13} style={{ animation: "spin 0.9s linear infinite" }} />AI 분석 중...</>
                      ) : (
                        <><Zap size={13} />AI 자동 분석</>
                      )}
                    </button>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      전체 영상 자막을 GPT-4o로 분석하여 핵심 구간을 자동 선별합니다
                    </span>
                  </div>

                  {/* AI 분석 결과 요약 */}
                  {aiSummary && (
                    <div style={{
                      marginTop: 10, padding: "10px 12px", borderRadius: 8,
                      background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)",
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#818cf8", marginBottom: 4 }}>🤖 AI 분석 결과</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>{aiSummary}</div>
                    </div>
                  )}
                </div>

                {/* 클립 목록 (AI 추천 이유 포함) */}
                <div style={{ padding: "8px 16px" }}>
                  {(selected.editClips || []).length > 0 && (
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, padding: "4px 0 8px", borderBottom: "1px solid var(--border-subtle)" }}>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: "3px 8px" }}
                        onClick={async () => {
                          if (!selectedId) return;
                          const allIncluded = selected.editClips.every(c => c.included);
                          await fetch(`/api/pipeline/${selectedId}/clips`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ clips: selected.editClips.map(c => ({ id: c.id, included: !allIncluded })) }),
                          });
                          fetchVideos();
                        }}>
                        {selected.editClips.every(c => c.included) ? "전체 제외" : "전체 포함"}
                      </button>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: "3px 8px", color: "#f87171" }}
                        onClick={async () => {
                          if (!selectedId || !confirm("모든 클립을 삭제하시겠습니까?")) return;
                          for (const c of selected.editClips) {
                            await fetch(`/api/pipeline/${selectedId}/clips?clipId=${c.id}`, { method: "DELETE" });
                          }
                          fetchVideos();
                        }}>
                        <Trash2 size={10} />전체 삭제
                      </button>
                    </div>
                  )}

                  {(selected.editClips || []).map((clip, i) => (
                    <div key={clip.id} style={{
                      padding: "10px 0",
                      borderBottom: "1px solid var(--border-subtle)",
                      opacity: clip.included ? 1 : 0.35,
                      transition: "all 0.2s",
                      background: previewMode && previewClipIdx === i ? "rgba(245,158,11,0.06)" : "transparent",
                      borderLeft: previewMode && previewClipIdx === i ? "3px solid #f59e0b" : "3px solid transparent",
                      paddingLeft: 6,
                      marginLeft: -6,
                      borderRadius: 4,
                    }}>
                      {/* 상단: 순서 + 타임코드 + 라벨 + 길이 + 액션 */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 800, color: "#f59e0b", width: 20,
                          height: 20, borderRadius: "50%", background: "#f59e0b15",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>{i + 1}</span>

                        {/* 인라인 시간 수정 */}
                        {editingClipId === clip.id ? (
                          <>
                            <input className="input" value={editStart} onChange={e => setEditStart(e.target.value)}
                              style={{ width: 80, fontSize: 11, fontFamily: "JetBrains Mono", padding: "3px 6px" }} />
                            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>→</span>
                            <input className="input" value={editEnd} onChange={e => setEditEnd(e.target.value)}
                              style={{ width: 80, fontSize: 11, fontFamily: "JetBrains Mono", padding: "3px 6px" }} />
                            <select className="input" value={editLabel} onChange={e => setEditLabel(e.target.value)}
                              style={{ width: 90, fontSize: 11, padding: "3px 6px" }}>
                              {CLIP_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                            <button className="btn btn-brand btn-sm" style={{ padding: "3px 8px", fontSize: 10 }}
                              onClick={async () => {
                                await fetch(`/api/pipeline/${selectedId}/clips`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ clips: [{ id: clip.id, startTime: editStart, endTime: editEnd, label: editLabel }] }),
                                });
                                setEditingClipId(null);
                                fetchVideos();
                              }}>
                              <Check size={10} />저장
                            </button>
                            <button className="btn btn-ghost btn-sm" style={{ padding: "3px 6px", fontSize: 10 }}
                              onClick={() => setEditingClipId(null)}>
                              <X size={10} />
                            </button>
                          </>
                        ) : (
                          <>
                            <span style={{
                              fontSize: 12, fontFamily: "JetBrains Mono, monospace",
                              color: "var(--text-secondary)", cursor: "pointer",
                              padding: "2px 6px", borderRadius: 4,
                              background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
                            }}
                              title="클릭하여 수정"
                              onClick={() => {
                                setEditingClipId(clip.id);
                                setEditStart(clip.startTime);
                                setEditEnd(clip.endTime);
                                setEditLabel(clip.label || "하이라이트");
                              }}>
                              {clip.startTime} → {clip.endTime}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>({Math.round(clipDuration(clip))}초)</span>
                            {clip.label && (
                              <span className="badge badge-brand" style={{ fontSize: 9 }}>{clip.label}</span>
                            )}
                          </>
                        )}

                        <div style={{ flex: 1 }} />
                        {/* 개별 클립 미리보기 */}
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{
                            padding: "3px 6px", fontSize: 10,
                            color: previewMode && previewClipIdx === i ? "#f59e0b" : undefined,
                          }}
                          title={`클립 ${i + 1} 미리보기`}
                          onClick={() => previewMode && previewClipIdx === i ? stopPreview() : playSingleClip(clip)}
                        >
                          {previewMode && previewClipIdx === i ? <X size={11} /> : <Play size={11} fill="currentColor" />}
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ padding: "3px 8px", fontSize: 10 }}
                          onClick={() => toggleClip(clip)}>
                          {clip.included ? "제외" : "포함"}
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ padding: "3px 6px" }}
                          onClick={() => deleteClip(clip.id)}>
                          <Trash2 size={11} />
                        </button>
                      </div>

                      {/* 하단: AI 추천 이유 */}
                      {clip.note && (
                        <div style={{
                          marginTop: 5, marginLeft: 28, fontSize: 11,
                          color: "var(--text-muted)", fontStyle: "italic",
                          padding: "4px 8px", borderRadius: 6,
                          background: "rgba(99,102,241,0.03)", borderLeft: "2px solid rgba(99,102,241,0.2)",
                        }}>
                          {clip.note}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* 타임라인 총 길이 바 */}
                  {totalClipSec > 0 && (
                    <div style={{ margin: "12px 0 8px" }}>
                      <div style={{
                        display: "flex", justifyContent: "space-between",
                        fontSize: 10, color: "var(--text-muted)", marginBottom: 4,
                      }}>
                        <span>요약 편집 타임라인</span>
                        <span>{formatDuration(totalClipSec)} / 3~5분</span>
                      </div>
                      <div style={{
                        height: 6, borderRadius: 3, background: "var(--bg-elevated)",
                        overflow: "hidden", position: "relative",
                      }}>
                        <div style={{
                          height: "100%", borderRadius: 3,
                          width: `${Math.min(100, (totalClipSec / 300) * 100)}%`,
                          background: totalClipSec >= 180 && totalClipSec <= 300
                            ? "linear-gradient(90deg, #10b981, #22c55e)"
                            : totalClipSec < 180
                              ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                              : "linear-gradient(90deg, #ef4444, #f87171)",
                          transition: "width 0.3s ease",
                        }} />
                        {/* 3분 마커 */}
                        <div style={{
                          position: "absolute", top: 0, left: `${(180 / 300) * 100}%`,
                          width: 1, height: "100%", background: "rgba(255,255,255,0.3)",
                        }} />
                      </div>
                    </div>
                  )}

                  {/* 수동 클립 추가 */}
                  <div style={{
                    display: "flex", gap: 8, marginTop: 10, padding: "10px 0",
                    borderTop: "1px solid var(--border-subtle)", alignItems: "center",
                  }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>수동 추가:</span>
                    <input className="input" value={newClipStart} onChange={e => setNewClipStart(e.target.value)}
                      placeholder="시작" style={{ width: 85, fontSize: 11, fontFamily: "JetBrains Mono" }} />
                    <ArrowRight size={12} color="var(--text-muted)" />
                    <input className="input" value={newClipEnd} onChange={e => setNewClipEnd(e.target.value)}
                      placeholder="끝" style={{ width: 85, fontSize: 11, fontFamily: "JetBrains Mono" }} />
                    <select className="input" value={newClipLabel} onChange={e => setNewClipLabel(e.target.value)}
                      style={{ width: 90, fontSize: 11 }}>
                      {CLIP_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <button className="btn btn-brand btn-sm" onClick={addClip} style={{ gap: 4, whiteSpace: "nowrap", fontSize: 11 }}>
                      <Plus size={11} />추가
                    </button>
                  </div>
                </div>
              </div>

              {/* ── STEP 2: HD 영상 저장 (yt-dlp + ffmpeg) ─────── */}
              <div className="card" style={{ overflow: "hidden" }}>
                <div style={{
                  padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>
                      <span style={{ color: "#06b6d4", marginRight: 6 }}>②</span>
                      HD 영상 저장
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      yt-dlp + FFmpeg로 선택된 클립을 HD MP4로 다운로드합니다 · {selected.editClips?.filter(c => c.included).length || 0}개 클립 / {formatDuration(totalClipSec)}
                    </div>
                  </div>
                </div>

                <div style={{ padding: "12px 16px" }}>
                  {/* 전체 병합 다운로드 버튼 */}
                  <button
                    className="btn btn-brand btn-sm"
                    style={{
                      gap: 6, padding: "10px 20px", fontSize: 13,
                      background: "linear-gradient(135deg, #06b6d4, #0ea5e9)",
                      borderColor: "#06b6d4",
                      marginBottom: 12,
                    }}
                    disabled={downloading !== null || totalClipSec === 0}
                    onClick={() => handleDownload("merged")}
                  >
                    {downloading === "merged" ? (
                      <><Loader size={13} style={{ animation: "spin 0.9s linear infinite" }} />{downloadMessage || "준비 중..."}</>
                    ) : (
                      <><Download size={13} />🎬 전체 클립 병합 HD 다운로드 ({selected.editClips?.filter(c => c.included).length}개 · {formatDuration(totalClipSec)})</>
                    )}
                  </button>

                  {/* 다운로드 프로그레스 바 */}
                  {downloading && (
                    <div style={{
                      marginBottom: 12, padding: "10px 14px", borderRadius: 8,
                      background: "rgba(6,182,212,0.05)", border: "1px solid rgba(6,182,212,0.2)",
                    }}>
                      <div style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        marginBottom: 6,
                      }}>
                        <span style={{ fontSize: 11, color: "#67e8f9", display: "flex", alignItems: "center", gap: 6 }}>
                          <Loader size={11} style={{ animation: "spin 0.9s linear infinite" }} />
                          {downloadMessage || "처리 중..."}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#06b6d4" }}>
                          {downloadProgress}%
                        </span>
                      </div>
                      <div style={{
                        height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)",
                        overflow: "hidden",
                      }}>
                        <div style={{
                          height: "100%", borderRadius: 3,
                          width: `${downloadProgress}%`,
                          background: "linear-gradient(90deg, #06b6d4, #22d3ee, #67e8f9)",
                          transition: "width 0.3s ease",
                        }} />
                      </div>
                    </div>
                  )}

                  {downloadError && (
                    <div style={{
                      padding: "8px 12px", borderRadius: 6, marginBottom: 10,
                      background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)",
                      display: "flex", gap: 8, alignItems: "center",
                    }}>
                      <AlertCircle size={13} color="#f87171" />
                      <span style={{ fontSize: 12, color: "#fca5a5" }}>{downloadError}</span>
                    </div>
                  )}

                  {/* 개별 클립 다운로드 목록 */}
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, fontWeight: 600 }}>
                    개별 클립 다운로드
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {(selected.editClips || []).filter(c => c.included).map((clip, i) => (
                      <div key={clip.id} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "6px 10px", borderRadius: 6,
                        background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
                      }}>
                        <span style={{
                          fontSize: 10, fontWeight: 800, color: "#06b6d4", width: 18,
                          height: 18, borderRadius: "50%", background: "rgba(6,182,212,0.1)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>{i + 1}</span>
                        <span style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "var(--text-secondary)" }}>
                          {clip.startTime} → {clip.endTime}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>({Math.round(clipDuration(clip))}초)</span>
                        {clip.label && <span className="badge badge-brand" style={{ fontSize: 9 }}>{clip.label}</span>}
                        <div style={{ flex: 1 }} />
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ padding: "3px 10px", fontSize: 10, gap: 4 }}
                          disabled={downloading !== null}
                          onClick={() => handleDownload("single", clip)}
                        >
                          {downloading === clip.id ? (
                            <><Loader size={10} style={{ animation: "spin 0.9s linear infinite" }} />{downloadProgress}%</>
                          ) : (
                            <><Download size={10} />MP4 저장</>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── STEP 3: 다운로드 영상 관리 ─────────── */}
              <div className="card" style={{ padding: "14px 16px" }}>
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10,
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>
                      <span style={{ color: "#8b5cf6", marginRight: 6 }}>③</span>
                      다운로드 영상 관리
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      HD 저장된 영상을 자막 스튜디오로 전송하여 자막·보이스 작업을 진행합니다.
                    </div>
                  </div>
                  {downloadedVideos.length > 0 && (
                    <span className="badge badge-brand" style={{ fontSize: 10 }}>
                      {downloadedVideos.length}개 영상
                    </span>
                  )}
                </div>

                {downloadedVideos.length === 0 ? (
                  <div style={{
                    padding: "24px 16px", textAlign: "center", borderRadius: 8,
                    background: "var(--bg-elevated)", border: "1px dashed var(--border-subtle)",
                  }}>
                    <Download size={24} color="var(--text-muted)" style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      위 ② HD 영상 저장에서 클립을 다운로드하면<br />여기에 자동으로 표시됩니다.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                    {downloadedVideos.map((vid) => (
                      <div key={vid.id} style={{
                        borderRadius: 10, overflow: "hidden",
                        background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
                        transition: "border-color 0.2s",
                      }}>
                        {/* 썸네일 (비디오 첫 프레임) */}
                        <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: "#000" }}>
                          <video
                            src={vid.url}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            muted
                            preload="metadata"
                            onLoadedData={(e) => {
                              const v = e.currentTarget;
                              v.currentTime = 1; // 1초 지점 썸네일
                            }}
                          />
                          {/* 재생 오버레이 */}
                          <div
                            style={{
                              position: "absolute", inset: 0,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              background: "rgba(0,0,0,0.25)", cursor: "pointer",
                              transition: "background 0.2s",
                            }}
                            onClick={() => window.open(vid.url, "_blank")}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.1)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.25)")}
                          >
                            <Play size={20} color="#fff" fill="#fff" />
                          </div>
                          {/* 배지 */}
                          <div style={{
                            position: "absolute", top: 6, right: 6,
                            fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                            background: vid.mode === "merged" ? "rgba(6,182,212,0.85)" : "rgba(139,92,246,0.85)",
                            color: "#fff", backdropFilter: "blur(4px)",
                          }}>
                            {vid.mode === "merged" ? `병합 ${vid.clipCount}클립` : "개별 클립"}
                          </div>
                        </div>
                        {/* 정보 */}
                        <div style={{ padding: "8px 10px" }}>
                          <div style={{
                            fontSize: 11, fontWeight: 600, color: "var(--text-primary)",
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            marginBottom: 4,
                          }}>
                            {vid.filename}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 8 }}>
                            {(vid.size / 1024 / 1024).toFixed(1)} MB · {vid.createdAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            {/* 자막스튜디오 전송 버튼 */}
                            <Link href="/dashboard/studio" style={{ flex: 1 }}>
                              <button
                                className="btn btn-brand btn-sm"
                                style={{
                                  width: "100%", gap: 6, fontSize: 11, padding: "6px 10px",
                                  background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                                  borderColor: "#8b5cf6",
                                }}
                                onClick={() => {
                                  sessionStorage.setItem("studio_data", JSON.stringify({
                                    videoId: "",
                                    ytVideoId: selected.ytVideoId,
                                    videoTitle: selected.title,
                                    channelTitle: selected.channel,
                                    title: selected.titleKo || selected.title,
                                    downloadedFileUrl: `https://kcontentshub.twinverse.org/api/downloads/${encodeURIComponent(vid.filename)}`,
                                    downloadedFilename: vid.filename,
                                    thumbnailTop: "",
                                    thumbnailBottom: "",
                                    script: selected.scriptJson ? JSON.parse(selected.scriptJson) : [],
                                  }));
                                }}
                              >
                                <Film size={11} />자막 스튜디오로 전송
                              </button>
                            </Link>
                            {/* 목록에서만 제거 (파일 유지) */}
                            <button
                              className="btn btn-sm"
                              style={{
                                padding: "6px 8px", fontSize: 11,
                                background: "rgba(148,163,184,0.1)", color: "#94a3b8",
                                border: "1px solid rgba(148,163,184,0.3)", borderRadius: 6,
                              }}
                              title="목록에서만 제거 (서버 파일은 유지)"
                              onClick={async () => {
                                if (!confirm(`"${vid.filename}"\n목록에서만 제거합니다. 서버 파일은 유지됩니다.`)) return;
                                try {
                                  const res = await fetch("/api/downloads", {
                                    method: "DELETE",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ id: vid.id, deleteFile: false }),
                                  });
                                  if (res.ok) {
                                    setDownloadedVideos(prev => prev.filter(v => v.id !== vid.id));
                                  } else {
                                    const data = await res.json();
                                    alert(`실패: ${data.error}`);
                                  }
                                } catch (e) { alert(`오류: ${e}`); }
                              }}
                            >
                              ✕
                            </button>
                            {/* 파일까지 완전 삭제 */}
                            <button
                              className="btn btn-sm"
                              style={{
                                padding: "6px 8px", fontSize: 11,
                                background: "rgba(239,68,68,0.1)", color: "#f87171",
                                border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6,
                              }}
                              title="서버 파일까지 완전 삭제"
                              onClick={async () => {
                                if (!confirm(`⚠️ "${vid.filename}"\n서버 파일과 DB 레코드를 모두 삭제합니다.\n이 작업은 되돌릴 수 없습니다!`)) return;
                                try {
                                  const res = await fetch("/api/downloads", {
                                    method: "DELETE",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ id: vid.id, deleteFile: true }),
                                  });
                                  if (res.ok) {
                                    setDownloadedVideos(prev => prev.filter(v => v.id !== vid.id));
                                  } else {
                                    const data = await res.json();
                                    alert(`삭제 실패: ${data.error}`);
                                  }
                                } catch (e) { alert(`삭제 오류: ${e}`); }
                              }}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── STEP 6: AI 대본 생성 ──────────────── */}
              <div className="card" style={{ padding: "14px 16px" }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
                  <span style={{ color: "#10b981", marginRight: 6 }}>⑤</span>
                  AI 대본 생성
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, lineHeight: 1.6 }}>
                  한글 자막을 바탕으로 K-문화 서사 대본을 GPT-4o로 자동 생성합니다. 훅 → 반응 → 나레이션 → 해설 구조.
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button className="btn btn-brand btn-sm" style={{ gap: 6 }}
                    onClick={() => processAction("generate_script")}
                    disabled={processing !== null || !selected.translatedJson}>
                    {processing === "generate_script" ? (
                      <><Loader size={12} style={{ animation: "spin 0.9s linear infinite" }} />생성 중...</>
                    ) : (
                      <><Zap size={12} />AI 대본 생성</>
                    )}
                  </button>
                  {selected.scriptJson && (
                    <span className="badge badge-green" style={{ fontSize: 10 }}>
                      ✓ {JSON.parse(selected.scriptJson).length}씬 대본 완료
                    </span>
                  )}
                  {selected.titleKo && (
                    <span style={{ fontSize: 12, color: "#10b981", fontWeight: 600 }}>
                      {selected.titleKo}
                    </span>
                  )}
                </div>

                {/* 대본 미리보기 */}
                {selected.scriptJson && (
                  <div style={{ marginTop: 10, maxHeight: 200, overflowY: "auto", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
                    {(JSON.parse(selected.scriptJson) as { time: string; type: string; ko: string }[]).map((scene, i) => (
                      <div key={i} style={{ display: "flex", padding: "6px 10px", borderBottom: "1px solid var(--border-subtle)", gap: 10 }}>
                        <span style={{ fontSize: 11, fontFamily: "JetBrains Mono", color: "var(--text-muted)", width: 50, flexShrink: 0 }}>{scene.time}</span>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 3, flexShrink: 0,
                          color: scene.type === "hook" ? "#f59e0b" : scene.type === "reaction" ? "#6366f1" : scene.type === "narration" ? "#10b981" : "#ec4899",
                          background: scene.type === "hook" ? "#f59e0b18" : scene.type === "reaction" ? "#6366f118" : scene.type === "narration" ? "#10b98118" : "#ec489918",
                        }}>
                          {scene.type}
                        </span>
                        <div style={{ fontSize: 12, color: "var(--text-primary)", flex: 1 }}>{scene.ko}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 자막 스튜디오 연동 */}
                {selected.scriptJson && (
                  <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                    <Link href="/dashboard/studio">
                      <button className="btn btn-brand btn-sm" onClick={() => {
                        sessionStorage.setItem("studio_data", JSON.stringify({
                          videoId: selected.ytVideoId,
                          videoTitle: selected.title,
                          channelTitle: selected.channel,
                          title: selected.titleKo || selected.title,
                          thumbnailTop: "",
                          thumbnailBottom: "",
                          script: JSON.parse(selected.scriptJson || "[]"),
                        }));
                      }} style={{ gap: 6 }}>
                        <Film size={12} />자막 스튜디오로 이동
                      </button>
                    </Link>
                  </div>
                )}
              </div>

              {/* 에러/성공 메시지 */}
              {error && (
                <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <AlertCircle size={15} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 13, color: "#fca5a5" }}>{error}</div>
                  <button style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#f87171" }} onClick={() => setError(null)}><X size={12} /></button>
                </div>
              )}
              {processResult?.success && (
                <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.25)", display: "flex", gap: 10, alignItems: "center" }}>
                  <Check size={15} color="#34d399" />
                  <div style={{ fontSize: 13, color: "#6ee7b7" }}>{processResult.message}</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>



      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}
