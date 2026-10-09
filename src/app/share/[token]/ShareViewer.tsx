"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Play, Pause, SkipBack, Volume2, VolumeX, Maximize2, Minimize2, Download,
  Film, Loader, Check, Share2, Copy, Clapperboard, Eye, Lock, Globe
} from "lucide-react";
import { LANGS, LANG_CODES, type LangCode, fontStackFor, normalizeCues, toSRT, toVTT } from "@/lib/subtitle-lang";
import { SUBTITLE_PRESETS, SUBTITLE_MAX_WIDTH, subtitleScale, overlayPlacement } from "@/lib/subtitle-presets";
import type { ShareDto, ShareSub } from "@/lib/share-types";
import type { YTPlayer } from "@/lib/youtube-player";

type Props = { share: ShareDto; viewerEmail: string | null; canManage: boolean };

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}
function trackText(s: ShareSub, lang: LangCode | null): string {
  return lang ? (s.texts?.[lang] ?? s.text) : s.text;
}
function availableTracks(subs: ShareSub[]): LangCode[] {
  return LANG_CODES.filter(l => subs.some(s => (s.texts?.[l] ?? "").trim().length > 0));
}
function findActive(subs: ShareSub[], t: number): ShareSub | undefined {
  for (let i = subs.length - 1; i >= 0; i--) {
    if (t >= subs[i].start && t <= subs[i].end) return subs[i];
  }
  return undefined;
}
function applyYtCaptions(pl: YTPlayer | null, show: boolean) {
  if (!pl) return;
  try {
    if (show) { pl.loadModule("captions"); pl.loadModule("cc"); }
    else { pl.unloadModule("captions"); pl.unloadModule("cc"); }
  } catch { /* not ready */ }
}
function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function ShareViewer({ share, viewerEmail, canManage }: Props) {
  const subs = useMemo(() => normalizeCues([...(share.subs ?? [])].sort((a, b) => a.start - b.start)), [share.subs]);
  const tracks = useMemo(() => availableTracks(subs), [subs]);
  const [lang, setLang] = useState<LangCode | null>(share.activeLang ?? tracks[0] ?? null);
  const [secondary, setSecondary] = useState<LangCode | "">(share.secondaryLang ?? "");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [ytReady, setYtReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [render, setRender] = useState({
    status: share.renderStatus, progress: share.renderProgress, error: share.renderError, downloadUrl: share.downloadUrl,
  });
  const [renderBusy, setRenderBusy] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const isFile = !!share.fileVideoUrl && !share.videoId;
  const preset = SUBTITLE_PRESETS[share.preset] ?? SUBTITLE_PRESETS[0];

  /* ── YouTube IFrame ──────────────────────────────────── */
  useEffect(() => {
    if (isFile) return;
    if (window.YT) { setYtReady(true); return; }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => setYtReady(true);
  }, [isFile]);

  useEffect(() => {
    if (isFile || !ytReady || !share.videoId) return;
    setLoading(true);
    playerRef.current = new window.YT.Player("share-yt-player", {
      videoId: share.videoId,
      width: "100%", height: "100%",
      playerVars: { autoplay: 0, controls: 0, modestbranding: 1, rel: 0, fs: 0, iv_load_policy: 3, disablekb: 1, playsinline: 1 },
      events: {
        onReady: (e: { target: YTPlayer }) => { setDuration(e.target.getDuration()); setLoading(false); applyYtCaptions(e.target, false); },
        onStateChange: (e: { data: number }) => {
          if (e.data === window.YT.PlayerState.PLAYING) { setPlaying(true); applyYtCaptions(playerRef.current, false); }
          else if (e.data === window.YT.PlayerState.PAUSED || e.data === window.YT.PlayerState.ENDED) setPlaying(false);
        },
        onApiChange: () => applyYtCaptions(playerRef.current, false),
      },
    } as Record<string, unknown>);
    return () => { try { playerRef.current?.destroy(); } catch { /* ignore */ } playerRef.current = null; };
  }, [ytReady, share.videoId, isFile]);

  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (!isFile && playing && playerRef.current) {
      tickRef.current = setInterval(() => { if (playerRef.current) setCurrentTime(playerRef.current.getCurrentTime()); }, 100);
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [playing, isFile]);

  /* ── HTML5 video ─────────────────────────────────────── */
  useEffect(() => {
    if (!isFile || !videoRef.current) return;
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
  }, [isFile, share.fileVideoUrl]);

  /* ── 컨트롤 ──────────────────────────────────────────── */
  const togglePlay = useCallback(() => {
    if (isFile) { const v = videoRef.current; if (!v) return; if (playing) v.pause(); else v.play(); }
    else { const p = playerRef.current; if (!p) return; if (playing) p.pauseVideo(); else p.playVideo(); }
  }, [isFile, playing]);
  const seekTo = useCallback((sec: number) => {
    setCurrentTime(sec);
    if (isFile) { if (videoRef.current) videoRef.current.currentTime = sec; }
    else playerRef.current?.seekTo(sec, true);
  }, [isFile]);
  const toggleMute = useCallback(() => {
    if (isFile) { const v = videoRef.current; if (!v) return; v.muted = !v.muted; setMuted(v.muted); }
    else { const p = playerRef.current; if (!p) return; if (p.isMuted()) { p.unMute(); setMuted(false); } else { p.mute(); setMuted(true); } }
  }, [isFile]);
  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else Promise.resolve(el.requestFullscreen?.()).catch(() => {});
  }, []);
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement && document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      if (e.key === "f" || e.key === "F") { e.preventDefault(); toggleFullscreen(); }
      if (e.key === " ") { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFullscreen, togglePlay]);

  /* ── 렌더링 상태 폴링 ────────────────────────────────── */
  useEffect(() => {
    if (render.status !== "queued" && render.status !== "rendering") return;
    const id = setInterval(async () => {
      try {
        const r = await fetch(`/api/share/${share.token}/render`, { cache: "no-store" });
        const d = await r.json();
        if (r.ok) setRender({ status: d.status, progress: d.progress ?? 0, error: d.error ?? null, downloadUrl: d.downloadUrl ?? null });
      } catch { /* 다음 폴링 */ }
    }, 4000);
    return () => clearInterval(id);
  }, [render.status, share.token]);

  const startRender = async (force = false) => {
    setRenderBusy(true);
    try {
      const r = await fetch(`/api/share/${share.token}/render`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok || r.status === 409) setRender({ status: d.status ?? "queued", progress: d.progress ?? 0, error: d.error ?? null, downloadUrl: d.downloadUrl ?? null });
      else setRender(prev => ({ ...prev, error: d.error || `요청 실패 (${r.status})` }));
    } finally { setRenderBusy(false); }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  /* ── 파생 ─────────────────────────────────────────────── */
  const active = findActive(subs, currentTime);
  const primaryText = active ? trackText(active, lang) : "";
  const secondaryText = active && secondary ? (active.texts?.[secondary] ?? "") : "";
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const exportBase = share.title || "subtitles";
  const cues = (withSecondary: boolean) => subs.map(s => ({
    start: s.start, end: s.end,
    lines: [trackText(s, lang), ...(withSecondary && secondary ? [s.texts?.[secondary] ?? ""] : [])],
  }));
  const rendering = render.status === "queued" || render.status === "rendering";

  // 활성 자막 행이 보이도록 스크롤
  useEffect(() => {
    if (!active || !listRef.current) return;
    const row = listRef.current.querySelector<HTMLElement>(`[data-cue="${active.id}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const pill = (on: boolean): React.CSSProperties => ({
    padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: "pointer",
    border: `1px solid ${on ? "var(--brand)" : "var(--border-default)"}`,
    background: on ? "var(--brand-dim)" : "var(--bg-elevated)", color: on ? "#a5b4fc" : "var(--text-secondary)",
    display: "inline-flex", alignItems: "center", gap: 4,
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-void)", color: "var(--text-primary)", padding: "20px 16px 40px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* 헤더 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ background: "var(--gradient-brand)", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 16px var(--brand-glow)" }}>
              <Film size={16} color="white" />
            </div>
            <div style={{ fontFamily: "Outfit", fontWeight: 800, fontSize: 15, color: "var(--text-primary)" }}>KContent<span style={{ color: "#818cf8" }}> Studio</span></div>
            <span className="badge badge-brand" style={{ fontSize: 10, marginLeft: 6 }}>공유된 자막 영상</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-muted)" }}>
            {share.isPublic
              ? <span className="badge badge-gray" style={{ display: "inline-flex", gap: 4, alignItems: "center" }}><Globe size={10} />공개 링크</span>
              : <span className="badge badge-gray" style={{ display: "inline-flex", gap: 4, alignItems: "center" }}><Lock size={10} />회원 전용</span>}
            {viewerEmail && <span>{viewerEmail}</span>}
            {canManage && <Link href="/dashboard/studio" className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>스튜디오로</Link>}
          </div>
        </div>

        {/* 제목·메타 */}
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>{share.title}</h1>
          <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {share.createdBy && <span>제작: {share.createdBy.name || share.createdBy.email}</span>}
            <span>{new Date(share.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" })}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Eye size={11} />{share.views}</span>
            {share.sourceLang && lang && share.sourceLang !== lang && (
              <span style={{ color: "#a5b4fc" }}>{LANGS[share.sourceLang].flag} {LANGS[share.sourceLang].label} → {LANGS[lang].flag} {LANGS[lang].label}</span>
            )}
            <span>자막 {subs.length}개</span>
          </div>
        </div>

        {/* 플레이어 */}
        <div ref={containerRef} style={{
          background: "#000", borderRadius: isFullscreen ? 0 : 10, overflow: "hidden",
          border: isFullscreen ? "none" : "1px solid var(--border-default)",
          aspectRatio: isFullscreen ? "auto" : "16/9", position: "relative",
        }}>
          {isFile ? (
            <video ref={videoRef} src={share.fileVideoUrl ?? undefined} style={{ width: "100%", height: "100%", objectFit: "contain" }} preload="metadata" />
          ) : (
            <div id="share-yt-player" style={{ width: "100%", height: "100%" }} />
          )}
          {loading && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", zIndex: 5 }}>
              <Loader size={28} color="#818cf8" style={{ animation: "spin 1s linear infinite" }} />
            </div>
          )}
          {primaryText && (
            <div
              lang={lang ? LANGS[lang].htmlLang : undefined}
              style={{
                position: "absolute", transform: "translateX(-50%)",
                ...overlayPlacement(share.overlayPos, share.overlayX, share.overlayY),
                background: preset.bg, color: preset.color,
                padding: isFullscreen ? "12px 28px" : "8px 18px", borderRadius: isFullscreen ? 10 : 6,
                fontSize: `calc(${isFullscreen ? "clamp(22px, 2.8vw, 48px)" : "clamp(13px, 1.6vw, 18px)"} * ${subtitleScale(primaryText)})`, fontWeight: 600,
                fontFamily: fontStackFor(lang, preset.font), textAlign: "center",
                maxWidth: SUBTITLE_MAX_WIDTH, lineHeight: 1.5, whiteSpace: "pre-wrap", zIndex: 3, pointerEvents: "none",
              }}>
              {primaryText}
              {secondaryText && (
                <div lang={secondary ? LANGS[secondary].htmlLang : undefined}
                  style={{ fontSize: isFullscreen ? "clamp(16px, 1.9vw, 32px)" : "0.78em", fontWeight: 500, opacity: 0.85, marginTop: isFullscreen ? 8 : 4, fontFamily: fontStackFor(secondary || null, preset.font) }}>
                  {secondaryText}
                </div>
              )}
            </div>
          )}
          <div style={{ position: "absolute", top: 10, left: 12, display: "flex", gap: 6, zIndex: 3, pointerEvents: "none" }}>
            {lang && (
              <div style={{ background: "rgba(0,0,0,0.6)", color: "white", padding: "3px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700 }}>
                {LANGS[lang].flag} {LANGS[lang].short}{secondary && <> + {LANGS[secondary].short}</>}
              </div>
            )}
          </div>
          <div style={{ position: "absolute", top: 10, right: 12, display: "flex", gap: 6, alignItems: "center", zIndex: 4 }}>
            <button onClick={e => { e.stopPropagation(); toggleFullscreen(); }} title={isFullscreen ? "전체화면 종료 (Esc / F)" : "전체화면 (F)"}
              style={{ background: "rgba(0,0,0,0.6)", color: "white", padding: "3px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
              {isFullscreen ? <Minimize2 size={11} /> : <Maximize2 size={11} />}{isFullscreen ? "종료" : "전체화면"}
            </button>
            <div style={{ background: "rgba(0,0,0,0.6)", color: "white", padding: "3px 8px", borderRadius: 5, fontSize: 12, fontFamily: "JetBrains Mono, monospace", pointerEvents: "none" }}>
              {fmt(currentTime)} / {fmt(duration)}
            </div>
          </div>
          <div onClick={togglePlay} style={{ position: "absolute", inset: 0, zIndex: 2, cursor: "pointer" }} />
        </div>

        {/* 컨트롤 */}
        <div className="card" style={{ padding: "12px 16px" }}>
          <div style={{ position: "relative", marginBottom: 12, cursor: "pointer" }}
            onClick={e => { const r = e.currentTarget.getBoundingClientRect(); seekTo(((e.clientX - r.left) / r.width) * duration); }}>
            <div className="timeline-track" style={{ height: 36, background: "var(--bg-input)" }}>
              {duration > 0 && subs.map(s => (
                <div key={s.id} className="timeline-segment" style={{
                  left: `${(s.start / duration) * 100}%`, width: `${((s.end - s.start) / duration) * 100}%`,
                  background: "rgba(99,102,241,0.25)", color: "#a5b4fc", borderLeft: "2px solid #6366f1",
                }}>{trackText(s, lang).slice(0, 14)}</div>
              ))}
              <div className="timeline-playhead" style={{ left: `${pct}%` }} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button className="btn-icon" onClick={() => seekTo(0)}><SkipBack size={14} /></button>
            <button onClick={togglePlay} style={{ width: 36, height: 36, borderRadius: 8, background: "var(--gradient-brand)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 12px var(--brand-glow)" }}>
              {playing ? <Pause size={16} color="white" fill="white" /> : <Play size={16} color="white" fill="white" />}
            </button>
            <div style={{ flex: 1, font: "12px JetBrains Mono, monospace", color: "var(--text-muted)" }}>{fmt(currentTime)} / {fmt(duration)}</div>
            {tracks.length > 1 && (
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                {tracks.map(l => (
                  <button key={l} style={pill(l === lang)} onClick={() => { setLang(l); if (secondary === l) setSecondary(""); }} title={LANGS[l].label}>
                    {LANGS[l].flag} {LANGS[l].short}{l === lang && <Check size={10} />}
                  </button>
                ))}
                <select className="input" style={{ fontSize: 11, padding: "4px 8px", width: "auto" }} value={secondary} onChange={e => setSecondary(e.target.value as LangCode | "")}>
                  <option value="">보조 자막 없음</option>
                  {tracks.filter(l => l !== lang).map(l => <option key={l} value={l}>+ {LANGS[l].label}</option>)}
                </select>
              </div>
            )}
            <button className="btn-icon" onClick={toggleMute}>{muted ? <VolumeX size={14} /> : <Volume2 size={14} />}</button>
            <button className="btn-icon" onClick={toggleFullscreen} title="전체화면 (F)">{isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>
          </div>
        </div>

        <div className="share-grid" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
          {/* 자막 목록 */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)", fontSize: 12, fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
              <span>자막 {lang ? `· ${LANGS[lang].flag} ${LANGS[lang].label}` : ""}</span>
              <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>클릭하면 해당 위치로 이동</span>
            </div>
            <div ref={listRef} style={{ maxHeight: 360, overflowY: "auto" }}>
              {subs.map(s => {
                const on = active?.id === s.id;
                return (
                  <div key={s.id} data-cue={s.id} onClick={() => seekTo(s.start)} style={{
                    display: "grid", gridTemplateColumns: "56px 1fr", padding: "8px 14px", cursor: "pointer", fontSize: 13,
                    background: on ? "rgba(99,102,241,0.08)" : "transparent", borderLeft: on ? "2px solid var(--brand)" : "2px solid transparent",
                    borderBottom: "1px solid rgba(30,30,46,0.5)",
                  }}>
                    <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--text-muted)" }}>{fmt(s.start)}</span>
                    <div>
                      <div lang={lang ? LANGS[lang].htmlLang : undefined} style={{ fontFamily: fontStackFor(lang, "Inter"), lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{trackText(s, lang)}</div>
                      {secondary && s.texts?.[secondary] && (
                        <div lang={LANGS[secondary].htmlLang} style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, fontFamily: fontStackFor(secondary, "Inter"), whiteSpace: "pre-wrap" }}>{s.texts[secondary]}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 다운로드 · 공유 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                자막 입힌 MP4
              </div>
              {render.status === "done" && render.downloadUrl ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <a className="btn btn-green" href={render.downloadUrl} style={{ gap: 8, textDecoration: "none", justifyContent: "center" }}>
                    <Download size={15} /> MP4 다운로드
                  </a>
                  <video src={`${render.downloadUrl}?inline=1`} controls preload="none" style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border-default)", background: "#000" }} />
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>자막이 영상에 직접 입혀진 파일입니다. 어디서든 자막이 함께 재생됩니다.</div>
                </div>
              ) : rendering ? (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Loader size={12} style={{ animation: "spin 1s linear infinite" }} />{render.status === "queued" ? "렌더링 대기 중" : "렌더링 중"}</span>
                    <span>{render.progress}%</span>
                  </div>
                  <div className="progress-track"><div className="progress-fill" style={{ width: `${render.progress}%`, background: "var(--gradient-brand)" }} /></div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>완료되면 이 자리에 다운로드 버튼이 나타납니다. 페이지를 열어 두면 자동으로 갱신됩니다.</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {render.status === "failed" && <div style={{ fontSize: 11, color: "#f87171" }}>렌더링 실패: {render.error}</div>}
                  {canManage ? (
                    <button className="btn btn-brand" disabled={renderBusy} onClick={() => startRender(render.status === "failed")} style={{ gap: 8, justifyContent: "center" }}>
                      {renderBusy ? <Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Clapperboard size={15} />}
                      자막 입힌 MP4 만들기{render.status === "failed" ? " (다시 시도)" : ""}
                    </button>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>아직 렌더링된 MP4 가 없습니다. 제작자가 만들면 여기에서 다운로드할 수 있습니다.</div>
                  )}
                </div>
              )}
            </div>

            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                자막 파일
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" style={{ justifyContent: "flex-start", gap: 8 }} onClick={() => downloadFile(toSRT(cues(false)), `${exportBase}${lang ? "." + lang : ""}.srt`, "text/srt")}>
                  <Download size={13} /> SRT 다운로드{lang && ` (${LANGS[lang].short})`}
                </button>
                <button className="btn btn-ghost btn-sm" style={{ justifyContent: "flex-start", gap: 8 }} onClick={() => downloadFile(toVTT(cues(false)), `${exportBase}${lang ? "." + lang : ""}.vtt`, "text/vtt")}>
                  <Download size={13} /> VTT 다운로드{lang && ` (${LANGS[lang].short})`}
                </button>
                {secondary && (
                  <button className="btn btn-ghost btn-sm" style={{ justifyContent: "flex-start", gap: 8 }} onClick={() => downloadFile(toSRT(cues(true)), `${exportBase}.${lang ?? "x"}+${secondary}.srt`, "text/srt")}>
                    <Download size={13} /> 이중 자막 SRT ({lang ? LANGS[lang].short : "?"} + {LANGS[secondary].short})
                  </button>
                )}
              </div>
            </div>

            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                이 페이지 공유
              </div>
              <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center", gap: 8 }} onClick={copyLink}>
                {copied ? <><Check size={13} color="#34d399" />복사됨</> : <><Copy size={13} />링크 복사</>}
              </button>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.6 }}>
                {share.isPublic ? "링크만 있으면 누구나 볼 수 있습니다." : "링크를 받은 사람은 KContent Studio 에 로그인(회원가입)하면 볼 수 있습니다. API 키 등록은 필요 없습니다."}
              </div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", display: "flex", justifyContent: "center", gap: 6, alignItems: "center" }}>
          <Share2 size={11} /> KContent Studio 자막 스튜디오에서 공유된 영상입니다 · 단축키: Space 재생/정지 · F 전체화면
        </div>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 860px) { .share-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
