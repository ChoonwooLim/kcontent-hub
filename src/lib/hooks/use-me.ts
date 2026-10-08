"use client";
import { useCallback, useEffect, useState } from "react";

/** /api/me 응답 — 대시보드 게이팅·배지·엔진 라벨에 사용 */
export type Me = {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: "USER" | "ADMIN";
    plan: "FREE" | "VIP";
    disabled: boolean;
  };
  privileged: boolean;
  hasOpenaiKey: boolean;
  hasYoutubeKey: boolean;
  needsOpenaiKey: boolean;
  needsYoutubeKey: boolean;
  engine: string | null;
  engineNote: string | null;
  serverKeys: { openai: boolean; youtube: boolean };
};

export const ME_REFRESH_EVENT = "kcontent:me-refresh";

/** 키 저장 등으로 권한 상태가 바뀌었을 때 레이아웃 등 다른 컴포넌트의 /api/me 를 다시 읽게 한다 */
export function refreshMe() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ME_REFRESH_EVENT));
}

export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || `오류 (${res.status})`); setMe(null); return; }
      setMe(data as Me);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    const handler = () => { reload(); };
    window.addEventListener(ME_REFRESH_EVENT, handler);
    return () => window.removeEventListener(ME_REFRESH_EVENT, handler);
  }, [reload]);

  return { me, loading, error, reload };
}
