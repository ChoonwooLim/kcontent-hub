"use client";
import { useState } from "react";
import { Key, Youtube, Cpu, Globe, Check, Eye, EyeOff } from "lucide-react";

type ApiKey = { label: string; key: keyof typeof INIT_KEYS; placeholder: string; icon: React.ReactNode; color: string; required: boolean; note: string };

const INIT_KEYS = { youtube: "", openai: "", deepl: "", tiktok: "" };

const API_CONFIG: ApiKey[] = [
  { label: "YouTube Data API v3", key: "youtube", placeholder: "AIza...", icon: <Youtube size={15} />, color: "#ff0000", required: true, note: "Google Cloud Console → API & Services → YouTube Data API v3" },
  { label: "OpenAI API", key: "openai", placeholder: "sk-...", icon: <Cpu size={15} />, color: "#6366f1", required: true, note: "platform.openai.com → API Keys. GPT-4o Vision + Whisper 사용" },
  { label: "DeepL API (대안 번역)", key: "deepl", placeholder: "xxxx-xxxx-xxxx-xxxx:fx", icon: <Globe size={15} />, color: "#10b981", required: false, note: "deepl.com/pro-api → 월 500,000자 무료" },
  { label: "TikTok Content Posting API", key: "tiktok", placeholder: "tt-...", icon: <span style={{ fontWeight: 800, fontSize: 11 }}>TT</span>, color: "#69c9d0", required: false, note: "developers.tiktok.com → Content Posting API" },
];

export default function SettingsPage() {
  const [keys, setKeys] = useState(INIT_KEYS);
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 680 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>API 설정</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>실제 자동화를 위한 API 키 등록. 키는 로컬에만 저장됩니다.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {API_CONFIG.map(({ label, key, placeholder, icon, color, required, note }) => (
          <div key={key} className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 7, background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", color, border: `1px solid ${color}25` }}>{icon}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{label}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                  {required ? <span className="badge badge-red" style={{ fontSize: 9 }}>필수</span> : <span className="badge badge-gray" style={{ fontSize: 9 }}>선택</span>}
                </div>
              </div>
            </div>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <input
                type={show[key] ? "text" : "password"}
                className="input"
                value={keys[key as keyof typeof INIT_KEYS]}
                onChange={e => setKeys({ ...keys, [key]: e.target.value })}
                placeholder={placeholder}
                style={{ paddingRight: 40, fontFamily: "JetBrains Mono, monospace", fontSize: 13 }}
              />
              <button onClick={() => setShow(s => ({ ...s, [key]: !s[key] }))}
                style={{ position: "absolute", right: 12, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                {show[key] ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 7, lineHeight: 1.5 }}>{note}</div>
          </div>
        ))}
      </div>

      <button className="btn btn-brand" onClick={handleSave} style={{ padding: "12px", fontSize: 14, gap: 8 }}>
        {saved ? <><Check size={15} />저장 완료!</> : <><Key size={15} />API 키 저장</>}
      </button>
    </div>
  );
}
