"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Key, Youtube, Cpu, Check, Eye, EyeOff, ExternalLink, Loader, ShieldCheck, ShieldX, Zap, Trash2, Crown, Lock
} from "lucide-react";
import { useMe, refreshMe } from "@/lib/hooks/use-me";

type KeyName = "youtube" | "openai";
type VerifyResult = { valid: boolean; error?: string; modelCount?: number; hasGpt4o?: boolean; hasWhisper?: boolean; message?: string; resultCount?: number; quota?: string };
type VerifyState = "idle" | "loading" | "success" | "fail";
type KeysInfo = {
  keys: Record<KeyName, string>;          // 마스킹된 값
  has: Record<KeyName, boolean>;
  plan: "FREE" | "VIP";
  role: "USER" | "ADMIN";
  privileged: boolean;
  serverKeys: Record<KeyName, boolean>;
};

type ApiCard = {
  label: string; key: KeyName; placeholder: string; icon: React.ReactNode; color: string;
  usage: string; note: string; link: string; linkLabel: string; verifyEndpoint: string;
};

const API_CONFIG: ApiCard[] = [
  {
    label: "OpenAI API", key: "openai", placeholder: "sk-...", icon: <Cpu size={15} />, color: "#6366f1",
    usage: "자막 번역 · Whisper 음성 추출 · AI 대본",
    note: "API Keys 페이지에서 'Create new secret key' 클릭. GPT-4o + Whisper 사용",
    link: "https://platform.openai.com/api-keys", linkLabel: "platform.openai.com →", verifyEndpoint: "/api/verify-openai",
  },
  {
    label: "YouTube Data API v3", key: "youtube", placeholder: "AIza...", icon: <Youtube size={15} />, color: "#ff0000",
    usage: "소재 수집기 검색",
    note: "Google Cloud Console → API & Services → YouTube Data API v3 활성화 후 사용자 인증 정보에서 발급",
    link: "https://console.cloud.google.com/apis/library/youtube.googleapis.com", linkLabel: "Google Cloud Console →", verifyEndpoint: "/api/verify-youtube",
  },
];

const EMPTY: Record<KeyName, string> = { youtube: "", openai: "" };

export default function SettingsPage() {
  const { me } = useMe();
  const [info, setInfo] = useState<KeysInfo | null>(null);
  const [input, setInput] = useState<Record<KeyName, string>>(EMPTY);
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifyStates, setVerifyStates] = useState<Record<string, VerifyState>>({});
  const [verifyResults, setVerifyResults] = useState<Record<string, VerifyResult>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/keys", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || `오류 (${res.status})`); return; }
      setInfo(data);
      setError(null);
    } catch (e) { setError(String(e)); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const privileged = info?.privileged ?? me?.privileged ?? false;
  const tierLabel = (info?.role ?? me?.user.role) === "ADMIN" ? "관리자" : (info?.plan ?? me?.user.plan) === "VIP" ? "VIP" : "일반 회원";

  const handleSave = async () => {
    const body: Record<string, string> = {};
    (Object.keys(input) as KeyName[]).forEach(k => { if (input[k].trim()) body[k] = input[k].trim(); });
    if (Object.keys(body).length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || `저장 실패 (${res.status})`); return; }
      setInput(EMPTY);
      setSaved(`✓ 저장 완료 (${(data.saved as string[]).join(", ")})`);
      setTimeout(() => setSaved(null), 2500);
      await load();
      refreshMe();   // 레이아웃 잠금 해제 등 권한 상태 갱신
    } catch (e) { setError(String(e)); }
    finally { setSaving(false); }
  };

  const handleClear = async (k: KeyName) => {
    if (!confirm(`등록된 ${k === "openai" ? "OpenAI" : "YouTube"} 키를 삭제할까요?`)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [k]: null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || `삭제 실패 (${res.status})`); return; }
      await load();
      refreshMe();
    } finally { setSaving(false); }
  };

  const verifyKey = async (apiKey: string, endpoint: string, keyName: string) => {
    setVerifyStates(s => ({ ...s, [keyName]: "loading" }));
    setVerifyResults(r => { const n = { ...r }; delete n[keyName]; return n; });
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data: VerifyResult = await res.json();
      setVerifyResults(r => ({ ...r, [keyName]: data }));
      setVerifyStates(s => ({ ...s, [keyName]: data.valid ? "success" : "fail" }));
    } catch {
      setVerifyResults(r => ({ ...r, [keyName]: { valid: false, error: "서버 오류: 검증 요청에 실패했습니다." } }));
      setVerifyStates(s => ({ ...s, [keyName]: "fail" }));
    }
  };

  const hasPending = (Object.keys(input) as KeyName[]).some(k => input[k].trim());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 680 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>내 API 키</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>키는 내 계정에만 귀속되며 암호화되어 저장됩니다. 다른 회원과 공유되지 않습니다.</p>
        </div>
        {info && (
          <span className={`badge ${privileged ? "badge-amber" : "badge-gray"}`} style={{ fontSize: 11, marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
            {privileged && <Crown size={11} />}{tierLabel}
          </span>
        )}
      </div>

      {/* 등급 안내 */}
      {info && (
        <div style={{
          padding: "12px 14px", borderRadius: 8, fontSize: 12, lineHeight: 1.6,
          background: privileged ? "rgba(251,191,36,0.06)" : "rgba(99,102,241,0.06)",
          border: `1px solid ${privileged ? "rgba(251,191,36,0.25)" : "rgba(99,102,241,0.25)"}`,
          color: "var(--text-secondary)",
        }}>
          {privileged ? (
            <>
              <strong style={{ color: "#fbbf24" }}>{tierLabel}</strong>는 자막 번역에 <strong>OpenClaw</strong>(twinverse-ai)를, Whisper·YouTube 에는 서버 공용 키를 사용합니다.
              아래 키 등록은 선택이며, 서버 공용 키가 없을 때만 내 키가 사용됩니다.
              {info.serverKeys.openai === false && <span style={{ color: "#f87171" }}> (현재 서버 OpenAI 키 없음 — Whisper 추출에는 내 키가 필요합니다)</span>}
            </>
          ) : (
            <>
              <strong style={{ color: "#a5b4fc" }}>일반 회원</strong>은 본인의 키로 서비스를 이용합니다.
              <strong> OpenAI 키</strong>를 등록해야 자막 스튜디오·대본 엔진 등 AI 기능 화면이 열리고, <strong>YouTube 키</strong>는 소재 수집기에 필요합니다.
              사용량은 각 키의 계정으로 과금됩니다. VIP 로 전환하면 OpenClaw 와 서버 공용 키를 사용할 수 있습니다.
            </>
          )}
        </div>
      )}

      {(error || saved) && (
        <div style={{
          fontSize: 12, padding: "8px 12px", borderRadius: 6,
          color: error ? "#f87171" : "#34d399",
          background: error ? "rgba(239,68,68,0.06)" : "rgba(52,211,153,0.06)",
          border: `1px solid ${error ? "rgba(239,68,68,0.2)" : "rgba(52,211,153,0.2)"}`,
        }}>
          {error || saved}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {API_CONFIG.map(({ label, key, placeholder, icon, color, usage, note, link, linkLabel, verifyEndpoint }) => {
          const has = info?.has[key] ?? false;
          const required = !privileged;
          const usingServer = privileged && (info?.serverKeys[key] ?? false);
          return (
            <div key={key} className="card" style={{ padding: 18 }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 7, background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", color, border: `1px solid ${color}25` }}>{icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{label}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    {required
                      ? <span className="badge badge-red" style={{ fontSize: 9 }}>필수</span>
                      : <span className="badge badge-gray" style={{ fontSize: 9 }}>선택</span>}
                    <span>{usage}</span>
                  </div>
                </div>
                {/* 상태 */}
                <div style={{ textAlign: "right", fontSize: 11 }}>
                  {has ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span className="badge badge-green" style={{ fontSize: 10 }}>✓ 등록됨</span>
                      <span style={{ fontFamily: "JetBrains Mono, monospace", color: "var(--text-muted)" }}>{info?.keys[key]}</span>
                      <button className="btn-icon" title="등록된 키 삭제" onClick={() => handleClear(key)} disabled={saving} style={{ opacity: 0.6 }}>
                        <Trash2 size={13} color="#f87171" />
                      </button>
                    </div>
                  ) : usingServer ? (
                    <span className="badge badge-amber" style={{ fontSize: 10 }}>서버 공용 키 사용 중</span>
                  ) : (
                    <span className="badge badge-gray" style={{ fontSize: 10, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {required && <Lock size={10} />}미등록
                    </span>
                  )}
                </div>
              </div>

              {/* Input row */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <input
                    type={show[key] ? "text" : "password"}
                    className="input"
                    value={input[key]}
                    onChange={e => setInput({ ...input, [key]: e.target.value })}
                    placeholder={has ? "새 키를 입력하면 기존 키를 대체합니다" : placeholder}
                    autoComplete="off"
                    style={{ paddingRight: 40, fontFamily: "JetBrains Mono, monospace", fontSize: 13 }}
                  />
                  <button onClick={() => setShow(s => ({ ...s, [key]: !s[key] }))}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                    {show[key] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => verifyKey(input[key], verifyEndpoint, key)}
                  disabled={!input[key].trim() || verifyStates[key] === "loading"}
                  title="입력한 키를 실제 API 로 검증"
                  style={{ flexShrink: 0, gap: 6, borderColor: verifyStates[key] === "success" ? "rgba(16,185,129,0.4)" : verifyStates[key] === "fail" ? "rgba(239,68,68,0.4)" : undefined }}
                >
                  {verifyStates[key] === "loading" && <><Loader size={12} style={{ animation: "spin 0.9s linear infinite" }} />검증 중...</>}
                  {(!verifyStates[key] || verifyStates[key] === "idle") && <><Zap size={12} />키 검증</>}
                  {verifyStates[key] === "success" && <><ShieldCheck size={12} color="#34d399" />유효함</>}
                  {verifyStates[key] === "fail" && <><ShieldX size={12} color="#f87171" />실패</>}
                </button>
              </div>

              {/* Verify result */}
              {verifyResults[key] && (
                <div style={{
                  marginTop: 10, padding: "12px 14px", borderRadius: 8,
                  background: verifyResults[key].valid ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)",
                  border: `1px solid ${verifyResults[key].valid ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
                }}>
                  {verifyResults[key].valid ? (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                        <ShieldCheck size={15} color="#34d399" />
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#34d399" }}>API 키 유효 — 정상 연결됨</span>
                      </div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {verifyResults[key].hasGpt4o !== undefined && (
                          <span className={`badge ${verifyResults[key].hasGpt4o ? "badge-brand" : "badge-gray"}`} style={{ fontSize: 11 }}>
                            {verifyResults[key].hasGpt4o ? "✓ GPT-4o 접근 가능" : "✗ GPT-4o 없음"}
                          </span>
                        )}
                        {verifyResults[key].hasWhisper !== undefined && (
                          <span className={`badge ${verifyResults[key].hasWhisper ? "badge-green" : "badge-gray"}`} style={{ fontSize: 11 }}>
                            {verifyResults[key].hasWhisper ? "✓ Whisper 접근 가능" : "✗ Whisper 없음"}
                          </span>
                        )}
                        {verifyResults[key].modelCount !== undefined && (
                          <span className="badge badge-gray" style={{ fontSize: 11 }}>모델 {verifyResults[key].modelCount}개</span>
                        )}
                        {verifyResults[key].quota && (
                          <span className="badge badge-green" style={{ fontSize: 11 }}>✓ {verifyResults[key].quota}</span>
                        )}
                        {verifyResults[key].resultCount !== undefined && (
                          <span className="badge badge-gray" style={{ fontSize: 11 }}>검색 API 정상</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                      <ShieldX size={15} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#f87171", marginBottom: 3 }}>검증 실패</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{verifyResults[key].error}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.6 }}>{note}</div>
              <a href={link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                <button className="btn btn-ghost btn-sm" style={{ marginTop: 10, gap: 6, fontSize: 12 }}>
                  <ExternalLink size={12} />{linkLabel}
                </button>
              </a>
            </div>
          );
        })}
      </div>

      <button className="btn btn-brand" onClick={handleSave} disabled={saving || !hasPending} style={{ padding: "12px", fontSize: 14, gap: 8 }}>
        {saving ? <><Loader size={15} style={{ animation: "spin 0.9s linear infinite" }} />저장 중...</>
          : saved ? <><Check size={15} />저장 완료!</>
          : <><Key size={15} />입력한 키 저장</>}
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
