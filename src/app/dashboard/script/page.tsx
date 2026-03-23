"use client";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Link2, Sparkles, Copy, Check, Film,
  Zap, AlertCircle, Loader, CheckCircle2, Image as ImageIcon,
  Camera, X, Download, Maximize2, Trash2, Clock, FileText, ChevronRight
} from "lucide-react";

type ScriptLine = { time: string; type: string; ko: string };

type Result = {
  videoId: string;
  videoTitle: string;
  channelTitle: string;
  hasTranscript: boolean;
  title: string;
  thumbnailTop: string;
  thumbnailBottom: string;
  script: ScriptLine[];
};

type FrameData = {
  time: string;
  imageUrl: string;
  type?: "storyboard" | "thumbnail";
  bgX: number; bgY: number;
  frameW: number; frameH: number;
  sheetW: number; sheetH: number;
};

type CapturedImage = {
  id: string;
  name: string;
  dataUrl: string;
  time: string;
  sceneType: string;
  sceneText: string;
  capturedAt: number;
};

type SavedScript = {
  id: string;
  videoId: string;
  videoTitle: string;
  channelTitle: string | null;
  hasTranscript: boolean;
  title: string;
  thumbnailTop: string | null;
  thumbnailBottom: string | null;
  sceneCount: number;
  createdAt: string;
};

const TYPE_COLOR: Record<string, string> = {
  hook: "#f59e0b", reaction: "#6366f1", narration: "#10b981", commentary: "#ec4899",
};
const TYPE_LABEL: Record<string, string> = {
  hook: "훅", reaction: "반응", narration: "나레이션", commentary: "해설",
};

/* ── YouTube IFrame Player 타입 ────────────────────────── */
import type { YTPlayer } from "@/lib/youtube-player";


/* ── 타임코드 → 초 ──────────────────────────────────────── */
function timeToSec(t: string): number {
  const p = t.split(":").map(Number);
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  return p[0] * 60 + (p[1] || 0);
}

/* ── 스토리보드 프레임 미니 컴포넌트 ────────────────────── */
function SceneFrame({ frame }: { frame: FrameData }) {
  const W = 160, H = 90;

  if (frame.type === "thumbnail") {
    return (
      <div style={{ width: W, height: H, borderRadius: 6, overflow: "hidden", border: "1px solid var(--border-subtle)", background: "#111" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={frame.imageUrl} alt="scene" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
    );
  }

  const scale = W / frame.frameW;
  return (
    <div style={{ width: W, height: H, borderRadius: 6, overflow: "hidden", border: "1px solid var(--border-subtle)", background: "#111" }}>
      <div style={{
        width: W, height: H,
        backgroundImage: `url(${frame.imageUrl})`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: `${frame.bgX * scale}px ${frame.bgY * scale}px`,
        backgroundSize: `${frame.sheetW * scale}px ${frame.sheetH * scale}px`,
      }} />
    </div>
  );
}

/* ── 전체화면 프레임 뷰어 모달 ───────────────────────────── */
function FrameViewerModal({
  videoId,
  frame,
  line,
  lineIndex,
  videoTitle,
  onClose,
  onCapture,
}: {
  videoId: string;
  frame: FrameData;
  line: ScriptLine;
  lineIndex: number;
  videoTitle: string;
  onClose: () => void;
  onCapture: (cap: CapturedImage) => void;
}) {
  const [ytReady, setYtReady] = useState(false);
  const [playerLoaded, setPlayerLoaded] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captured, setCaptured] = useState(false);
  const playerRef = useRef<YTPlayer | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // YouTube IFrame API 로드
  useEffect(() => {
    if (window.YT) { setYtReady(true); return; }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => setYtReady(true);
  }, []);

  // 플레이어 생성 — 해당 시점에 정지 상태로 시작
  useEffect(() => {
    if (!ytReady) return;

    const startSec = timeToSec(frame.time);

    playerRef.current = new window.YT.Player("modal-yt-player", {
      videoId,
      width: "100%",
      height: "100%",
      playerVars: {
        autoplay: 0,
        controls: 1,
        modestbranding: 1,
        rel: 0,
        start: Math.floor(startSec),
        playsinline: 1,
      },
      events: {
        onReady: (e: { target: YTPlayer }) => {
          e.target.seekTo(startSec, true);
          e.target.pauseVideo();
          setPlayerLoaded(true);
        },
      },
    } as Record<string, unknown>);

    return () => {
      try { playerRef.current?.destroy(); } catch { /* ignore */ }
    };
  }, [ytReady, videoId, frame.time]);

  // ESC 키로 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // 캡처 기능 — 스토리보드 프레임을 Canvas로 렌더링하여 저장
  const handleCapture = useCallback(async () => {
    setCapturing(true);
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (frame.type === "storyboard") {
        // 스토리보드 스프라이트 시트에서 프레임 추출
        const img = new Image();
        img.crossOrigin = "anonymous";

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("이미지 로드 실패"));
          img.src = frame.imageUrl;
        });

        // 캔버스를 프레임 크기로 설정
        canvas.width = frame.frameW;
        canvas.height = frame.frameH;

        // 스프라이트 시트에서 해당 프레임만 잘라서 그리기
        const sx = Math.abs(frame.bgX);
        const sy = Math.abs(frame.bgY);

        ctx.drawImage(img, sx, sy, frame.frameW, frame.frameH, 0, 0, frame.frameW, frame.frameH);
      } else {
        // 썸네일 직접 사용
        const img = new Image();
        img.crossOrigin = "anonymous";

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("이미지 로드 실패"));
          img.src = frame.imageUrl;
        });

        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
      }

      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

      // 자동 이름 생성: scene_01_00m30s_hook
      const sceneNum = String(lineIndex + 1).padStart(2, "0");
      const timeParts = frame.time.split(":").map(Number);
      const timeLabel = timeParts.length === 3
        ? `${timeParts[0]}h${String(timeParts[1]).padStart(2, "0")}m${String(timeParts[2]).padStart(2, "0")}s`
        : `${String(timeParts[0]).padStart(2, "0")}m${String(timeParts[1] || 0).padStart(2, "0")}s`;
      
      const name = `scene_${sceneNum}_${timeLabel}_${line.type}`;

      const captured: CapturedImage = {
        id: `${Date.now()}_${lineIndex}`,
        name,
        dataUrl,
        time: frame.time,
        sceneType: line.type,
        sceneText: line.ko,
        capturedAt: Date.now(),
      };

      onCapture(captured);
      setCaptured(true);
      setTimeout(() => setCaptured(false), 1500);
    } catch (e) {
      console.error("캡처 실패:", e);
    } finally {
      setCapturing(false);
    }
  }, [frame, line, lineIndex, onCapture]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 1000 }}>
        {/* 헤더 */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 12, padding: "0 4px",
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "white" }}>
              씬 {lineIndex + 1} — {frame.time}
              <span style={{
                marginLeft: 8, fontSize: 10, fontWeight: 700,
                color: TYPE_COLOR[line.type] ?? "#aaa",
                background: (TYPE_COLOR[line.type] ?? "#aaa") + "20",
                padding: "2px 8px", borderRadius: 4,
              }}>
                {TYPE_LABEL[line.type] ?? line.type}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
              {line.ko}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {/* 캡처 버튼 */}
            <button
              onClick={handleCapture}
              disabled={capturing}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 8,
                background: captured ? "#10b981" : "var(--gradient-brand, linear-gradient(135deg, #6366f1, #818cf8))",
                border: "none", cursor: "pointer", color: "white",
                fontSize: 13, fontWeight: 700,
                boxShadow: "0 0 20px rgba(99,102,241,0.3)",
                transition: "all 0.2s",
              }}
            >
              {capturing ? (
                <><Loader size={14} style={{ animation: "spin 0.9s linear infinite" }} />캡처 중...</>
              ) : captured ? (
                <><Check size={14} />캡처 완료!</>
              ) : (
                <><Camera size={14} />프레임 캡처</>
              )}
            </button>

            {/* 닫기 */}
            <button onClick={onClose} style={{
              width: 36, height: 36, borderRadius: 8,
              background: "rgba(255,255,255,0.1)", border: "none",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <X size={18} color="white" />
            </button>
          </div>
        </div>

        {/* YouTube 플레이어 (정지 상태) */}
        <div style={{
          width: "100%", aspectRatio: "16/9", borderRadius: 12, overflow: "hidden",
          background: "#000", border: "1px solid rgba(255,255,255,0.1)",
          position: "relative",
        }}>
          <div id="modal-yt-player" style={{ width: "100%", height: "100%" }} />
          {!playerLoaded && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(0,0,0,0.8)",
            }}>
              <Loader size={24} color="#818cf8" style={{ animation: "spin 1s linear infinite" }} />
            </div>
          )}
        </div>

        {/* 안내 */}
        <div style={{
          marginTop: 12, textAlign: "center",
          fontSize: 11, color: "rgba(255,255,255,0.35)",
        }}>
          영상을 원하는 시점으로 이동 후 &quot;프레임 캡처&quot; 클릭 · ESC로 닫기
        </div>
      </div>

      {/* 숨겨진 캔버스 (캡처용) */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}

/* ── 캡처 갤러리 컴포넌트 ────────────────────────────────── */
function CaptureGallery({
  captures,
  onDelete,
  onDownload,
  onSendToStudio,
}: {
  captures: CapturedImage[];
  onDelete: (id: string) => void;
  onDownload: (cap: CapturedImage) => void;
  onSendToStudio: () => void;
}) {
  if (captures.length === 0) return null;

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div style={{
        padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>캡처된 프레임</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            {captures.length}개 캡처 · 편집 스튜디오에서 소재로 활용
          </div>
        </div>
        <button className="btn btn-brand btn-sm" onClick={onSendToStudio}
          style={{ gap: 6 }}>
          <Film size={12} />스튜디오로 전송
        </button>
      </div>

      <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
        {captures.map(cap => (
          <div key={cap.id} style={{
            borderRadius: 8, overflow: "hidden",
            background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
            transition: "border-color 0.15s",
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cap.dataUrl} alt={cap.name}
              style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }}
            />
            <div style={{ padding: "8px 10px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4, wordBreak: "break-all" }}>
                {cap.name}.jpg
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6 }}>
                {cap.time} · {TYPE_LABEL[cap.sceneType] ?? cap.sceneType}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => onDownload(cap)}
                  style={{ flex: 1, fontSize: 10, padding: "4px", gap: 4 }}>
                  <Download size={10} />저장
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => onDelete(cap.id)}
                  style={{ padding: "4px 8px", fontSize: 10 }}>
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 메인 페이지 ─────────────────────────────────────────── */
function ScriptPageInner() {
  const searchParams = useSearchParams();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [frames, setFrames] = useState<Record<string, FrameData>>({});
  const [loadingFrames, setLoadingFrames] = useState(false);
  const [copied, setCopied] = useState(false);

  // 전체화면 프레임 뷰어 상태
  const [modalScene, setModalScene] = useState<{
    lineIndex: number;
    line: ScriptLine;
    frame: FrameData;
  } | null>(null);

  // 캡처된 이미지 목록
  const [captures, setCaptures] = useState<CapturedImage[]>([]);

  // 저장된 대본 목록
  const [savedScripts, setSavedScripts] = useState<SavedScript[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [loadingScript, setLoadingScript] = useState<string | null>(null);

  // 페이지 진입 시 저장된 대본 목록 로드
  useEffect(() => {
    fetchSavedScripts();
    const u = searchParams.get("url");
    if (u) setUrl(decodeURIComponent(u));
  }, [searchParams]);

  const fetchSavedScripts = async () => {
    setLoadingSaved(true);
    try {
      const res = await fetch("/api/script");
      const data = await res.json();
      if (res.ok && data.scripts) {
        setSavedScripts(data.scripts);
      }
    } catch { /* 무시 */ }
    finally { setLoadingSaved(false); }
  };

  // DB에서 대본 불러오기
  const loadSavedScript = async (id: string) => {
    setLoadingScript(id);
    try {
      const res = await fetch(`/api/script/${id}`);
      const data = await res.json();
      if (res.ok && data.script) {
        setResult({
          videoId: data.videoId,
          videoTitle: data.videoTitle,
          channelTitle: data.channelTitle || "",
          hasTranscript: data.hasTranscript,
          title: data.title,
          thumbnailTop: data.thumbnailTop || "",
          thumbnailBottom: data.thumbnailBottom || "",
          script: data.script,
        });
        setFrames({});
        setCaptures([]);
        // 프레임도 다시 로드
        if (data.videoId && data.script?.length) {
          loadFrames(data.videoId, data.script);
        }
      }
    } catch { /* 무시 */ }
    finally { setLoadingScript(null); }
  };

  // DB에서 대본 삭제
  const deleteSavedScript = async (id: string) => {
    try {
      await fetch(`/api/script?id=${id}`, { method: "DELETE" });
      setSavedScripts(prev => prev.filter(s => s.id !== id));
    } catch { /* 무시 */ }
  };

  // 대본 DB 저장
  const saveToDb = async (data: Result) => {
    try {
      await fetch("/api/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: data.videoId,
          videoTitle: data.videoTitle,
          channelTitle: data.channelTitle,
          hasTranscript: data.hasTranscript,
          title: data.title,
          thumbnailTop: data.thumbnailTop,
          thumbnailBottom: data.thumbnailBottom,
          script: data.script,
        }),
      });
      // 목록 갱신
      fetchSavedScripts();
    } catch { /* 저장 실패 무시 */ }
  };

  const generate = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setFrames({});
    setCaptures([]);

    try {
      const res = await fetch("/api/script/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "알 수 없는 오류");
        return;
      }
      setResult(data);

      // 자동 DB 저장
      saveToDb(data);

      if (data.videoId && data.script?.length) {
        loadFrames(data.videoId, data.script);
      }
    } catch (e) {
      setError(`네트워크 오류: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const loadFrames = async (videoId: string, script: ScriptLine[]) => {
    setLoadingFrames(true);
    try {
      const res = await fetch("/api/script/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId,
          timestamps: script.map(l => l.time),
        }),
      });
      const data = await res.json();
      if (res.ok && data.frames) {
        const frameMap: Record<string, FrameData> = {};
        for (const f of data.frames as FrameData[]) {
          frameMap[f.time] = f;
        }
        setFrames(frameMap);
      }
    } catch { /* 스토리보드 실패는 무시 */ }
    finally { setLoadingFrames(false); }
  };

  const copyAll = () => {
    if (!result) return;
    const text = result.script.map(l => `${l.time}  [${TYPE_LABEL[l.type] ?? l.type}]  ${l.ko}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  /* 캡처 핸들러 */
  const handleCapture = useCallback((cap: CapturedImage) => {
    setCaptures(prev => {
      // 같은 씬 중복 방지
      const filtered = prev.filter(c => c.time !== cap.time);
      return [...filtered, cap];
    });
  }, []);

  const handleDeleteCapture = useCallback((id: string) => {
    setCaptures(prev => prev.filter(c => c.id !== id));
  }, []);

  const handleDownloadCapture = useCallback((cap: CapturedImage) => {
    const a = document.createElement("a");
    a.href = cap.dataUrl;
    a.download = `${cap.name}.jpg`;
    a.click();
  }, []);

  const sendToStudio = useCallback(() => {
    if (!result) return;
    sessionStorage.setItem("studio_data", JSON.stringify({
      videoId: result.videoId,
      videoTitle: result.videoTitle,
      channelTitle: result.channelTitle,
      title: result.title,
      thumbnailTop: result.thumbnailTop,
      thumbnailBottom: result.thumbnailBottom,
      script: result.script,
      captures: captures.map(c => ({ name: c.name, dataUrl: c.dataUrl, time: c.time, sceneType: c.sceneType })),
    }));
    window.location.href = "/dashboard/studio";
  }, [result, captures]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 1100 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>AI 대본 엔진</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          YouTube URL → 실제 자막 추출 + GPT-4o → K-문화 한국어 대본 · 씬별 영상 프레임
        </p>
      </div>

      {/* URL 입력 */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div className="input-group" style={{ flex: 1 }}>
            <Link2 size={15} className="input-icon" />
            <input
              className="input" value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !loading && generate()}
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </div>
          <button className="btn btn-brand" onClick={generate} disabled={loading || !url.trim()}
            style={{ padding: "0 22px", gap: 7, whiteSpace: "nowrap" }}>
            {loading
              ? <><Loader size={14} style={{ animation: "spin 0.9s linear infinite" }} />생성 중...</>
              : <><Sparkles size={14} />K-문화 대본 생성</>}
          </button>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-muted)" }}>
          {[
            { icon: <Zap size={11} />,        text: "실제 YouTube 자막 추출" },
            { icon: <Sparkles size={11} />,    text: "GPT-4o 대본 생성" },
            { icon: <Camera size={11} />,      text: "프레임 캡처 → 스튜디오 전달" },
          ].map(({ icon, text }, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>{icon}{text}</span>
          ))}
        </div>
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <Loader size={28} color="#818cf8" style={{ animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>YouTube 자막 추출 + GPT-4o 대본 생성 중...</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>실제 API를 호출 중입니다. 10~30초 소요됩니다.</div>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <AlertCircle size={16} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: "#fca5a5", lineHeight: 1.6 }}>{error}</div>
        </div>
      )}

      {/* 결과 */}
      {result && (
        <>
          {/* 메타 정보 */}
          <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)", display: "flex", alignItems: "center", gap: 8, fontSize: 12, flexWrap: "wrap" }}>
            <CheckCircle2 size={14} color="#818cf8" />
            <span style={{ color: "#a5b4fc" }}>
              <strong>{result.channelTitle || "알 수 없는 채널"}</strong>
              {result.videoTitle && ` — ${result.videoTitle}`}
            </span>
            <span style={{ marginLeft: "auto", color: result.hasTranscript ? "#34d399" : "#fbbf24" }}>
              {result.hasTranscript ? "✓ 실제 자막 기반" : "⚠ 자막 없음 (제목/설명 기반)"}
            </span>
            {loadingFrames && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#818cf8" }}>
                <Loader size={11} style={{ animation: "spin 1s linear infinite" }} />영상 프레임 로딩 중...
              </span>
            )}
          </div>

          {/* AI 생성 제목 */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>AI 생성 제목</div>
            <input className="input" defaultValue={result.title} style={{ fontSize: 15, fontWeight: 600 }} />
          </div>

          {/* 썸네일 카피 */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>썸네일 카피</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 5 }}>상단 텍스트</label>
                <input className="input" defaultValue={result.thumbnailTop} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 5 }}>하단 텍스트 (임팩트)</label>
                <input className="input" defaultValue={result.thumbnailBottom} />
              </div>
            </div>
          </div>

          {/* 자막 타임라인 */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>자막 타임라인</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  {result.script.length}개 장면 · 프레임 클릭 → 전체화면 보기 · 캡처 버튼으로 이미지 저장
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={copyAll}>
                  {copied ? <><Check size={12} color="#34d399" />복사됨</> : <><Copy size={12} />전체 복사</>}
                </button>
                <button className="btn btn-brand btn-sm" onClick={sendToStudio}>
                  <Film size={12} />편집 스튜디오로
                </button>
              </div>
            </div>

            {/* 타입 범례 */}
            <div style={{ padding: "10px 18px", borderBottom: "1px solid var(--border-subtle)", display: "flex", gap: 12, flexWrap: "wrap" }}>
              {Object.entries(TYPE_COLOR).map(([type, color]) => (
                <span key={type} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-muted)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: "inline-block" }} />
                  {TYPE_LABEL[type]}
                </span>
              ))}
              {Object.keys(frames).length > 0 && (
                <span style={{ marginLeft: "auto", fontSize: 11, color: "#818cf8" }}>
                  ✓ {Object.keys(frames).length}개 씬 프레임 로드됨
                </span>
              )}
              {captures.length > 0 && (
                <span style={{ fontSize: 11, color: "#10b981" }}>
                  📸 {captures.length}개 캡처됨
                </span>
              )}
            </div>

            {/* 씬 목록 */}
            {result.script.map((line, i) => {
              const frame = frames[line.time];
              const isCaptured = captures.some(c => c.time === line.time);
              return (
                <div key={i}
                  style={{ display: "flex", alignItems: "stretch", borderBottom: "1px solid rgba(30,30,46,0.5)", transition: "background 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.015)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}>

                  {/* 타임코드 */}
                  <div style={{ width: 72, flexShrink: 0, padding: "14px", borderRight: "1px solid var(--border-subtle)", fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
                    {line.time}
                  </div>

                  {/* 씬 프레임 — 클릭하면 전체화면 모달 */}
                  <div
                    style={{
                      width: 172, flexShrink: 0, borderRight: "1px solid var(--border-subtle)",
                      padding: 6, display: "flex", alignItems: "center", justifyContent: "center",
                      background: "rgba(0,0,0,0.15)", cursor: frame ? "pointer" : "default",
                      position: "relative",
                    }}
                    onClick={() => {
                      if (frame && result) {
                        setModalScene({ lineIndex: i, line, frame });
                      }
                    }}
                  >
                    {frame ? (
                      <>
                        <SceneFrame frame={frame} />
                        {/* 전체화면 아이콘 오버레이 */}
                        <div style={{
                          position: "absolute", inset: 6, borderRadius: 6,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: "rgba(0,0,0,0.4)", opacity: 0,
                          transition: "opacity 0.15s",
                        }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                          onMouseLeave={e => (e.currentTarget.style.opacity = "0")}
                        >
                          <Maximize2 size={20} color="white" />
                        </div>
                        {/* 캡처됨 표시 */}
                        {isCaptured && (
                          <div style={{
                            position: "absolute", top: 8, right: 8,
                            width: 18, height: 18, borderRadius: 9,
                            background: "#10b981", display: "flex",
                            alignItems: "center", justifyContent: "center",
                          }}>
                            <Check size={10} color="white" />
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ width: 160, height: 90, borderRadius: 6, background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {loadingFrames
                          ? <Loader size={14} color="var(--text-muted)" style={{ animation: "spin 1s linear infinite" }} />
                          : <ImageIcon size={14} color="var(--border-subtle)" />}
                      </div>
                    )}
                  </div>

                  {/* 타입 뱃지 */}
                  <div style={{ width: 66, flexShrink: 0, borderRight: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: TYPE_COLOR[line.type] ?? "#aaa", background: (TYPE_COLOR[line.type] ?? "#aaa") + "18", padding: "3px 7px", borderRadius: 4, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                      {TYPE_LABEL[line.type] ?? line.type}
                    </span>
                  </div>

                  {/* 대사 */}
                  <div style={{ flex: 1, padding: "14px 16px", display: "flex", alignItems: "center" }}>
                    <textarea
                      defaultValue={line.ko}
                      rows={2}
                      style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "var(--text-primary)", fontSize: 13.5, lineHeight: 1.6, resize: "none", fontFamily: "Inter, sans-serif" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* 캡처 갤러리 */}
          <CaptureGallery
            captures={captures}
            onDelete={handleDeleteCapture}
            onDownload={handleDownloadCapture}
            onSendToStudio={sendToStudio}
          />
        </>
      )}

      {/* 저장된 대본 목록 + 초기 안내 */}
      {!loading && !result && !error && (
        <>
          {/* 저장된 대본 목록 */}
          {(savedScripts.length > 0 || loadingSaved) && (
            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{
                padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>저장된 대본</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    생성된 대본이 자동으로 저장됩니다 · 클릭하여 불러오기
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{savedScripts.length}개</div>
              </div>

              {loadingSaved ? (
                <div style={{ padding: 30, textAlign: "center" }}>
                  <Loader size={18} color="#818cf8" style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : (
                <div>
                  {savedScripts.map(s => (
                    <div key={s.id}
                      onClick={() => loadSavedScript(s.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 14,
                        padding: "12px 18px", cursor: "pointer",
                        borderBottom: "1px solid rgba(30,30,46,0.5)",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(99,102,241,0.04)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}
                    >
                      {/* 썸네일 */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://img.youtube.com/vi/${s.videoId}/mqdefault.jpg`}
                        alt={s.title}
                        style={{ width: 120, height: 68, objectFit: "cover", borderRadius: 6, flexShrink: 0, border: "1px solid var(--border-subtle)" }}
                      />

                      {/* 정보 */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.title}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 3 }}>
                          {s.channelTitle || s.videoTitle}
                        </div>
                        <div style={{ display: "flex", gap: 10, fontSize: 11, color: "var(--text-muted)" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            <FileText size={10} />{s.sceneCount}개 씬
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            <Clock size={10} />{new Date(s.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {s.hasTranscript && (
                            <span style={{ color: "#34d399" }}>✓ 실제 자막</span>
                          )}
                        </div>
                      </div>

                      {/* 로딩/액션 */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={e => { e.stopPropagation(); deleteSavedScript(s.id); }}
                          style={{ padding: "4px 6px", opacity: 0.5 }}
                        >
                          <Trash2 size={12} />
                        </button>
                        {loadingScript === s.id
                          ? <Loader size={14} color="#818cf8" style={{ animation: "spin 1s linear infinite" }} />
                          : <ChevronRight size={16} color="var(--text-muted)" />
                        }
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 초기 안내 (대본 없을 때만) */}
          {savedScripts.length === 0 && !loadingSaved && (
            <div style={{ textAlign: "center", padding: "50px 20px", color: "var(--text-muted)" }}>
              <Sparkles size={36} style={{ opacity: 0.2, margin: "0 auto 12px" }} />
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>YouTube URL을 입력하세요</div>
              <div style={{ fontSize: 13 }}>OpenAI API 키가 설정 페이지에 등록되어 있어야 합니다.</div>
            </div>
          )}
        </>
      )}

      {/* 전체화면 프레임 뷰어 모달 */}
      {modalScene && result && (
        <FrameViewerModal
          videoId={result.videoId}
          frame={modalScene.frame}
          line={modalScene.line}
          lineIndex={modalScene.lineIndex}
          videoTitle={result.title || result.videoTitle}
          onClose={() => setModalScene(null)}
          onCapture={handleCapture}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function ScriptPage() {
  return (
    <Suspense>
      <ScriptPageInner />
    </Suspense>
  );
}
