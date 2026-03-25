"use client";
import { useState } from "react";
import {
  Wrench, Bug, Sparkles, Calendar, GitCommit,
  ChevronDown, ChevronRight, CheckCircle2
} from "lucide-react";

/* ── 데이터 ─────────────────────────────────────────────── */

type LogEntry = {
  date: string;
  tag: "feat" | "fix" | "upgrade" | "refactor";
  title: string;
  details?: string[];
};

const CHANGELOG: LogEntry[] = [
  // ── 2026-03-25 ──
  {
    date: "2026-03-25",
    tag: "feat",
    title: "자막 스튜디오 세션 저장/불러오기",
    details: [
      "Prisma StudioSession 모델 추가 (DB 영구 저장)",
      "같은 영상에 대한 upsert 지원 — 기존 세션 자동 업데이트",
      "저장된 작업 목록 카드 UI — 썸네일, 자막 수, 번역 상태, 날짜 표시",
      "세션 클릭 시 영상·자막·스타일 프리셋 모두 복원",
      "세션 삭제 기능 (confirm 확인)",
    ],
  },
  {
    date: "2026-03-25",
    tag: "feat",
    title: "스마트 자막 추출 (CC → Whisper 자동 폴백)",
    details: [
      "YouTube CC 자막 우선 추출 → 실패 시 yt-dlp 오디오 다운로드 → Whisper API 음성 분석",
      "파일 모드: ffmpeg 오디오 추출 (HD 400MB → 4MB) 후 Whisper 전송",
      "추출 방법(CC/Whisper) 프론트에 표시: 📝 CC, 🎤 Whisper",
      "ffmpeg 설정: -vn -acodec aac -ar 16000 -ac 1 -b:a 64k (Whisper 최적)",
    ],
  },
  {
    date: "2026-03-25",
    tag: "fix",
    title: "자막 추출 SyntaxError 수정",
    details: [
      "배포 서버(Orbitron)에서 504 Gateway Timeout 시 HTML 응답을 JSON으로 파싱하려다 발생",
      "content-type 헤더 체크 후 JSON 아닌 응답 감지",
      "res.json() 자체도 try-catch로 감싸서 파싱 실패 시 명확한 에러 메시지 표시",
      "추출/번역 두 곳 모두 동일하게 적용",
    ],
  },
  {
    date: "2026-03-25",
    tag: "fix",
    title: "Docker 빌드 에러 수정 (ESM + Prisma)",
    details: [
      "youtube-transcript 정적 import → dynamic import 변경 (ESM 모듈 호환성)",
      "Dockerfile에 빌드용 DATABASE_URL 더미 환경변수 추가",
      "next.config serverExternalPackages에서 youtube-transcript 제거",
      "script/generate/route.ts의 정적 import도 dynamic import로 변경",
    ],
  },
  {
    date: "2026-03-25",
    tag: "upgrade",
    title: "Whisper API 안정성 강화",
    details: [
      "25MB 파일 크기 사전 체크 (Whisper API 제한)",
      "4분 AbortSignal 타임아웃 — 무한 대기 방지",
      "에러 응답 처리 개선: res.json() → res.text() 사용하여 HTML 에러도 안전 처리",
      "next.config: serverActions.bodySizeLimit 50MB 추가",
    ],
  },

  // ── 2026-03-24 ──
  {
    date: "2026-03-24",
    tag: "feat",
    title: "자막 스튜디오 — YouTube CC 자막 추출 + GPT-4o 번역",
    details: [
      "YouTube CC 자막 추출 API (/api/studio/subtitle)",
      "GPT-4o 한국어 번역 워크플로우 (30개 청크 배치 처리)",
      "자막 스타일 프리셋 4종 (기본 흰색, 노란 강조, K-뉴스, 모노 코드)",
      "SRT/VTT 내보내기 기능",
      "실시간 자막 싱크 미리보기 — YouTube 영상 재생과 동기화",
    ],
  },
  {
    date: "2026-03-24",
    tag: "feat",
    title: "다운로드 영상 관리 + 자막 스튜디오 전송",
    details: [
      "다운로드된 파일을 saved 폴더로 영구 저장",
      "영상 편집기에서 '자막 스튜디오로 전송' 버튼 추가",
      "파일 모드 Whisper 음성 분석 지원 (서버 파일 직접 처리)",
    ],
  },
  {
    date: "2026-03-24",
    tag: "fix",
    title: "Orbitron SSH 키 인증 설정",
    details: [
      "SSH 공개키를 서버 authorized_keys에 등록 — 비밀번호 없이 접속",
      ".agent/workflows/ssh-server.md 워크플로우 문서 작성",
      "Docker 컨테이너 관리 명령어 문서화",
    ],
  },

  // ── 2026-03-23 ──
  {
    date: "2026-03-23",
    tag: "feat",
    title: "AI 대본 생성 — GPT-4o + YouTube Transcript 연동",
    details: [
      "youtube-transcript 패키지로 실제 자막 추출 (영어 → 한국어 폴백)",
      "YouTube Data API v3 영상 메타데이터 조회 (제목, 채널, 설명, 길이)",
      "GPT-4o 기반 한국어 자막 대본 생성 (hook/reaction/narration/commentary)",
      "영상 길이 기반 최소 장면 수 자동 계산 (40초당 1장면, 최소 12개)",
      "썸네일 상단/하단 카피 자동 생성",
    ],
  },
  {
    date: "2026-03-23",
    tag: "feat",
    title: "스크립트 DB 저장 + 배포 환경 연동",
    details: [
      "Prisma Script 모델로 생성된 대본을 PostgreSQL에 영구 저장",
      "배포 환경(Orbitron) DATABASE_URL 설정 및 prisma db push 연동",
      "저장된 스크립트 목록 조회/삭제 API",
    ],
  },

  // ── 이전 ──
  {
    date: "2026-03-22",
    tag: "feat",
    title: "파이프라인 보드 — YouTube 다운로드 + yt-dlp 연동",
    details: [
      "yt-dlp 바이너리 자동 탐색 (findBinary 유틸)",
      "YouTube 영상 다운로드 → 서버 media/downloads/ 저장",
      "ffmpeg 연동: 자막 하드코딩, 썸네일 생성",
      "Docker 이미지에 yt-dlp + ffmpeg 번들링",
    ],
  },
  {
    date: "2026-03-22",
    tag: "upgrade",
    title: "인증 시스템 — NextAuth + 멀티테넌트",
    details: [
      "NextAuth v5 Credentials 로그인 구현",
      "bcrypt 비밀번호 해싱",
      "Workspace 기반 멀티테넌트 구조 (가입 시 자동 워크스페이스 생성)",
      "API 키 관리 (OpenAI, YouTube) — DB 저장 + .env 폴백",
    ],
  },
  {
    date: "2026-03-21",
    tag: "feat",
    title: "KContent Studio v2.0 초기 구축",
    details: [
      "Next.js 16 + Turbopack + PostgreSQL + Prisma 기반",
      "대시보드 레이아웃: 사이드바, 탑바, 메인 콘텐츠",
      "파이프라인 보드 (Hunter → Script → Editor → Publisher)",
      "프리미엄 다크 UI 테마 (glassmorphism, gradient, micro-animation)",
    ],
  },
];

/* ── 태그 색상/아이콘 ──────────────────────────────────── */
const TAG_STYLE = {
  feat:     { label: "기능추가", color: "#818cf8", bg: "rgba(129,140,248,0.08)", icon: Sparkles },
  fix:      { label: "버그수정", color: "#f87171", bg: "rgba(248,113,113,0.08)", icon: Bug },
  upgrade:  { label: "개선",     color: "#34d399", bg: "rgba(52,211,153,0.08)",  icon: Wrench },
  refactor: { label: "리팩터",  color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  icon: Wrench },
};

/* ── 컴포넌트 ─────────────────────────────────────────── */
export default function ChangelogPage() {
  const [filter, setFilter] = useState<"all" | "feat" | "fix" | "upgrade">("all");
  const [expandedIdx, setExpandedIdx] = useState<Set<number>>(new Set());

  const filtered = filter === "all" ? CHANGELOG : CHANGELOG.filter(e => e.tag === filter);

  // 날짜별 그룹핑
  const grouped = filtered.reduce<Record<string, LogEntry[]>>((acc, entry) => {
    (acc[entry.date] ??= []).push(entry);
    return acc;
  }, {});

  const toggle = (i: number) => {
    setExpandedIdx(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  // 통계
  const stats = {
    total: CHANGELOG.length,
    feat: CHANGELOG.filter(e => e.tag === "feat").length,
    fix: CHANGELOG.filter(e => e.tag === "fix").length,
    upgrade: CHANGELOG.filter(e => e.tag === "upgrade").length,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 900 }}>
      {/* 헤더 */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>변경이력</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          작업일지 · 버그수정 히스토리 · 업그레이드 이력
        </p>
      </div>

      {/* 통계 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "전체", val: stats.total, color: "#818cf8", filter: "all" as const },
          { label: "기능추가", val: stats.feat, color: "#818cf8", filter: "feat" as const },
          { label: "버그수정", val: stats.fix, color: "#f87171", filter: "fix" as const },
          { label: "개선", val: stats.upgrade, color: "#34d399", filter: "upgrade" as const },
        ].map(s => (
          <button
            key={s.label}
            className="card"
            onClick={() => setFilter(s.filter)}
            style={{
              padding: "14px 16px", cursor: "pointer", textAlign: "left",
              border: filter === s.filter ? `1px solid ${s.color}` : "1px solid var(--border-default)",
              background: filter === s.filter ? `${s.color}10` : undefined,
              transition: "all 0.15s",
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{s.label}</div>
          </button>
        ))}
      </div>

      {/* 타임라인 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {Object.entries(grouped).map(([date, entries]) => (
          <div key={date} style={{ position: "relative" }}>
            {/* 날짜 헤더 */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "12px 0 8px",
              fontSize: 13, fontWeight: 700, color: "var(--text-secondary)",
            }}>
              <Calendar size={14} color="#818cf8" />
              {new Date(date).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>
                ({entries.length}건)
              </span>
            </div>

            {/* 항목들 */}
            <div style={{
              borderLeft: "2px solid var(--border-subtle)",
              marginLeft: 7,
              paddingLeft: 20,
              display: "flex", flexDirection: "column", gap: 8,
              paddingBottom: 8,
            }}>
              {entries.map((entry, i) => {
                const globalIdx = CHANGELOG.indexOf(entry);
                const ts = TAG_STYLE[entry.tag];
                const TagIcon = ts.icon;
                const open = expandedIdx.has(globalIdx);

                return (
                  <div
                    key={i}
                    className="card"
                    style={{
                      padding: "12px 16px", cursor: "pointer",
                      transition: "all 0.15s",
                      position: "relative",
                    }}
                    onClick={() => toggle(globalIdx)}
                  >
                    {/* 타임라인 도트 */}
                    <div style={{
                      position: "absolute", left: -28, top: 16,
                      width: 10, height: 10, borderRadius: "50%",
                      background: ts.color,
                      border: "2px solid var(--bg-base)",
                    }} />

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {/* 태그 뱃지 */}
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 8px",
                        borderRadius: 4,
                        color: ts.color,
                        background: ts.bg,
                        display: "flex", alignItems: "center", gap: 4,
                        flexShrink: 0,
                      }}>
                        <TagIcon size={10} />
                        {ts.label}
                      </span>

                      {/* 제목 */}
                      <span style={{ fontSize: 13, fontWeight: 600, flex: 1, color: "var(--text-primary)" }}>
                        {entry.title}
                      </span>

                      {/* 펼침 화살표 */}
                      {entry.details && (
                        open
                          ? <ChevronDown size={14} color="var(--text-muted)" />
                          : <ChevronRight size={14} color="var(--text-muted)" />
                      )}
                    </div>

                    {/* 상세 내역 */}
                    {open && entry.details && (
                      <div style={{
                        marginTop: 10, paddingTop: 10,
                        borderTop: "1px solid var(--border-subtle)",
                        display: "flex", flexDirection: "column", gap: 5,
                      }}>
                        {entry.details.map((d, j) => (
                          <div key={j} style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 12, color: "var(--text-secondary)" }}>
                            <CheckCircle2 size={12} color={ts.color} style={{ marginTop: 2, flexShrink: 0 }} />
                            {d}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 커밋 히스토리 안내 */}
      <div style={{
        padding: "12px 16px", borderRadius: 8,
        background: "rgba(99,102,241,0.04)",
        border: "1px solid rgba(99,102,241,0.15)",
        display: "flex", alignItems: "center", gap: 8,
        fontSize: 12, color: "var(--text-muted)",
      }}>
        <GitCommit size={14} color="#818cf8" />
        이 페이지는 KContent Studio의 주요 변경사항을 기록합니다. 상세 커밋 이력은 GitHub를 참조하세요.
      </div>
    </div>
  );
}
