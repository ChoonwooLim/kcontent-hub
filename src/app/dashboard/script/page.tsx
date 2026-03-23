"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Link2, Sparkles, Copy, Check, Film,
  Zap, Eye, AlertCircle, Loader, CheckCircle2
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

const TYPE_COLOR: Record<string, string> = {
  hook:        "#f59e0b",
  reaction:    "#6366f1",
  narration:   "#10b981",
  commentary:  "#ec4899",
};
const TYPE_LABEL: Record<string, string> = {
  hook: "훅", reaction: "반응", narration: "나레이션", commentary: "해설",
};

function ScriptPageInner() {
  const searchParams = useSearchParams();
  const [url, setUrl] = useState(searchParams.get("url") ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);

  // URL 파라미터가 있으면 자동으로 제목줄에 표시
  useEffect(() => {
    const u = searchParams.get("url");
    if (u) setUrl(decodeURIComponent(u));
  }, [searchParams]);

  const generate = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/script/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "알 수 없는 오류가 발생했습니다.");
        return;
      }
      setResult(data);
    } catch (e) {
      setError(`네트워크 오류: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const copyAll = () => {
    if (!result) return;
    const text = result.script.map(l => `${l.time}  [${TYPE_LABEL[l.type] ?? l.type}]  ${l.ko}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 1000 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>AI 대본 엔진</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          YouTube URL 입력 → 실제 자막 추출 + GPT-4o → K-문화 서사 한국어 대본 자동 생성
        </p>
      </div>

      {/* URL 입력 */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div className="input-group" style={{ flex: 1 }}>
            <Link2 size={15} className="input-icon" />
            <input
              className="input"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !loading && generate()}
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </div>
          <button
            className="btn btn-brand"
            onClick={generate}
            disabled={loading || !url.trim()}
            style={{ padding: "0 22px", gap: 7, whiteSpace: "nowrap" }}
          >
            {loading
              ? <><Loader size={14} style={{ animation: "spin 0.9s linear infinite" }} />생성 중...</>
              : <><Sparkles size={14} />K-문화 대본 생성</>}
          </button>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-muted)" }}>
          {[
            { icon: <Zap size={11} />,       text: "실제 YouTube 자막 추출" },
            { icon: <Eye size={11} />,        text: "GPT-4o 내용 분석" },
            { icon: <Sparkles size={11} />,   text: "K-문화 서사 대본 생성" },
          ].map(({ icon, text }, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {icon}{text}
            </span>
          ))}
        </div>
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <Loader size={28} color="#818cf8" style={{ animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
            YouTube 자막 추출 + GPT-4o 대본 생성 중...
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            실제 API를 호출하고 있습니다. 10~30초 소요됩니다.
          </div>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div style={{
          padding: "14px 16px", borderRadius: 10,
          background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)",
          display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <AlertCircle size={16} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: "#fca5a5", lineHeight: 1.6 }}>{error}</div>
        </div>
      )}

      {/* 결과 */}
      {result && (
        <>
          {/* 메타 정보 */}
          <div style={{
            padding: "10px 14px", borderRadius: 8,
            background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)",
            display: "flex", alignItems: "center", gap: 8, fontSize: 12,
          }}>
            <CheckCircle2 size={14} color="#818cf8" />
            <span style={{ color: "#a5b4fc" }}>
              <strong>{result.channelTitle || "알 수 없는 채널"}</strong>
              {result.videoTitle && ` — ${result.videoTitle}`}
            </span>
            <span style={{ marginLeft: "auto", color: result.hasTranscript ? "#34d399" : "#fbbf24" }}>
              {result.hasTranscript ? "✓ 실제 자막 기반" : "⚠ 자막 없음 (제목/설명 기반)"}
            </span>
          </div>

          {/* AI 생성 제목 */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              AI 생성 제목
            </div>
            <input
              className="input"
              defaultValue={result.title}
              style={{ fontSize: 15, fontWeight: 600 }}
            />
          </div>

          {/* 썸네일 카피 */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
              썸네일 카피
            </div>
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
                  GPT-4o가 생성한 {result.script.length}개 장면 · 클릭하여 편집 가능
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={copyAll}>
                  {copied ? <><Check size={12} color="#34d399" />복사됨</> : <><Copy size={12} />전체 복사</>}
                </button>
                <a href="/dashboard/studio" style={{ textDecoration: "none" }}>
                  <button className="btn btn-brand btn-sm"><Film size={12} />편집 스튜디오로</button>
                </a>
              </div>
            </div>

            {/* 범례 */}
            <div style={{ padding: "10px 18px", borderBottom: "1px solid var(--border-subtle)", display: "flex", gap: 12, flexWrap: "wrap" }}>
              {Object.entries(TYPE_COLOR).map(([type, color]) => (
                <span key={type} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-muted)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: "inline-block" }} />
                  {TYPE_LABEL[type]}
                </span>
              ))}
            </div>

            {result.script.map((line, i) => (
              <div key={i}
                style={{ display: "grid", gridTemplateColumns: "72px 62px 1fr", borderBottom: "1px solid rgba(30,30,46,0.5)", transition: "background 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.015)")}
                onMouseLeave={e => (e.currentTarget.style.background = "")}>
                <div style={{ padding: "13px 14px", borderRight: "1px solid var(--border-subtle)", fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
                  {line.time}
                </div>
                <div style={{ padding: "13px 10px", borderRight: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: TYPE_COLOR[line.type] ?? "#aaa", background: (TYPE_COLOR[line.type] ?? "#aaa") + "18", padding: "2px 6px", borderRadius: 4, letterSpacing: "0.04em" }}>
                    {TYPE_LABEL[line.type] ?? line.type}
                  </span>
                </div>
                <div style={{ padding: "13px 16px", display: "flex", alignItems: "center" }}>
                  <textarea
                    defaultValue={line.ko}
                    rows={1}
                    style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "var(--text-primary)", fontSize: 13.5, lineHeight: 1.5, resize: "none", fontFamily: "Inter, sans-serif" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 초기 안내 */}
      {!loading && !result && !error && (
        <div style={{ textAlign: "center", padding: "50px 20px", color: "var(--text-muted)" }}>
          <Sparkles size={36} style={{ opacity: 0.2, margin: "0 auto 12px" }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>YouTube URL을 입력하세요</div>
          <div style={{ fontSize: 13 }}>
            OpenAI API 키가 설정 페이지에 등록되어 있어야 합니다.<br />
            자막이 있는 영상일수록 더 정확한 대본이 생성됩니다.
          </div>
        </div>
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
