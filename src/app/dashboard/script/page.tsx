"use client";
import { useState, useEffect, useRef } from "react";
import {
  Link2, Cpu, Sparkles, Copy, Check, Download, ChevronRight,
  Zap, Clock, BarChart2, Eye, MousePointer, Film
} from "lucide-react";

type GenStage = "idle" | "whisper" | "analyzing" | "scripting" | "thumbnail" | "done";

const SCRIPT_LINES = [
  { time: "00:00", ko: "🇺🇸 미국에서 온 닉이 처음으로 한국 편의점 문을 열었습니다.", type: "hook" },
  { time: "00:12", ko: "\"이게 편의점이야?\" — 닉의 표정이 굳어집니다.", type: "reaction" },
  { time: "00:28", ko: "한국 편의점에는 세계 어디에서도 볼 수 없는 것들이 있습니다.", type: "narration" },
  { time: "00:45", ko: "삼각김밥, 컵라면, 구운 계란... 외국인이 충격 받는 이유를 파헤칩니다.", type: "narration" },
  { time: "01:10", ko: "닉: \"이거 먹어도 돼요? 그냥 여기서?\" (편의점 내 취식 문화에 당황)", type: "reaction" },
  { time: "01:34", ko: "🇰🇷 우리에겐 너무나 당연한 것들이 세계에서는 특별합니다.", type: "commentary" },
  { time: "02:05", ko: "1+1 행사에 닉의 눈이 커집니다. \"이게 두 개 다 무료라고요?!\"", type: "reaction" },
  { time: "02:41", ko: "세계 어느 나라도 흉내 내지 못하는 한국 편의점의 진짜 매력", type: "hook" },
];

const TYPE_COLOR: Record<string, string> = {
  hook: "#f59e0b",
  reaction: "#6366f1",
  narration: "#10b981",
  commentary: "#ec4899",
};

const TYPE_LABEL: Record<string, string> = {
  hook: "훅",
  reaction: "반응",
  narration: "나레이션",
  commentary: "해설",
};

const STAGE_INFO: Record<GenStage, { label: string; pct: number }> = {
  idle: { label: "", pct: 0 },
  whisper: { label: "Whisper AI 음성 인식 중...", pct: 18 },
  analyzing: { label: "GPT-4o Vision 장면 분석 중...", pct: 42 },
  scripting: { label: "K-문화 서사 대본 작성 중...", pct: 71 },
  thumbnail: { label: "썸네일 카피 & 제목 생성 중...", pct: 90 },
  done: { label: "생성 완료!", pct: 100 },
};

export default function ScriptPage() {
  const [url, setUrl] = useState("");
  const [stage, setStage] = useState<GenStage>("idle");
  const [scriptLines, setScriptLines] = useState<typeof SCRIPT_LINES>([]);
  const [streamIdx, setStreamIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [title, setTitle] = useState("");
  const [thumbCopy, setThumbCopy] = useState({ top: "", bottom: "" });

  const generate = () => {
    if (!url) setUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    const seq: GenStage[] = ["whisper", "analyzing", "scripting", "thumbnail", "done"];
    const delays = [0, 1600, 3200, 5200, 6800];
    seq.forEach((s, i) => setTimeout(() => {
      setStage(s);
      if (s === "done") {
        setTitle("[외국인 반응] 한국 편의점 처음 가본 미국인이 경악한 이유 (세계 최고 편의점)");
        setThumbCopy({ top: "미국인이 한국 편의점 보고 경악한 이유", bottom: "\"이게 편의점이라고?!\"" });
        // Stream script lines
        let idx = 0;
        const t = setInterval(() => {
          setScriptLines(prev => {
            if (idx < SCRIPT_LINES.length) {
              idx++;
              return SCRIPT_LINES.slice(0, idx);
            }
            clearInterval(t);
            return prev;
          });
        }, 220);
      }
    }, delays[i]));
  };

  const isRunning = stage !== "idle" && stage !== "done";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 1000 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>AI 대본 엔진</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>원본 영상 URL 입력 → Whisper 음성인식 + GPT-4o Vision → K-문화 서사 대본 자동 생성</p>
      </div>

      {/* Input */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div className="input-group" style={{ flex: 1 }}>
            <Link2 size={15} className="input-icon" />
            <input className="input" value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..." />
          </div>
          <button className="btn btn-brand" onClick={generate} disabled={isRunning}
            style={{ padding: "0 22px", gap: 7 }}>
            {isRunning
              ? <><svg width={14} height={14} viewBox="0 0 24 24" style={{ animation: "spin 0.9s linear infinite" }}><circle cx={12} cy={12} r={10} fill="none" stroke="white" strokeWidth={3} strokeDasharray="40 60" /></svg>생성 중...</>
              : <><Sparkles size={14} /> K-문화 대본 생성</>}
          </button>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-muted)" }}>
          {[
            { icon: <Zap size={11} />, text: "Whisper 음성 인식" },
            { icon: <Eye size={11} />, text: "GPT-4o 장면 분석" },
            { icon: <Cpu size={11} />, text: "K-문화 서사 자동 구성" },
            { icon: <MousePointer size={11} />, text: "CTR 클릭 유도 제목 생성" },
          ].map(({ icon, text }, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: "var(--text-muted)" }}>{icon}</span>{text}
            </span>
          ))}
        </div>
      </div>

      {/* Progress */}
      {stage !== "idle" && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 13, color: stage === "done" ? "#34d399" : "#818cf8", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
              {stage !== "done" && <svg width={13} height={13} viewBox="0 0 24 24" style={{ animation: "spin 0.9s linear infinite", flexShrink: 0 }}><circle cx={12} cy={12} r={10} fill="none" stroke="currentColor" strokeWidth={3} strokeDasharray="40 60" /></svg>}
              {STAGE_INFO[stage].label}
            </div>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>{STAGE_INFO[stage].pct}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${STAGE_INFO[stage].pct}%`, background: stage === "done" ? "var(--gradient-green)" : "var(--gradient-brand)", transition: "width 0.8s ease" }} />
          </div>
        </div>
      )}

      {/* Result */}
      {stage === "done" && (
        <>
          {/* Auto Title */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              AI 생성 제목
            </div>
            <input className="input" defaultValue={title} style={{ fontSize: 15, fontWeight: 600 }} />
          </div>

          {/* Thumbnail Caption */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
              썸네일 카피 (클릭 유도)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 5 }}>상단 텍스트</label>
                <input className="input" defaultValue={thumbCopy.top} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 5 }}>하단 텍스트 (임팩트)</label>
                <input className="input" defaultValue={thumbCopy.bottom} />
              </div>
            </div>
          </div>

          {/* Script Timeline */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>자막 타임라인</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>클릭하여 편집 · 시청 지속률 최적화 구조</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard.writeText(scriptLines.map(l => `${l.time}  ${l.ko}`).join("\n")); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                  {copied ? <><Check size={12} color="#34d399" />복사됨</> : <><Copy size={12} />전체 복사</>}
                </button>
                <a href="/dashboard/studio" style={{ textDecoration: "none" }}>
                  <button className="btn btn-brand btn-sm"><Film size={12} />편집 스튜디오로</button>
                </a>
              </div>
            </div>
            {/* Type Legend */}
            <div style={{ padding: "10px 18px", borderBottom: "1px solid var(--border-subtle)", display: "flex", gap: 12, flexWrap: "wrap" }}>
              {Object.entries(TYPE_COLOR).map(([type, color]) => (
                <span key={type} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-muted)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: "inline-block" }} />
                  {TYPE_LABEL[type]}
                </span>
              ))}
            </div>
            <div>
              {scriptLines.map((line, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "72px 56px 1fr", borderBottom: "1px solid rgba(30,30,46,0.5)", transition: "background 0.2s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.015)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}>
                  <div style={{ padding: "13px 14px", borderRight: "1px solid var(--border-subtle)", fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
                    {line.time}
                  </div>
                  <div style={{ padding: "13px 10px", borderRight: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: TYPE_COLOR[line.type], background: TYPE_COLOR[line.type] + "18", padding: "2px 6px", borderRadius: 4, letterSpacing: "0.04em" }}>
                      {TYPE_LABEL[line.type]}
                    </span>
                  </div>
                  <div style={{ padding: "13px 16px", display: "flex", alignItems: "center" }}>
                    <textarea defaultValue={line.ko} rows={1} style={{
                      width: "100%", background: "transparent", border: "none", outline: "none",
                      color: "var(--text-primary)", fontSize: 13.5, lineHeight: 1.5, resize: "none",
                      fontFamily: "Inter, sans-serif"
                    }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Estimated metrics */}
            <div style={{ padding: "14px 18px", background: "var(--bg-elevated)", display: "flex", gap: 24, flexWrap: "wrap" }}>
              {[
                { label: "예상 CTR", val: "8.4%", note: "업계 평균 4.2%의 2배" },
                { label: "예상 시청 지속률", val: "68%", note: "K-문화 평균 51% 상회" },
                { label: "예상 CPM", val: "₩21,500", note: "교육/문화 카테고리 기준" },
              ].map(({ label, val, note }) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#4ade80", fontFamily: "Outfit" }}>{val}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{note}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
