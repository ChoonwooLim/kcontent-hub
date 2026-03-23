"use client";
import { useState, useEffect } from "react";
import { Key, Youtube, Cpu, Globe, Check, Eye, EyeOff, ExternalLink, Loader, ShieldCheck, ShieldX, Zap } from "lucide-react";

type VerifyResult = { valid: boolean; error?: string; modelCount?: number; hasGpt4o?: boolean; hasWhisper?: boolean; message?: string; resultCount?: number; quota?: string };
type VerifyState = "idle" | "loading" | "success" | "fail";
type ApiKey = { label: string; key: keyof typeof INIT_KEYS; placeholder: string; icon: React.ReactNode; color: string; required: boolean; note: string; link: string; linkLabel: string; canVerify?: boolean; verifyEndpoint?: string };

const INIT_KEYS = { youtube: "", openai: "", deepl: "", tiktok: "" };

const API_CONFIG: ApiKey[] = [
  { label: "YouTube Data API v3", key: "youtube", placeholder: "AIza...", icon: <Youtube size={15} />, color: "#ff0000", required: true, note: "Google Cloud Console → API & Services → YouTube Data API v3 활성화 후 사용자 인증 정보에서 발급", link: "https://console.cloud.google.com/apis/library/youtube.googleapis.com", linkLabel: "Google Cloud Console →", canVerify: true, verifyEndpoint: "/api/verify-youtube" },
  { label: "OpenAI API", key: "openai", placeholder: "sk-...", icon: <Cpu size={15} />, color: "#6366f1", required: true, note: "API Keys 페이지에서 'Create new secret key' 클릭. GPT-4o Vision + Whisper 사용", link: "https://platform.openai.com/api-keys", linkLabel: "platform.openai.com →", canVerify: true, verifyEndpoint: "/api/verify-openai" },
  { label: "DeepL API (대안 번역)", key: "deepl", placeholder: "xxxx-xxxx-xxxx-xxxx:fx", icon: <Globe size={15} />, color: "#10b981", required: false, note: "DeepL API Free 요금제로 월 500,000자 무료. 회원가입 후 계정 페이지에서 발급", link: "https://www.deepl.com/ko/pro-api", linkLabel: "deepl.com/pro-api →" },
  { label: "TikTok Content Posting API", key: "tiktok", placeholder: "tt-...", icon: <span style={{ fontWeight: 800, fontSize: 11 }}>TT</span>, color: "#69c9d0", required: false, note: "개발자 포털에서 앱 생성 후 Content Posting API 권한 신청. 비즈니스 계정 필요", link: "https://developers.tiktok.com/products/content-posting-api/", linkLabel: "TikTok Developers →" },
];

const STORAGE_KEY = "kcontent_api_keys";

export default function SettingsPage() {
  const [keys, setKeysState] = useState<typeof INIT_KEYS>(INIT_KEYS);
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);
  const [verifyStates, setVerifyStates] = useState<Record<string, VerifyState>>({});
  const [verifyResults, setVerifyResults] = useState<Record<string, VerifyResult>>({});

  const setKeys = (next: typeof INIT_KEYS) => setKeysState(next);

  // DB에서 키 로드
  useEffect(() => {
    fetch("/api/keys")
      .then(r => r.json())
      .then(data => {
        if (data.keys) { setKeysState({ ...INIT_KEYS, ...data.keys }); setDbConnected(true); }
        else {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) setKeysState({ ...INIT_KEYS, ...JSON.parse(stored) });
        }
      })
      .catch(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) setKeysState({ ...INIT_KEYS, ...JSON.parse(stored) });
      })
      .finally(() => {});
  }, []);

  const handleSave = async () => {
    // DB에 저장
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(keys),
    });
    if (res.ok) {
      setDbConnected(true);
    } else {
      // fallback: localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 680 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>API 설정</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>실제 자동화를 위한 API 키 등록. 키는 DB에 저장됩니다.</p>
        </div>
        {dbConnected && <span className="badge badge-green" style={{ fontSize: 11, marginTop: 4 }}>● DB 연결됨</span>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {API_CONFIG.map(({ label, key, placeholder, icon, color, required, note, link, linkLabel, canVerify, verifyEndpoint }) => (
          <div key={key} className="card" style={{ padding: 18 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 7, background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", color, border: `1px solid ${color}25` }}>{icon}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{label}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                  {required ? <span className="badge badge-red" style={{ fontSize: 9 }}>필수</span> : <span className="badge badge-gray" style={{ fontSize: 9 }}>선택</span>}
                </div>
              </div>
            </div>

            {/* Input row */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <input
                  type={show[key] ? "text" : "password"}
                  className="input"
                  value={keys[key as keyof typeof INIT_KEYS]}
                  onChange={e => setKeys({ ...keys, [key]: e.target.value })}
                  placeholder={placeholder}
                  style={{ paddingRight: 40, fontFamily: "JetBrains Mono, monospace", fontSize: 13 }}
                />
                <button onClick={() => setShow(s => ({ ...s, [key]: !s[key] }))}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                  {show[key] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {/* Verify button */}
              {canVerify && verifyEndpoint && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => verifyKey(keys[key as keyof typeof INIT_KEYS], verifyEndpoint, key)}
                  disabled={!keys[key as keyof typeof INIT_KEYS] || verifyStates[key] === "loading"}
                  style={{ flexShrink: 0, gap: 6, borderColor: verifyStates[key] === "success" ? "rgba(16,185,129,0.4)" : verifyStates[key] === "fail" ? "rgba(239,68,68,0.4)" : undefined }}
                >
                  {verifyStates[key] === "loading" && <><Loader size={12} style={{ animation: "spin 0.9s linear infinite" }} />검증 중...</>}
                  {(!verifyStates[key] || verifyStates[key] === "idle") && <><Zap size={12} />키 검증</>}
                  {verifyStates[key] === "success" && <><ShieldCheck size={12} color="#34d399" />유효함</>}
                  {verifyStates[key] === "fail" && <><ShieldX size={12} color="#f87171" />실패</>}
                </button>
              )}
            </div>

            {/* Verify result panel */}
            {canVerify && verifyResults[key] && (
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
                      {/* OpenAI 전용 배지 */}
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
                      {/* YouTube 전용 배지 */}
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

            {/* Note & Link */}
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.6 }}>{note}</div>
            <a href={link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 10, gap: 6, fontSize: 12 }}>
                <ExternalLink size={12} />{linkLabel}
              </button>
            </a>
          </div>
        ))}
      </div>

      <button className="btn btn-brand" onClick={handleSave} style={{ padding: "12px", fontSize: 14, gap: 8 }}>
        {saved ? <><Check size={15} />저장 완료!</> : <><Key size={15} />API 키 저장</>}
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
