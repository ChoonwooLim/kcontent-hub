"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Play, Pause, Download, SkipBack, Volume2, VolumeX,
  Sparkles, Check, Link2, Loader, AlertCircle,
  Save, FolderOpen, Trash2, Clock, Camera, Languages, ArrowRight, Maximize2, Minimize2
} from "lucide-react";
import {
  LANGS, LANG_CODES, type LangCode, isLangCode,
  detectLangFromTexts, fontStackFor, toSRT, toVTT, normalizeCues,
} from "@/lib/subtitle-lang";

/* ── 타입 ────────────────────────────────────────────────── */
type SubLine = {
  id: number;
  start: number;   // 초 단위
  end: number;
  text: string;    // 현재 활성 언어 트랙의 텍스트 (오버레이·내보내기·대본엔진이 그대로 사용)
  type: string;
  texts?: Partial<Record<LangCode, string>>;  // 언어별 텍스트 트랙 (ko / en / ja / zh / zh-Hant)
};

type TranslateStyle = "broadcast" | "faithful";

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

const STYLE_LABELS: Record<TranslateStyle, { label: string; hint: string }> = {
  broadcast: { label: "방송 윤문", hint: "예능·다큐 작가 톤으로 맛깔나게 각색" },
  faithful: { label: "원문 충실", hint: "의미·정보량을 그대로 보존" },
};

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

/** 언어 트랙 맵에 한 언어의 텍스트를 기록한 새 맵 반환 */
function withTrack(texts: SubLine["texts"], lang: LangCode, text: string): Partial<Record<LangCode, string>> {
  const next: Partial<Record<LangCode, string>> = { ...(texts ?? {}) };
  next[lang] = text;
  return next;
}

/** texts 트랙이 없는 자막(구버전 저장본·새 추출 결과)에 현재 텍스트를 지정 언어 트랙으로 채운다 */
function hydrateTracks(subs: SubLine[], lang: LangCode | null): { subs: SubLine[]; lang: LangCode | null } {
  const resolved = lang ?? detectLangFromTexts(subs.map(s => s.text));
  if (!resolved) return { subs, lang: null };
  return {
    lang: resolved,
    subs: subs.map(s =>
      s.texts && Object.keys(s.texts).length > 0 ? s : { ...s, texts: withTrack(undefined, resolved, s.text) }
    ),
  };
}

/** 하나 이상의 줄에 텍스트가 있는 언어 트랙 목록 */
function availableTracks(subs: SubLine[]): LangCode[] {
  return LANG_CODES.filter(l => subs.some(s => (s.texts?.[l] ?? "").trim().length > 0));
}

/** 활성 트랙 전환: 각 줄의 text 를 해당 언어 트랙으로 교체 */
function applyTrack(subs: SubLine[], lang: LangCode): SubLine[] {
  return subs.map(s => ({ ...s, text: s.texts?.[lang] ?? "" }));
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

/** 현재 시각에 걸린 자막 중 가장 늦게 시작한 큐를 고른다.
 *  YouTube 자동 자막은 큐가 서로 겹치는 경우가 많아 첫 번째 일치만 고르면 뒤 큐가 영영 표시되지 않는다. */
function findActiveSub(subs: SubLine[], t: number): SubLine | undefined {
  for (let i = subs.length - 1; i >= 0; i--) {
    const s = subs[i];
    if (t >= s.start && t <= s.end) return s;
  }
  return undefined;
}

/** YouTube 플레이어 자체 CC 켜기/끄기 — 우리 오버레이와 겹치지 않도록 기본은 끈다 */
function applyYtCaptions(pl: YTPlayer | null, show: boolean) {
  if (!pl) return;
  try {
    if (show) { pl.loadModule("captions"); pl.loadModule("cc"); }
    else { pl.unloadModule("captions"); pl.unloadModule("cc"); }
  } catch { /* 플레이어가 아직 준비되지 않음 */ }
}


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
  const [subtitleMethod, setSubtitleMethod] = useState<string | null>(null); // "youtube_cc" | "whisper" | "whisper_fallback"
  const [subtitleMessage, setSubtitleMessage] = useState<string | null>(null);
  const [translateMessage, setTranslateMessage] = useState<string | null>(null);

  // 다국어 (ko / en / ja / zh)
  const [sourceHint, setSourceHint] = useState<"auto" | LangCode>("auto");   // 추출 시 원본 언어 힌트
  const [sourceLang, setSourceLang] = useState<LangCode | null>(null);        // 감지·확정된 원본 언어
  const [activeLang, setActiveLang] = useState<LangCode | null>(null);        // 현재 편집·미리보기·내보내기 트랙
  const [targetLang, setTargetLang] = useState<LangCode>("ko");               // 번역 대상 언어
  const [translateStyle, setTranslateStyle] = useState<TranslateStyle>("broadcast");
  const [secondaryLang, setSecondaryLang] = useState<LangCode | "">("");      // 이중 자막 보조 트랙
  const [mergeFragments, setMergeFragments] = useState(true);                // 추출 시 짧은 조각 자막을 앞 문장에 병합
  const [overlayPos, setOverlayPos] = useState<"bottom" | "top">("bottom");  // 오버레이 위치 (영상에 구워진 자막과 겹침 회피)
  const [showYtCaptions, setShowYtCaptions] = useState(false);               // YouTube 플레이어 자체 CC 표시 여부 (기본 숨김)
  const ytCaptionsRef = useRef(false);
  const [translateEngine, setTranslateEngine] = useState<string | null>(null);                  // 서버 번역 엔진 라벨
  const [translateProgress, setTranslateProgress] = useState<{ done: number; total: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);   // 플레이어 컨테이너 전체화면 (자막 오버레이 포함)

  // 추가된 단일 썸네일 대신 배열 사용
  const [capturedThumbnails, setCapturedThumbnails] = useState<string[]>([]);
  const [selectedThumbnailIndex, setSelectedThumbnailIndex] = useState<number>(0);
  const currentThumbnail = capturedThumbnails.length > 0 ? capturedThumbnails[selectedThumbnailIndex] : null;

  // 세션 저장/불러오기
  type SessionItem = {
    id: string; name: string; videoId?: string; fileVideoUrl?: string;
    videoTitle: string; subCount: number; step?: string; method?: string;
    sourceLang?: string | null; activeLang?: string | null;
    preset: number; thumbnail?: string; updatedAt: string;
  };
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showSessions, setShowSessions] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);  // HTML5 video 플레이어
  const isFileMode = !!fileVideoUrl && !videoId;  // 파일 모드 여부

  const playerRef = useRef<YTPlayer | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  /* ── 파생 상태: 언어 트랙 ───────────────────────────────── */
  const tracks = useMemo(() => availableTracks(subs), [subs]);
  // 편집 리스트에 참고용으로 보여줄 트랙: 보조 자막 > 원본(활성 트랙과 다를 때)
  const refLang: LangCode | null =
    secondaryLang && secondaryLang !== activeLang ? secondaryLang
    : sourceLang && sourceLang !== activeLang ? sourceLang
    : null;

  // 활성 트랙과 번역 대상이 같아지면 대상 언어를 자동으로 다른 언어로 변경
  useEffect(() => {
    if (activeLang && targetLang === activeLang) {
      setTargetLang(activeLang === "ko" ? "en" : "ko");
    }
  }, [activeLang, targetLang]);

  // 보조 자막 트랙이 사라지거나 활성 트랙과 같아지면 해제
  useEffect(() => {
    if (secondaryLang && (secondaryLang === activeLang || !tracks.includes(secondaryLang))) {
      setSecondaryLang("");
    }
  }, [secondaryLang, activeLang, tracks]);

  /* ── sessionStorage(수동 이관) 및 localStorage(자동 복구) ── */
  useEffect(() => {
    let handledBySession = false;
    try {
      const raw = sessionStorage.getItem("studio_data");
      if (raw) {
        const data: StudioData = JSON.parse(raw);

        // ★ 이전 상태 전체 초기화
        setSubs([]);
        setSubtitleStep(null);
        setSubtitleError(null);
        setSubtitleLoading(null);
        setSubtitleMethod(null);
        setSubtitleMessage(null);
        setTranslateMessage(null);
        setSelectedSub(null);
        setCurrentTime(0);
        setPlaying(false);
        setExported(false);
        setSourceLang(null);
        setActiveLang(null);
        setSecondaryLang("");

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

        if (data.script?.length) {
          // 대본 엔진에서 넘어온 자막은 한국어
          const h = hydrateTracks(scriptToSubs(data.script), "ko");
          setSubs(h.subs);
          setSourceLang(h.lang);
          setActiveLang(h.lang);
        }

        sessionStorage.removeItem("studio_data");
        handledBySession = true;
      }
    } catch { /* ignore */ }

    if (!handledBySession) {
      try {
        const rawLocal = localStorage.getItem("ai_subtitle_studio_save");
        if (rawLocal) {
           const parsed = JSON.parse(rawLocal);
           if (parsed.videoId) setVideoId(parsed.videoId);
           if (parsed.fileVideoUrl) setFileVideoUrl(parsed.fileVideoUrl);
           if (parsed.videoTitle) setVideoTitle(parsed.videoTitle);
           const savedActive: LangCode | null = isLangCode(parsed.activeLang) ? parsed.activeLang : null;
           const savedSource: LangCode | null = isLangCode(parsed.sourceLang) ? parsed.sourceLang : null;
           if (parsed.subs) {
             const h = hydrateTracks(normalizeCues(parsed.subs as SubLine[]), savedActive ?? savedSource);
             setSubs(h.subs);
             setSourceLang(savedSource ?? h.lang);
             setActiveLang(savedActive ?? h.lang);
           }
           if (typeof parsed.preset === "number") setPreset(parsed.preset);
           if (parsed.subtitleStep) setSubtitleStep(parsed.subtitleStep);
           if (parsed.subtitleMethod) setSubtitleMethod(parsed.subtitleMethod);
           if (parsed.capturedThumbnails) setCapturedThumbnails(parsed.capturedThumbnails);
           if (parsed.sourceHint === "auto" || isLangCode(parsed.sourceHint)) setSourceHint(parsed.sourceHint);
           if (isLangCode(parsed.targetLang)) setTargetLang(parsed.targetLang);
           if (parsed.translateStyle === "faithful" || parsed.translateStyle === "broadcast") setTranslateStyle(parsed.translateStyle);
           if (isLangCode(parsed.secondaryLang)) setSecondaryLang(parsed.secondaryLang);
           if (typeof parsed.mergeFragments === "boolean") setMergeFragments(parsed.mergeFragments);
           if (parsed.overlayPos === "top" || parsed.overlayPos === "bottom") setOverlayPos(parsed.overlayPos);
           if (typeof parsed.showYtCaptions === "boolean") setShowYtCaptions(parsed.showYtCaptions);
        }
      } catch {}
    }

    setIsLoaded(true);
  }, []);

  /* ── 자동 백업 (localStorage) ───────────────────────────── */
  useEffect(() => {
    if (!isLoaded) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem("ai_subtitle_studio_save", JSON.stringify({
          videoId, fileVideoUrl, videoTitle, subs, preset,
          subtitleStep, subtitleMethod, capturedThumbnails,
          sourceHint, sourceLang, activeLang, targetLang, translateStyle, secondaryLang,
          mergeFragments, overlayPos, showYtCaptions,
        }));
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [videoId, fileVideoUrl, videoTitle, subs, preset, subtitleStep, subtitleMethod, capturedThumbnails,
      sourceHint, sourceLang, activeLang, targetLang, translateStyle, secondaryLang,
      mergeFragments, overlayPos, showYtCaptions, isLoaded]);

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
          applyYtCaptions(e.target, ytCaptionsRef.current);
        },
        onStateChange: (e: { data: number }) => {
          if (e.data === window.YT.PlayerState.PLAYING) {
            setPlaying(true);
            // 재생 시작 시 YouTube 가 CC 를 다시 켜는 경우가 있어 설정을 재적용
            applyYtCaptions(playerRef.current, ytCaptionsRef.current);
          } else if (e.data === window.YT.PlayerState.PAUSED || e.data === window.YT.PlayerState.ENDED) {
            setPlaying(false);
          }
        },
        // 자막 모듈이 로드될 때 호출됨 — 숨김 설정이면 즉시 내린다
        onApiChange: () => { if (!ytCaptionsRef.current) applyYtCaptions(playerRef.current, false); },
      },
    } as Record<string, unknown>);
  }, [ytReady, videoId, isFileMode]);

  /* ── YouTube 자체 CC 토글 반영 ─────────────────────────── */
  useEffect(() => {
    ytCaptionsRef.current = showYtCaptions;
    if (!isFileMode) applyYtCaptions(playerRef.current, showYtCaptions);
  }, [showYtCaptions, isFileMode]);

  /* ── 전체화면 (플레이어 컨테이너 — 자막 오버레이가 함께 보임) ── */
  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null;
    if (!el) return;
    const doc = document as Document & { webkitExitFullscreen?: () => void; webkitFullscreenElement?: Element | null };
    const current = document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
    if (current) {
      (document.exitFullscreen?.bind(document) ?? doc.webkitExitFullscreen?.bind(document))?.();
    } else {
      const req = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
      Promise.resolve(req?.()).catch(() => { /* 브라우저가 거부 (권한·iframe 정책) */ });
    }
  }, []);

  useEffect(() => {
    const onChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      const current = document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
      setIsFullscreen(!!current && current === containerRef.current);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  // F 키로 전체화면 토글 (입력란에 포커스가 있을 때는 제외)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "f" && e.key !== "F") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (!videoId && !isFileMode) return;
      e.preventDefault();
      toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFullscreen, videoId, isFileMode]);

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

  /* ── 자막 수정 (활성 언어 트랙에 반영) ───────────────────── */
  const updateSubText = (id: number, text: string) => {
    setSubs(prev => prev.map(s =>
      s.id === id
        ? { ...s, text, texts: activeLang ? withTrack(s.texts, activeLang, text) : s.texts }
        : s
    ));
  };

  /* ── 언어 트랙 전환 ────────────────────────────────────── */
  const switchTrack = (lang: LangCode) => {
    if (lang === activeLang) return;
    setSubs(prev => applyTrack(prev, lang));
    setActiveLang(lang);
    setSelectedSub(null);
  };

  /* ── ① 자막 추출 ─────────────────────────────────────── */
  const handleExtract = async () => {
    setSubtitleLoading("extract");
    setSubtitleError(null);
    setSubtitleMethod(null);
    setSubtitleMessage(null);
    setTranslateMessage(null);
    try {
      const res = await fetch("/api/studio/subtitle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "extract",
          videoId: videoId || "",
          fileVideoUrl: fileVideoUrl || "",
          sourceLang: sourceHint === "auto" ? null : sourceHint,
          mergeFragments,
        }),
      });
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        setSubtitleError(`서버 오류 (${res.status}): JSON이 아닌 응답이 반환되었습니다. 서버 상태를 확인하세요.`);
        return;
      }
      let data;
      try { data = await res.json(); } catch { setSubtitleError(`응답 파싱 실패 (${res.status})`); return; }
      if (!res.ok) { setSubtitleError(data.error || `서버 오류 (${res.status})`); return; }

      const extracted: SubLine[] = (data.subs as SubLine[]).map(s => ({ ...s, texts: undefined }));
      // 언어 확정 우선순위: 서버 감지 → 사용자 힌트 → 텍스트 휴리스틱 → 영어
      const lang: LangCode =
        (isLangCode(data.language) ? data.language : null)
        ?? (sourceHint !== "auto" ? sourceHint : null)
        ?? detectLangFromTexts(extracted.map(s => s.text))
        ?? "en";
      const h = hydrateTracks(normalizeCues(extracted), lang);
      setSubs(h.subs);
      setSourceLang(lang);
      setActiveLang(lang);
      setSecondaryLang("");
      setSubtitleStep("extracted");
      setSubtitleMethod(data.method || null);
      setSubtitleMessage(data.message || null);
    } catch (e) { setSubtitleError(String(e)); }
    finally { setSubtitleLoading(null); }
  };

  /* ── ② 번역 (활성 트랙 → 대상 언어) — 비동기 작업 + 폴링 ─────── */
  const handleTranslate = async () => {
    const src: LangCode | null = activeLang ?? sourceLang;
    if (!subs.length || targetLang === src) return;
    setSubtitleLoading("translate");
    setSubtitleError(null);
    setTranslateMessage(null);
    setTranslateProgress(null);
    try {
      const res = await fetch("/api/studio/subtitle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "translate",
          async: true,
          subs: subs.map(({ id, start, end, text, type }) => ({ id, start, end, text, type })),
          sourceLang: src,
          targetLang,
          style: translateStyle,
        }),
      });
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        setSubtitleError(`서버 오류 (${res.status}): 번역 API 응답 오류. 서버 상태를 확인하세요.`);
        return;
      }
      let data;
      try { data = await res.json(); } catch { setSubtitleError(`응답 파싱 실패 (${res.status})`); return; }
      if (!res.ok) { setSubtitleError(data.error || `서버 오류 (${res.status})`); return; }

      // 비동기 작업이면 완료까지 폴링 (2초 간격, 최대 15분)
      let result = data;
      if (data.jobId) {
        setTranslateProgress({ done: 0, total: data.total || 1 });
        const deadline = Date.now() + 15 * 60 * 1000;
        for (;;) {
          await new Promise(r => setTimeout(r, 2000));
          const jr = await fetch(`/api/studio/subtitle?job=${encodeURIComponent(data.jobId)}`);
          let jd: { status?: string; done?: number; total?: number; error?: string; subs?: SubLine[]; message?: string } = {};
          try { jd = await jr.json(); } catch { /* 일시 오류 → 다음 폴링 */ }
          if (!jr.ok) { setSubtitleError(jd.error || `번역 작업 조회 실패 (${jr.status})`); return; }
          if (jd.status === "failed") { setSubtitleError(jd.error || "번역 실패"); return; }
          if (jd.status === "done") { result = jd; break; }
          setTranslateProgress({ done: jd.done ?? 0, total: jd.total ?? 1 });
          if (Date.now() > deadline) { setSubtitleError("번역이 15분을 넘겨 중단했습니다. 다시 시도하세요."); return; }
        }
      }

      const byId = new Map<number, string>((result.subs as SubLine[]).map(s => [s.id, s.text]));
      setSubs(prev => prev.map(s => {
        const tr = byId.get(s.id) ?? s.text;
        // 번역 전 텍스트가 어느 트랙에도 없었다면 원본 트랙으로 보존
        const base = s.texts && Object.keys(s.texts).length > 0 ? s.texts : (src ? withTrack(undefined, src, s.text) : undefined);
        return { ...s, text: tr, texts: withTrack(base, targetLang, tr) };
      }));
      if (!sourceLang && src) setSourceLang(src);
      setActiveLang(targetLang);
      setSubtitleStep("translated");
      setTranslateMessage(result.message || `${LANGS[targetLang].label} 번역 완료`);
    } catch (e) { setSubtitleError(String(e)); }
    finally { setSubtitleLoading(null); setTranslateProgress(null); }
  };

  /* ── SRT/VTT 내보내기 (활성 트랙 · 이중 자막) ──────────── */
  const exportBase = videoTitle || "subtitles";
  const singleCues = () => normalizeCues(subs).map(s => ({ start: s.start, end: s.end, lines: [s.text] }));
  const dualCues = (second: LangCode) =>
    normalizeCues(subs).map(s => ({ start: s.start, end: s.end, lines: [s.text, s.texts?.[second] ?? ""] }));

  const handleExportSRT = () => {
    downloadFile(toSRT(singleCues()), `${exportBase}${activeLang ? "." + activeLang : ""}.srt`, "text/srt");
  };
  const handleExportVTT = () => {
    downloadFile(toVTT(singleCues()), `${exportBase}${activeLang ? "." + activeLang : ""}.vtt`, "text/vtt");
  };
  const handleExportDualSRT = () => {
    if (!secondaryLang) return;
    downloadFile(toSRT(dualCues(secondaryLang)), `${exportBase}.${activeLang ?? "x"}+${secondaryLang}.srt`, "text/srt");
  };

  const router = useRouter();
  const handleSendPublisher = () => {
    setExported(true);
    sessionStorage.setItem("studio_to_script", JSON.stringify({
      videoId: videoId || "",
      fileVideoUrl: fileVideoUrl || "",
      videoTitle,
      subs,
      sourceLang,
      activeLang,
      capturedThumbnails,
      selectedThumbnailIndex
    }));
    const url = videoId
      ? `/dashboard/script?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`
      : `/dashboard/script?url=${encodeURIComponent(fileVideoUrl)}`;
    router.push(url);
  };

  /* ── 세션 목록 로드 ───────────────────────────────────── */
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/studio/session");
      const data = await res.json();
      if (data.sessions) setSessions(data.sessions);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  /* ── 번역 엔진 정보 (OpenClaw / OpenAI) ───────────────── */
  useEffect(() => {
    fetch("/api/studio/subtitle?config=1")
      .then(r => r.json())
      .then(d => { if (d?.engine) setTranslateEngine(d.note ? `${d.engine} (${d.note})` : d.engine); })
      .catch(() => { /* 라벨 없이 진행 */ });
  }, []);

  /* ── 세션 저장 ───────────────────────────────────────── */
  const handleSaveSession = async () => {
    if (!subs.length) return;
    setSessionLoading(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/studio/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: videoId || null,
          fileVideoUrl: fileVideoUrl || null,
          videoTitle,
          subs,
          step: subtitleStep,
          method: subtitleMethod,
          sourceLang,
          activeLang,
          preset,
          thumbnail: currentThumbnail || (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null),
          thumbnailsJson: capturedThumbnails.length > 0 ? JSON.stringify(capturedThumbnails) : null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSaveMessage(data.action === "updated" ? "✓ 세션 업데이트 완료" : "✓ 세션 저장 완료");
        loadSessions();
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage(`✗ ${data.error}`);
      }
    } catch (e) { setSaveMessage(`✗ ${String(e)}`); }
    finally { setSessionLoading(false); }
  };

  /* ── 세션 불러오기 ─────────────────────────────────────── */
  const handleLoadSession = async (sessionId: string) => {
    setSessionLoading(true);
    try {
      const res = await fetch(`/api/studio/session/${sessionId}`);
      const data = await res.json();
      if (!res.ok) return;
      const s = data.session;
      if (s.videoId) {
        setVideoId(s.videoId);
        setFileVideoUrl("");
      } else if (s.fileVideoUrl) {
        setFileVideoUrl(s.fileVideoUrl);
        setVideoId("");
      }
      setVideoTitle(s.videoTitle || "");

      const savedSource: LangCode | null = isLangCode(s.sourceLang) ? s.sourceLang : null;
      const savedActive: LangCode | null = isLangCode(s.activeLang) ? s.activeLang : null;
      const h = hydrateTracks(normalizeCues((s.subs || []) as SubLine[]), savedActive ?? savedSource);
      const active = savedActive ?? h.lang;
      setSubs(active ? applyTrack(h.subs, active) : h.subs);
      setSourceLang(savedSource ?? h.lang);
      setActiveLang(active);
      setSecondaryLang("");

      let loadedThumbs: string[] = [];
      if (s.thumbnailsJson) {
         try { loadedThumbs = JSON.parse(s.thumbnailsJson); } catch {}
      } else if (s.thumbnail?.startsWith("data:image")) {
         loadedThumbs = [s.thumbnail];
      }
      setCapturedThumbnails(loadedThumbs);
      setSelectedThumbnailIndex(0);
      setSubtitleStep(s.step || null);
      setSubtitleMethod(s.method || null);
      setPreset(s.preset ?? 0);
      setSubtitleError(null);
      setSubtitleMessage(null);
      setTranslateMessage(null);
      setSelectedSub(null);
      setCurrentTime(0);
      setShowSessions(false);
    } catch { /* ignore */ }
    finally { setSessionLoading(false); }
  };

  /* ── 세션 삭제 ───────────────────────────────────────── */
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("이 세션을 삭제하시겠습니까?")) return;
    try {
      await fetch(`/api/studio/session/${sessionId}`, { method: "DELETE" });
      loadSessions();
    } catch { /* ignore */ }
  };

  /* ── 현재 활성 자막 ──────────────────────────────────── */
  const activeSub = findActiveSub(subs, currentTime);
  const p = FONT_PRESETS[preset];
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const translateSrc: LangCode | null = activeLang ?? sourceLang;

  /* ── 공통 스타일 ──────────────────────────────────────── */
  const sectionTitle: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, color: "var(--text-secondary)",
    textTransform: "uppercase", letterSpacing: "0.06em",
  };
  const smallSelect: React.CSSProperties = {
    flex: 1, fontSize: 12, padding: "6px 10px", borderRadius: 6, minWidth: 0,
  };
  const langPill = (active: boolean): React.CSSProperties => ({
    padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: "pointer",
    border: `1px solid ${active ? "var(--brand)" : "var(--border-default)"}`,
    background: active ? "var(--brand-dim)" : "var(--bg-elevated)",
    color: active ? "#a5b4fc" : "var(--text-secondary)",
    display: "inline-flex", alignItems: "center", gap: 4, transition: "all 0.15s",
  });

  /* ── 렌더 ─────────────────────────────────────────────── */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>자막 스튜디오</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            한·영·일·중(간체·번체) 상호 번역 · 자막 실시간 싱크 · 이중 자막 미리보기 · SRT/VTT 내보내기
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{ gap: 6, fontSize: 12 }}
            onClick={() => setShowSessions(!showSessions)}
          >
            <FolderOpen size={14} />
            저장된 작업 ({sessions.length})
          </button>
          <button
            className="btn btn-brand btn-sm"
            style={{ gap: 6, fontSize: 12 }}
            disabled={subs.length === 0 || sessionLoading}
            onClick={handleSaveSession}
          >
            {sessionLoading
              ? <><Loader size={12} style={{ animation: "spin 0.9s linear infinite" }} />저장 중...</>
              : <><Save size={14} />현재 작업 저장</>
            }
          </button>
        </div>
      </div>
      {saveMessage && (
        <div style={{
          fontSize: 11, padding: "6px 12px", borderRadius: 6,
          color: saveMessage.startsWith("✓") ? "#34d399" : "#f87171",
          background: saveMessage.startsWith("✓") ? "rgba(52,211,153,0.06)" : "rgba(239,68,68,0.06)",
          border: `1px solid ${saveMessage.startsWith("✓") ? "rgba(52,211,153,0.2)" : "rgba(239,68,68,0.2)"}`,
        }}>
          {saveMessage}
        </div>
      )}

      {/* 저장된 세션 목록 */}
      {showSessions && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <FolderOpen size={14} color="#818cf8" />
            저장된 작업 목록
          </div>
          {sessions.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "20px 0", textAlign: "center" }}>
              저장된 작업이 없습니다. 자막 추출 후 &quot;현재 작업 저장&quot; 버튼을 클릭하세요.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto" }}>
              {sessions.map(s => {
                const sSrc = isLangCode(s.sourceLang) ? s.sourceLang : null;
                const sAct = isLangCode(s.activeLang) ? s.activeLang : null;
                return (
                <div
                  key={s.id}
                  onClick={() => handleLoadSession(s.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                    borderRadius: 8, cursor: "pointer", transition: "all 0.15s",
                    border: "1px solid var(--border-default)",
                    background: "var(--bg-elevated)",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--brand)"; e.currentTarget.style.background = "var(--brand-dim)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.background = "var(--bg-elevated)"; }}
                >
                  {/* 썸네일 */}
                  {s.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.thumbnail} alt="" style={{ width: 60, height: 34, borderRadius: 4, objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 60, height: 34, borderRadius: 4, background: "var(--bg-input)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Play size={14} color="var(--text-muted)" />
                    </div>
                  )}
                  {/* 정보 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {s.videoTitle || s.name}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", display: "flex", gap: 8, marginTop: 2, flexWrap: "wrap" }}>
                      <span>📝 {s.subCount}개 자막</span>
                      {sSrc && (
                        <span style={{ color: "#a5b4fc" }}>
                          {LANGS[sSrc].flag} {LANGS[sSrc].short}
                          {sAct && sAct !== sSrc && <> → {LANGS[sAct].flag} {LANGS[sAct].short}</>}
                        </span>
                      )}
                      <span>{s.step === "translated" ? "✓ 번역완료" : s.step === "extracted" ? "✓ 추출완료" : ""}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Clock size={9} />
                        {new Date(s.updatedAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                  {/* 삭제 */}
                  <button
                    className="btn-icon"
                    onClick={(e) => handleDeleteSession(s.id, e)}
                    style={{ opacity: 0.4, padding: 4 }}
                    title="세션 삭제"
                  >
                    <Trash2 size={13} color="#f87171" />
                  </button>
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
            한국어·영어·일본어·중국어(간체/번체) 영상 모두 지원합니다.
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
            background: "#000", borderRadius: isFullscreen ? 0 : 10, overflow: "hidden",
            border: isFullscreen ? "none" : "1px solid var(--border-default)",
            aspectRatio: isFullscreen ? "auto" : "16/9",
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

                {/* 자막 오버레이 (활성 트랙 + 선택 시 보조 트랙 이중 자막) */}
                {activeSub && activeSub.text && (
                  <div
                    lang={activeLang ? LANGS[activeLang].htmlLang : undefined}
                    style={{
                      position: "absolute", left: "50%", transform: "translateX(-50%)",
                      ...(overlayPos === "top" ? { top: "9%" } : { bottom: "12%" }),
                      background: p.bg, color: p.color, padding: isFullscreen ? "12px 28px" : "8px 18px", borderRadius: isFullscreen ? 10 : 6,
                      fontSize: isFullscreen ? "clamp(22px, 2.8vw, 48px)" : 16, fontWeight: 600, fontFamily: fontStackFor(activeLang, p.font), textAlign: "center",
                      maxWidth: "80%", lineHeight: 1.5, whiteSpace: "pre-wrap",
                      transition: "opacity 0.2s", zIndex: 3,
                      pointerEvents: "none",
                    }}>
                    {activeSub.text}
                    {secondaryLang && activeSub.texts?.[secondaryLang] && (
                      <div
                        lang={LANGS[secondaryLang].htmlLang}
                        style={{
                          fontSize: isFullscreen ? "clamp(16px, 1.9vw, 32px)" : 12, fontWeight: 500, opacity: 0.85, marginTop: isFullscreen ? 8 : 4,
                          fontFamily: fontStackFor(secondaryLang, p.font),
                        }}>
                        {activeSub.texts[secondaryLang]}
                      </div>
                    )}
                  </div>
                )}

                {/* 소스 표시 (파일 / YouTube) + 활성 언어 */}
                <div style={{ position: "absolute", top: 10, left: 12, display: "flex", gap: 6, zIndex: 3, pointerEvents: "none" }}>
                  {isFileMode && (
                    <div style={{
                      background: "rgba(139,92,246,0.8)", color: "white",
                      padding: "3px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700,
                    }}>
                      📁 로컬 파일
                    </div>
                  )}
                  {activeLang && (
                    <div style={{
                      background: "rgba(0,0,0,0.6)", color: "white",
                      padding: "3px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700,
                    }}>
                      {LANGS[activeLang].flag} {LANGS[activeLang].short}
                      {secondaryLang && <> + {LANGS[secondaryLang].short}</>}
                    </div>
                  )}
                </div>

                {/* 시간 표시 + YouTube 자체 CC 토글 */}
                <div style={{ position: "absolute", top: 10, right: 12, display: "flex", gap: 6, alignItems: "center", zIndex: 4 }}>
                  <button
                    onClick={e => { e.stopPropagation(); toggleFullscreen(); }}
                    title={isFullscreen ? "전체화면 종료 (Esc / F)" : "전체화면 (F) — 자막 오버레이 포함"}
                    style={{
                      background: "rgba(0,0,0,0.6)", color: "white", padding: "3px 8px", borderRadius: 5,
                      fontSize: 10, fontWeight: 700, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer",
                      display: "inline-flex", alignItems: "center", gap: 4,
                    }}>
                    {isFullscreen ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
                    {isFullscreen ? "종료" : "전체화면"}
                  </button>
                  {!isFileMode && (
                    <button
                      onClick={e => { e.stopPropagation(); setShowYtCaptions(v => !v); }}
                      title={showYtCaptions ? "YouTube 자체 자막(CC) 숨기기" : "YouTube 자체 자막(CC) 표시 — 기본은 숨김 (오버레이와 겹침 방지)"}
                      style={{
                        background: showYtCaptions ? "rgba(239,68,68,0.85)" : "rgba(0,0,0,0.6)", color: "white",
                        padding: "3px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700,
                        border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer",
                      }}>
                      YT CC {showYtCaptions ? "ON" : "OFF"}
                    </button>
                  )}
                  <div style={{
                    background: "rgba(0,0,0,0.6)", color: "white",
                    padding: "3px 8px", borderRadius: 5,
                    fontSize: 12, fontFamily: "JetBrains Mono, monospace",
                    pointerEvents: "none",
                  }}>
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
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
              <button className="btn-icon" onClick={toggleFullscreen} disabled={!videoId && !isFileMode}
                title={isFullscreen ? "전체화면 종료 (Esc / F)" : "전체화면 (F)"}>
                {isFullscreen ? <Minimize2 size={14} color="var(--text-muted)" /> : <Maximize2 size={14} color="var(--text-muted)" />}
              </button>
            </div>
          </div>

          {/* 자막 편집 리스트 */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{
              padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)",
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                자막 편집
                {activeLang && (
                  <span className="badge badge-brand" style={{ fontSize: 10 }}>
                    {LANGS[activeLang].flag} {LANGS[activeLang].label} 편집 중
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 8, alignItems: "center" }}>
                {refLang && <span>참고: {LANGS[refLang].flag} {LANGS[refLang].short}</span>}
                <span>{subs.length}개 장면</span>
              </div>
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
                  <div style={{ display: "flex", flexDirection: "column", padding: "8px 12px 8px 0", minWidth: 0 }}>
                    <textarea value={s.text} onChange={e => updateSubText(s.id, e.target.value)} rows={2}
                      lang={activeLang ? LANGS[activeLang].htmlLang : undefined}
                      placeholder={activeLang ? `${LANGS[activeLang].label} 자막 입력` : ""}
                      style={{
                        width: "100%",
                        background: "transparent", border: "none", outline: "none",
                        color: "var(--text-primary)", fontSize: 13, resize: "none",
                        fontFamily: fontStackFor(activeLang, "Inter"), lineHeight: 1.5,
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                    {refLang && s.texts?.[refLang] && (
                      <div
                        lang={LANGS[refLang].htmlLang}
                        style={{
                          fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4, marginTop: 2,
                          fontFamily: fontStackFor(refLang, "Inter"), whiteSpace: "pre-wrap",
                        }}>
                        {s.texts[refLang]}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 우측: 스타일 + 내보내기 ────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* 자막 워크플로우 (다국어) */}
          {(videoId || isFileMode) && (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ ...sectionTitle, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <Languages size={13} color="#818cf8" /> 자막 워크플로우
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

                {/* 원본 언어 (추출 힌트) */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", width: 56 }}>원본 언어</span>
                  <select
                    className="input" style={smallSelect}
                    value={sourceHint}
                    disabled={subtitleLoading !== null}
                    onChange={e => setSourceHint(e.target.value as "auto" | LangCode)}
                  >
                    <option value="auto">자동 감지</option>
                    {LANG_CODES.map(l => (
                      <option key={l} value={l}>{LANGS[l].flag} {LANGS[l].label} · {LANGS[l].native}</option>
                    ))}
                  </select>
                </div>

                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-muted)", cursor: "pointer" }}>
                  <input
                    type="checkbox" checked={mergeFragments} disabled={subtitleLoading !== null}
                    onChange={e => setMergeFragments(e.target.checked)}
                    style={{ accentColor: "var(--brand)" }}
                  />
                  짧게 끊긴 조각 자막을 앞 문장에 이어 붙이기
                </label>

                {/* ① 자막 추출 (스마트 모드: CC → Whisper 자동 폴백) */}
                <button
                  className="btn btn-brand btn-sm"
                  style={{ gap: 6, justifyContent: "flex-start" }}
                  disabled={subtitleLoading !== null}
                  onClick={handleExtract}
                >
                  {subtitleLoading === "extract"
                    ? <><Loader size={12} style={{ animation: "spin 0.9s linear infinite" }} />{isFileMode ? "Whisper 음성 분석 중..." : "자막 추출 중 (CC → Whisper 자동 전환)..."}</>
                    : <><Download size={12} />{isFileMode ? "① 음성 분석 자막 추출 (Whisper AI)" : "① 자막 추출 (CC 우선 → Whisper 폴백)"}</>
                  }
                </button>
                {subtitleStep && subtitleMessage && (
                  <div style={{ fontSize: 10, marginLeft: 4, padding: "4px 8px", borderRadius: 4,
                    color: subtitleMethod === "youtube_cc" ? "#34d399" : "#818cf8",
                    background: subtitleMethod === "youtube_cc" ? "rgba(52,211,153,0.06)" : "rgba(129,140,248,0.06)",
                  }}>
                    {subtitleMessage}
                  </div>
                )}

                {/* 언어 트랙 */}
                {tracks.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6 }}>
                      언어 트랙 — 클릭하면 편집·미리보기·내보내기 대상이 전환됩니다
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {tracks.map(l => (
                        <button key={l} onClick={() => switchTrack(l)} style={langPill(l === activeLang)} title={LANGS[l].label}>
                          {LANGS[l].flag} {LANGS[l].short}
                          {l === sourceLang && <span style={{ opacity: 0.6, fontWeight: 500 }}>원본</span>}
                          {l === activeLang && <Check size={10} />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ② 번역: 활성 트랙 → 대상 언어 */}
                <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="badge badge-gray" style={{ fontSize: 10, whiteSpace: "nowrap" }}>
                      {translateSrc ? `${LANGS[translateSrc].flag} ${LANGS[translateSrc].short}` : "원본"}
                    </span>
                    <ArrowRight size={12} color="var(--text-muted)" />
                    <select
                      className="input" style={smallSelect}
                      value={targetLang}
                      disabled={subtitleLoading !== null}
                      onChange={e => setTargetLang(e.target.value as LangCode)}
                    >
                      {LANG_CODES.map(l => (
                        <option key={l} value={l} disabled={l === translateSrc}>
                          {LANGS[l].flag} {LANGS[l].label} · {LANGS[l].native}{l === translateSrc ? " (현재 트랙)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {(Object.keys(STYLE_LABELS) as TranslateStyle[]).map(st => (
                      <button
                        key={st}
                        onClick={() => setTranslateStyle(st)}
                        title={STYLE_LABELS[st].hint}
                        style={{
                          flex: 1, padding: "5px 8px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                          border: `1px solid ${translateStyle === st ? "var(--brand)" : "var(--border-default)"}`,
                          background: translateStyle === st ? "var(--brand-dim)" : "var(--bg-elevated)",
                          color: translateStyle === st ? "#a5b4fc" : "var(--text-muted)",
                          fontWeight: translateStyle === st ? 700 : 500,
                        }}
                      >
                        {STYLE_LABELS[st].label}
                      </button>
                    ))}
                  </div>
                  <button
                    className="btn btn-brand btn-sm"
                    style={{
                      gap: 6, justifyContent: "flex-start",
                      background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                      borderColor: "#8b5cf6",
                    }}
                    disabled={subtitleLoading !== null || subs.length === 0 || targetLang === translateSrc}
                    onClick={handleTranslate}
                  >
                    {subtitleLoading === "translate"
                      ? <><Loader size={12} style={{ animation: "spin 0.9s linear infinite" }} />{LANGS[targetLang].label} 번역 중{translateProgress ? ` (${translateProgress.done}/${translateProgress.total} 청크)` : ""}...</>
                      : <><Languages size={12} />② {LANGS[targetLang].label} 번역</>
                    }
                  </button>
                  {translateEngine && (
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 4 }}>엔진: {translateEngine}</div>
                  )}
                  {translateMessage && (
                    <div style={{ fontSize: 10, color: "#818cf8", marginLeft: 4 }}>✓ {translateMessage}</div>
                  )}
                  {tracks.length > 1 && (
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 4 }}>
                      💡 번역된 트랙을 선택한 뒤 다시 번역하면 그 언어를 원본으로 2차 번역됩니다.
                    </div>
                  )}
                </div>

                {/* 이중 자막 (보조 트랙) */}
                {tracks.length > 1 && (
                  <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", width: 56 }}>보조 자막</span>
                    <select
                      className="input" style={smallSelect}
                      value={secondaryLang}
                      onChange={e => setSecondaryLang(e.target.value as LangCode | "")}
                    >
                      <option value="">없음 (단일 자막)</option>
                      {tracks.filter(l => l !== activeLang).map(l => (
                        <option key={l} value={l}>{LANGS[l].flag} {LANGS[l].label} 함께 표시</option>
                      ))}
                    </select>
                  </div>
                )}

                {subtitleError && (
                  <div style={{ fontSize: 11, color: "#f87171", padding: "6px 8px", borderRadius: 6, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <AlertCircle size={11} style={{ marginRight: 4 }} />{subtitleError}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 자막 스타일 */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ ...sectionTitle, marginBottom: 12 }}>
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
                    fontSize: 11, fontFamily: fontStackFor(activeLang, fp.font), fontWeight: 600, whiteSpace: "nowrap",
                  }}>
                    가 A あ 中
                  </div>
                  <span style={{ fontSize: 12, color: preset === i ? "#818cf8" : "var(--text-muted)", flex: 1, textAlign: "left" }}>
                    {fp.name}
                  </span>
                  {preset === i && <Check size={12} color="#818cf8" />}
                </button>
              ))}
            </div>
            {/* 오버레이 위치 — 영상에 이미 구워진 자막과 겹칠 때 상단으로 이동 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>자막 위치</span>
              {(["bottom", "top"] as const).map(pos => (
                <button key={pos} onClick={() => setOverlayPos(pos)}
                  style={{
                    flex: 1, padding: "5px 8px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                    border: `1px solid ${overlayPos === pos ? "var(--brand)" : "var(--border-default)"}`,
                    background: overlayPos === pos ? "var(--brand-dim)" : "var(--bg-elevated)",
                    color: overlayPos === pos ? "#a5b4fc" : "var(--text-muted)",
                    fontWeight: overlayPos === pos ? 700 : 500,
                  }}>
                  {pos === "bottom" ? "하단" : "상단"}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6 }}>
              영상에 이미 자막이 입혀져 있으면 상단으로 옮겨 겹침을 피하세요.
            </div>
          </div>

          {/* 씬 타입 범례 */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ ...sectionTitle, marginBottom: 10 }}>
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
          {(videoId || isFileMode) && (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={sectionTitle}>
                  썸네일
                </div>
                {isFileMode && (
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: "4px 8px" }}
                    onClick={() => {
                      if (!videoRef.current) return;
                      const canvas = document.createElement("canvas");
                      canvas.width = videoRef.current.videoWidth || 1280;
                      canvas.height = videoRef.current.videoHeight || 720;
                      const ctx = canvas.getContext("2d");
                      if (ctx) {
                        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
                        setCapturedThumbnails(prev => [...prev, dataUrl]);
                        setSelectedThumbnailIndex(capturedThumbnails.length); // 방금 추가된 것을 선택
                      }
                    }}>
                    <Camera size={13} style={{ marginRight: 4 }} /> 현재 화면 캡처
                  </button>
                )}
              </div>

              {currentThumbnail ? (
                 // eslint-disable-next-line @next/next/no-img-element
                 <img src={currentThumbnail} alt="thumbnail" style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border-default)" }} />
              ) : videoId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                  alt="thumbnail"
                  style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border-default)" }}
                />
              ) : (
                <div style={{ width: "100%", aspectRatio: "16/9", background: "var(--bg-input)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>
                  우측 상단의 캡처 버튼을 눌러주세요
                </div>
              )}

              {/* 추가된 썸네일 이미지 선택 리스트 */}
              {capturedThumbnails.length > 0 && (
                <div style={{ display: "flex", gap: 8, overflowX: "auto", marginTop: 12, paddingBottom: 4 }}>
                  {capturedThumbnails.map((thumb, idx) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={idx}
                      src={thumb}
                      alt={`cap_${idx}`}
                      onClick={() => setSelectedThumbnailIndex(idx)}
                      style={{
                        height: 40, aspectRatio: "16/9", objectFit: "cover", borderRadius: 4, cursor: "pointer", flexShrink: 0,
                        border: selectedThumbnailIndex === idx ? "2px solid var(--brand)" : "1px solid var(--border-subtle)",
                        opacity: selectedThumbnailIndex === idx ? 1 : 0.6,
                        transition: "all 0.15s"
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 내보내기 */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ ...sectionTitle, marginBottom: 12 }}>
              내보내기{activeLang && <span style={{ marginLeft: 6, color: "#818cf8" }}>{LANGS[activeLang].flag} {LANGS[activeLang].short}</span>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={handleExportSRT} disabled={subs.length === 0}
                style={{ justifyContent: "flex-start", gap: 8 }}>
                <Download size={13} /> SRT 자막 파일 다운로드{activeLang && ` (${LANGS[activeLang].short})`}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={handleExportVTT} disabled={subs.length === 0}
                style={{ justifyContent: "flex-start", gap: 8 }}>
                <Download size={13} /> VTT 자막 파일 다운로드{activeLang && ` (${LANGS[activeLang].short})`}
              </button>
              {secondaryLang && activeLang && (
                <button className="btn btn-ghost btn-sm" onClick={handleExportDualSRT}
                  style={{ justifyContent: "flex-start", gap: 8 }}>
                  <Download size={13} /> 이중 자막 SRT ({LANGS[activeLang].short} + {LANGS[secondaryLang].short})
                </button>
              )}
            </div>
          </div>

          {/* AI 대본엔진 전달 */}
          <button className="btn btn-brand" onClick={handleSendPublisher}
            style={{ width: "100%", padding: "12px", fontSize: 14, gap: 8 }}>
            {exported ? <><Check size={15} />AI 대본엔진으로 전송됨!</> : <><Sparkles size={15} />AI 대본엔진으로 보내기</>}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
