"use client";
import { useState, useRef } from "react";
import {
  Play, Pause, Download, SkipBack, Volume2,
  Type, Palette, AlignLeft, Layers, Scissors, Image, Send, Check, Zap
} from "lucide-react";

const DEMO_SUBS = [
  { id: 1, start: 0, end: 7, text: "🇺🇸 미국에서 온 닉이 처음으로 한국 편의점 문을 열었습니다.", type: "narration" },
  { id: 2, start: 8, end: 15, text: "\"이게 편의점이야?\" — 닉의 표정이 굳어집니다.", type: "reaction" },
  { id: 3, start: 16, end: 26, text: "한국 편의점에는 세계 어디에서도 볼 수 없는 것들이 있습니다.", type: "narration" },
  { id: 4, start: 27, end: 38, text: "삼각김밥, 컵라면, 구운 계란... 외국인이 충격 받는 이유를 파헤칩니다.", type: "narration" },
  { id: 5, start: 39, end: 52, text: "닉: \"이거 먹어도 돼요? 그냥 여기서?\" (편의점 내 취식 문화에 당황)", type: "reaction" },
  { id: 6, start: 53, end: 65, text: "🇰🇷 우리에겐 너무나 당연한 것들이 세계에서는 특별합니다.", type: "commentary" },
];

const TYPE_COLORS: Record<string, string> = {
  narration: "#10b981",
  reaction: "#6366f1",
  hook: "#f59e0b",
  commentary: "#ec4899",
};

const FONT_PRESETS = [
  { name: "기본 흰색", color: "#ffffff", bg: "rgba(0,0,0,0.7)", font: "Inter" },
  { name: "노란 강조", color: "#fbbf24", bg: "rgba(0,0,0,0.8)", font: "Outfit" },
  { name: "K-뉴스", color: "#ffffff", bg: "rgba(239,68,68,0.85)", font: "Outfit" },
  { name: "모노 코드", color: "#7c85f0", bg: "rgba(10,10,20,0.9)", font: "JetBrains Mono" },
];

const VIDEO_DURATION = 65;

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function StudioPage() {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedSub, setSelectedSub] = useState<number | null>(null);
  const [subs, setSubs] = useState(DEMO_SUBS);
  const [preset, setPreset] = useState(0);
  const [exported, setExported] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const togglePlay = () => {
    if (playing) {
      clearInterval(timerRef.current!);
      setPlaying(false);
    } else {
      setPlaying(true);
      timerRef.current = setInterval(() => {
        setCurrentTime(t => {
          if (t >= VIDEO_DURATION) { setPlaying(false); clearInterval(timerRef.current!); return 0; }
          return t + 0.1;
        });
      }, 100);
    }
  };

  const activeSub = subs.find(s => currentTime >= s.start && currentTime <= s.end);
  const p = FONT_PRESETS[preset];
  const pct = (currentTime / VIDEO_DURATION) * 100;

  const updateSubText = (id: number, text: string) => {
    setSubs(prev => prev.map(s => s.id === id ? { ...s, text } : s));
  };

  const handleExport = () => {
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1100 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>편집 스튜디오</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>타임라인 자막 편집 · 스타일 설정 · SRT/VTT 내보내기 · 배포 전달</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 18 }}>
        {/* Left: Preview + Timeline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Video Preview */}
          <div style={{ background: "#000", borderRadius: 10, overflow: "hidden", border: "1px solid var(--border-default)", aspectRatio: "16/9", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {/* Fake video background */}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #1a0a2e, #0a1628, #0d2818)", opacity: 0.9 }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.15)", fontSize: 13 }}>
                [원본 영상 미리보기]<br />
                <span style={{ fontSize: 11 }}>실제 사용 시 YouTube URL로 스트리밍</span>
              </div>
            </div>
            {/* Subtitle overlay */}
            {activeSub && (
              <div style={{
                position: "absolute", bottom: "12%", left: "50%", transform: "translateX(-50%)",
                background: p.bg, color: p.color, padding: "8px 18px", borderRadius: 6,
                fontSize: 16, fontWeight: 600, fontFamily: p.font, textAlign: "center",
                maxWidth: "80%", lineHeight: 1.5, whiteSpace: "pre-wrap",
                transition: "opacity 0.2s"
              }}>
                {activeSub.text}
              </div>
            )}
            {/* Time overlay */}
            <div style={{ position: "absolute", top: 10, right: 12, background: "rgba(0,0,0,0.6)", color: "white", padding: "3px 8px", borderRadius: 5, fontSize: 12, fontFamily: "JetBrains Mono, monospace" }}>
              {formatTime(currentTime)} / {formatTime(VIDEO_DURATION)}
            </div>
          </div>

          {/* Player Controls */}
          <div className="card" style={{ padding: "12px 16px" }}>
            <div style={{ position: "relative", marginBottom: 12, cursor: "pointer" }}
              onClick={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                setCurrentTime(((e.clientX - rect.left) / rect.width) * VIDEO_DURATION);
              }}>
              {/* Background segments */}
              <div className="timeline-track" style={{ height: 44, background: "var(--bg-input)" }}>
                {subs.map(s => (
                  <div key={s.id} className="timeline-segment"
                    style={{ left: `${(s.start / VIDEO_DURATION) * 100}%`, width: `${((s.end - s.start) / VIDEO_DURATION) * 100}%`, background: TYPE_COLORS[s.type] + "40", color: TYPE_COLORS[s.type], borderLeft: `2px solid ${TYPE_COLORS[s.type]}` }}>
                    {s.text.slice(0, 16)}...
                  </div>
                ))}
                <div className="timeline-playhead" style={{ left: `${pct}%` }} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button className="btn-icon" onClick={() => setCurrentTime(0)}><SkipBack size={14} /></button>
              <button onClick={togglePlay} style={{ width: 36, height: 36, borderRadius: 8, background: "var(--gradient-brand)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 12px var(--brand-glow)" }}>
                {playing ? <Pause size={16} color="white" fill="white" /> : <Play size={16} color="white" fill="white" />}
              </button>
              <div style={{ flex: 1, font: "12px JetBrains Mono, monospace", color: "var(--text-muted)" }}>
                {formatTime(currentTime)} / {formatTime(VIDEO_DURATION)}
              </div>
              <Volume2 size={14} color="var(--text-muted)" />
            </div>
          </div>

          {/* Subtitle List Editor */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", fontSize: 13, fontWeight: 700 }}>자막 편집</div>
            <div>
              {subs.map((s, i) => (
                <div key={s.id}
                  onClick={() => { setSelectedSub(s.id); setCurrentTime(s.start); }}
                  style={{ display: "grid", gridTemplateColumns: "60px 52px 1fr", borderBottom: "1px solid rgba(30,30,46,0.5)", cursor: "pointer", background: selectedSub === s.id ? "rgba(99,102,241,0.05)" : "transparent", borderLeft: selectedSub === s.id ? "2px solid var(--brand)" : "2px solid transparent" }}>
                  <div style={{ padding: "10px 10px", fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>{formatTime(s.start)}</div>
                  <div style={{ padding: "10px 8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: TYPE_COLORS[s.type], display: "inline-block" }} />
                  </div>
                  <textarea value={s.text} onChange={e => updateSubText(s.id, e.target.value)} rows={2}
                    style={{ margin: "8px 12px 8px 0", width: "calc(100% - 12px)", background: "transparent", border: "none", outline: "none", color: "var(--text-primary)", fontSize: 13, resize: "none", fontFamily: "Inter, sans-serif", lineHeight: 1.5 }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Style Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Font Presets */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>자막 스타일</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {FONT_PRESETS.map((fp, i) => (
                <button key={i} onClick={() => setPreset(i)}
                  style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${preset === i ? "var(--brand)" : "var(--border-default)"}`, background: preset === i ? "var(--brand-dim)" : "var(--bg-elevated)", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, transition: "all 0.15s" }}>
                  <div style={{ padding: "4px 10px", borderRadius: 5, background: fp.bg, color: fp.color, fontSize: 11, fontFamily: fp.font, fontWeight: 600, whiteSpace: "nowrap" }}>
                    가나다 Abc
                  </div>
                  <span style={{ fontSize: 12, color: preset === i ? "#818cf8" : "var(--text-muted)", flex: 1, textAlign: "left" }}>{fp.name}</span>
                  {preset === i && <Check size={12} color="#818cf8" />}
                </button>
              ))}
            </div>
          </div>

          {/* Thumbnail Editor */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>썸네일</div>
            <div style={{ background: "linear-gradient(135deg, #7c3aed, #1d4ed8)", borderRadius: 8, aspectRatio: "16/9", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "12px 10px", marginBottom: 10, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)" }} />
              <div style={{ background: "rgba(239,68,68,0.9)", color: "white", fontSize: 12, fontWeight: 800, fontFamily: "Outfit", padding: "4px 12px", borderRadius: 4, position: "relative", zIndex: 1 }}>
                미국인이 한국 편의점 보고 경악한 이유
              </div>
              <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
                <div style={{ color: "white", fontSize: 17, fontWeight: 900, fontFamily: "Outfit", textShadow: "0 2px 8px rgba(0,0,0,0.8)" }}>
                  "이게 편의점이라고?!"
                </div>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ width: "100%", gap: 6 }}>
              <Image size={12} /> 썸네일 편집기 열기
            </button>
          </div>

          {/* Export */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>내보내기</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" style={{ justifyContent: "flex-start", gap: 8 }}>
                <Download size={13} /> SRT 자막 파일 다운로드
              </button>
              <button className="btn btn-ghost btn-sm" style={{ justifyContent: "flex-start", gap: 8 }}>
                <Download size={13} /> VTT 자막 파일 다운로드
              </button>
              <button className="btn btn-ghost btn-sm" style={{ justifyContent: "flex-start", gap: 8 }}>
                <Layers size={13} /> 자막 소각 영상 렌더링
              </button>
            </div>
          </div>

          {/* Send to Publisher */}
          <a href="/dashboard/publisher" style={{ textDecoration: "none" }}>
            <button className="btn btn-brand" onClick={handleExport} style={{ width: "100%", padding: "12px", fontSize: 14, gap: 8 }}>
              {exported ? <><Check size={15} />배포 패널로 전송됨!</> : <><Send size={15} />배포 패널로 보내기</>}
            </button>
          </a>
        </div>
      </div>
    </div>
  );
}
