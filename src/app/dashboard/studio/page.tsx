"use client";
import { useState, useRef } from "react";
import {
  Link2, Subtitles, Download, Copy, Check, ChevronDown, ChevronUp,
  Play, Sparkles, Globe, FileText, Wand2, Clock, AlertCircle
} from "lucide-react";

type SubtitleLine = { index: number; start: string; end: string; original: string; translated: string; editing: boolean };

const DEMO_SUBTITLES: SubtitleLine[] = [
  { index: 1, start: "00:00:02", end: "00:00:06", original: "Hey guys, welcome back to my channel!", translated: "안녕하세요! 채널에 돌아오신 것을 환영합니다!", editing: false },
  { index: 2, start: "00:00:07", end: "00:00:12", original: "Today we're going to talk about something super interesting.", translated: "오늘은 정말 흥미로운 주제에 대해 이야기해볼게요.", editing: false },
  { index: 3, start: "00:00:13", end: "00:00:19", original: "I've been getting so many questions about this topic lately.", translated: "요즘 이 주제에 대한 질문을 정말 많이 받고 있거든요.", editing: false },
  { index: 4, start: "00:00:20", end: "00:00:27", original: "So today I'm going to answer all of them in one video.", translated: "그래서 오늘 이 영상 하나에서 모든 질문에 답해드릴게요.", editing: false },
  { index: 5, start: "00:00:28", end: "00:00:35", original: "Make sure you stick around until the end because there's a surprise!", translated: "마지막까지 꼭 봐주세요, 깜짝 선물이 있거든요!", editing: false },
  { index: 6, start: "00:00:36", end: "00:00:44", original: "First, let's start with the basics that everyone needs to know.", translated: "먼저, 모든 사람이 알아야 할 기본부터 시작해봅시다.", editing: false },
];

type Stage = "idle" | "loading" | "extracting" | "translating" | "done";

export default function StudioPage() {
  const [url, setUrl] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [subtitles, setSubtitles] = useState<SubtitleLine[]>([]);
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState<number | null>(null);
  const [leadText, setLeadText] = useState(`📢 무료 특강 신청 → https://kcontent-hub.com/apply

🔥 지금 신청하면 무료 자료 + 라이브 특강 무료!

✅ 촬영 없이 월 200만원 수익 방법 공개
✅ 해외 영상으로 유튜브 채널 운영하는 법
✅ 리드 수집 & 강의 판매 자동화 전략

📌 비즈니스 문의: contact@kcontent-hub.com`);

  const runAutomate = () => {
    if (!url && stage === "idle") {
      setUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    }
    setStage("loading");
    setProgress(0);

    const steps: { stage: Stage; progress: number; delay: number }[] = [
      { stage: "loading", progress: 15, delay: 400 },
      { stage: "extracting", progress: 40, delay: 1200 },
      { stage: "translating", progress: 70, delay: 2400 },
      { stage: "done", progress: 100, delay: 3600 },
    ];

    steps.forEach(({ stage: s, progress: p, delay: d }) => {
      setTimeout(() => {
        setStage(s);
        setProgress(p);
        if (s === "done") setSubtitles(DEMO_SUBTITLES);
      }, d);
    });
  };

  const handleCopy = (index: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(index);
    setTimeout(() => setCopied(null), 1500);
  };

  const downloadSRT = () => {
    const srt = subtitles.map(({ index, start, end, translated }) =>
      `${index}\n${start},000 --> ${end},000\n${translated}\n`
    ).join("\n");
    const blob = new Blob([srt], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "subtitle_ko.srt";
    a.click();
  };

  const downloadVTT = () => {
    const vtt = "WEBVTT\n\n" + subtitles.map(({ index, start, end, translated }) =>
      `${index}\n${start}.000 --> ${end}.000\n${translated}\n`
    ).join("\n");
    const blob = new Blob([vtt], { type: "text/vtt" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "subtitle_ko.vtt";
    a.click();
  };

  const STAGE_LABELS: Record<Stage, string> = {
    idle: "",
    loading: "영상 정보 불러오는 중...",
    extracting: "원문 자막 추출 중...",
    translating: "GPT로 한국어 번역 중...",
    done: "자막 생성 완료!"
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1100 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>자막 스튜디오 🎬</h1>
        <p style={{ color: "#71717a" }}>유튜브 URL을 입력하면 AI가 자막을 추출하고 한국어로 자동 번역합니다</p>
      </div>

      {/* URL Input */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Link2 size={18} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#52525b" }} />
            <input
              className="input-dark"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              style={{ paddingLeft: 44 }}
            />
          </div>
          <button className="btn-primary" onClick={runAutomate}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 24px", whiteSpace: "nowrap" }}>
            <Wand2 size={18} />
            자동 번역 시작
          </button>
        </div>

        {/* Tips */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {[
            { icon: Globe, text: "영어, 일본어, 스페인어 등 20개 언어 지원" },
            { icon: Clock, text: "평균 처리 시간: 3~5분" },
            { icon: Subtitles, text: "SRT / VTT 형식 다운로드" },
          ].map(({ icon: Icon, text }, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#71717a" }}>
              <Icon size={14} color="#52525b" /> {text}
            </div>
          ))}
        </div>
      </div>

      {/* Progress */}
      {stage !== "idle" && stage !== "done" && (
        <div className="card" style={{ padding: 28, textAlign: "center" }}>
          <div style={{
            width: 64, height: 64, border: "3px solid rgba(239,68,68,0.2)", borderTop: "3px solid #ef4444",
            borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 20px"
          }} />
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{STAGE_LABELS[stage]}</div>
          <div className="progress-bar" style={{ maxWidth: 400, margin: "0 auto" }}>
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div style={{ fontSize: 13, color: "#71717a", marginTop: 10 }}>{progress}% 완료</div>
        </div>
      )}

      {/* Results */}
      {stage === "done" && (
        <>
          {/* Actions */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div className="badge badge-green" style={{ fontSize: 14, padding: "8px 16px" }}>
              ✓ {subtitles.length}개 자막 라인 생성 완료
            </div>
            <button className="btn-primary" onClick={downloadSRT}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px" }}>
              <Download size={16} /> SRT 다운로드
            </button>
            <button className="btn-secondary" onClick={downloadVTT}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px" }}>
              <Download size={16} /> VTT 다운로드
            </button>
          </div>

          {/* Subtitle Editor */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 17, fontWeight: 700 }}>자막 편집기</h2>
              <span style={{ fontSize: 13, color: "#71717a" }}>클릭하여 수정 가능</span>
            </div>
            <div>
              {subtitles.map((line, idx) => (
                <div key={idx} style={{
                  display: "grid", gridTemplateColumns: "80px 1fr 1fr 40px",
                  gap: 0, borderBottom: "1px solid rgba(39,39,42,0.5)",
                  transition: "background 0.2s"
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  {/* Time */}
                  <div style={{ padding: "14px 16px", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ fontSize: 11, color: "#52525b", fontFamily: "monospace" }}>{line.start}</div>
                    <div style={{ fontSize: 11, color: "#3f3f46", fontFamily: "monospace" }}>↕</div>
                    <div style={{ fontSize: 11, color: "#52525b", fontFamily: "monospace" }}>{line.end}</div>
                  </div>
                  {/* Original */}
                  <div style={{ padding: "14px 16px", borderRight: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 11, color: "#52525b", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>원문 (EN)</div>
                    <div style={{ fontSize: 14, color: "#a1a1aa", lineHeight: 1.5 }}>{line.original}</div>
                  </div>
                  {/* Translated */}
                  <div style={{ padding: "14px 16px", borderRight: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 11, color: "#52525b", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>번역 (KO)</div>
                    <textarea
                      defaultValue={line.translated}
                      style={{
                        width: "100%", background: "transparent", border: "none", outline: "none",
                        color: "white", fontSize: 14, lineHeight: 1.5, resize: "none", fontFamily: "Inter, sans-serif",
                        minHeight: 48
                      }}
                    />
                  </div>
                  {/* Actions */}
                  <div style={{ padding: "14px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <button onClick={() => handleCopy(idx, line.translated)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#52525b", padding: 4 }}>
                      {copied === idx ? <Check size={14} color="#4ade80" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lead Description Generator */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>설명란 리드 자동 생성</h2>
                <p style={{ fontSize: 13, color: "#71717a" }}>영상 설명란에 삽입할 리드 수집 문구를 자동 생성합니다</p>
              </div>
              <button className="btn-primary" style={{ padding: "8px 18px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                <Sparkles size={15} /> AI 재생성
              </button>
            </div>
            <textarea
              value={leadText}
              onChange={e => setLeadText(e.target.value)}
              rows={8}
              style={{
                width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)",
                borderRadius: 10, padding: "14px 16px", color: "white", fontSize: 14,
                lineHeight: 1.7, resize: "vertical", fontFamily: "Inter, sans-serif", outline: "none"
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="btn-primary" onClick={() => { navigator.clipboard.writeText(leadText); }}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", fontSize: 13 }}>
                <Copy size={14} /> 복사
              </button>
              <a href="/dashboard/scheduler" style={{ textDecoration: "none" }}>
                <button className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", fontSize: 13 }}>
                  스케줄러로 보내기 →
                </button>
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
