"use client";
import {
  Map, Zap, Shield, Cpu, Target, CheckCircle2, Circle, PauseCircle, Server,
  Search, Scissors, Film, Palette, Archive, Users, Share2, Globe, AlertTriangle, Rocket
} from "lucide-react";

/* ── 데이터 ─────────────────────────────────────────────── */

const AS_OF = "2026-10-09";

type Stage = { icon: typeof Film; title: string; status: "운영" | "부분" | "UI만"; desc: string };

const STAGES: Stage[] = [
  { icon: Search, title: "소재 수집기", status: "운영", desc: "21개 분야(4그룹)·10개 언어별 키워드 또는 직접 입력으로 yt-dlp 웹 검색(Data API 쿼터 0) → videos/channels.list(1 unit)로 통계 조회. 구독자·조회수 최소/최대 범위, 기간 7일~무제한, 한국어 영상·쇼츠 자동 제외, S/A/B 등급. 결과에서 영상요약편집·AI 대본·자막 스튜디오로 바로 이동" },
  { icon: Scissors, title: "영상 변환엔진", status: "운영", desc: "yt-dlp HD 다운로드(최신판 자동 갱신) → ffmpeg 클립 트림/병합(서버 비동기 작업·진행률) → 영구 볼륨 저장·DB 등록 → 자막 스튜디오 전송" },
  { icon: Film, title: "자막 스튜디오", status: "운영", desc: "한·영·일·중(간체/번체) 언어 트랙, CC → Whisper 추출, OpenClaw(VIP)/GPT-4o 번역(방송 윤문·원문 충실), 이중 자막, 겹침·조각 정리, 전체화면, 세션 저장, SRT/VTT, 공유 링크, 자막 번인 MP4 렌더링" },
  { icon: Cpu, title: "AI 대본 엔진", status: "운영", desc: "GPT-4o 한국어 대본(코릿치 3파트 구조), 썸네일 카피, 스토리보드 프레임 캡처, 세션 저장" },
  { icon: Palette, title: "썸네일 스튜디오", status: "운영", desc: "Canvas 2D FHD 편집기, 스마트 템플릿 20종·시스템 프리셋 12종·내 템플릿, 유튜브 폰트, 오토세이브, 에셋 보관소 연동" },
  { icon: Archive, title: "에셋 보관소", status: "운영", desc: "캡처 이미지·다운로드 영상·제작 썸네일 통합 관리, 영상/대본별 그룹핑" },
  { icon: Users, title: "회원 · 등급 · 관리자", status: "운영", desc: "일반(본인 API 키 필수) / VIP(OpenClaw + 서버 키) / 관리자. 개인 키 AES-256-GCM 암호화, 회원 관리 대시보드(등급·역할·비활성화·삭제)" },
  { icon: Share2, title: "공유 · 전달", status: "운영", desc: "/share/<token> 뷰어(회원 전용 또는 공개), 자막 입힌 MP4 다운로드(Range 스트리밍)" },
  { icon: Globe, title: "멀티플랫폼 배포 · 수익 분석", status: "UI만", desc: "YouTube/Shorts/TikTok/Reels 자동 업로드와 수익 집계는 화면·데이터 모델만 있고 실제 연동은 미구현" },
];

type Done = { title: string; note: string };
const DONE: Done[] = [
  { title: "인증·회원 모델 도입", note: "NextAuth v5 + Prisma, 역할/등급, 부트스트랩 관리자, 비활성 계정 차단 — 2026-03 계획의 '시급' 항목 완료" },
  { title: "브라우저 FFmpeg(WASM) 크래시 대안", note: "서버 측 ffmpeg 파이프라인(클립 트림/병합, 자막 번인 렌더링 큐)으로 대체 경로 확보" },
  { title: "외부 API 부하 제어 (부분)", note: "번역 청크 동시성 제한(OpenAI 3 / OpenClaw 2), 렌더링 전역 큐 1개, YouTube 검색 쿼터 0 전환(yt-dlp)" },
  { title: "멀티테넌트 1단계", note: "역할·등급 기반 권한, 회원별 API 키 격리. 워크스페이스 단위 분리는 아직 단일 워크스페이스" },
  { title: "OpenClaw 연동", note: "twinverse-ai 게이트웨이 OpenAI 호환 API, 비동기 잡으로 프록시 60초 한도 회피, 실패 시 OpenAI 대체 가시화" },
  { title: "운영 인프라 정비", note: "Orbitron env_vars 누락 복구, yt-dlp 최신판 자동 갱신, CJK 폰트 자동 설치, 인프라 레지스트리 등록" },
];

type Task = { priority: "P1" | "P2" | "P3"; title: string; desc: string; status?: "진행 전" | "보류" };
const SHORT_TERM: Task[] = [
  { priority: "P1", title: "Dockerfile 의 하드코딩 비밀값 제거 + AUTH_SECRET 교체", desc: "AUTH_SECRET 이 저장소 Dockerfile 에 평문으로 남아 있음. Orbitron 이 ENV 를 제거해 운영에는 영향 없으나 저장소 노출 위험. 교체 시 회원 개인 API 키(시크릿 파생 암호화)가 복호화되지 않으므로 재등록 안내 또는 키 재암호화 마이그레이션이 필요" },
  { priority: "P1", title: "OpenAI/Whisper 429·일시 오류 재시도 큐", desc: "p-queue 기반 전역 동시성·지수 백오프. 지금은 청크 단위 2회 재시도만 있음" },
  { priority: "P1", title: "영상 변환엔진 브라우저 경로를 서버 렌더 파이프라인으로 통합", desc: "WASM FFmpeg 의존 구간을 제거하고 자막 번인 렌더링과 같은 서버 큐·진행률 체계로 통일" },
  { priority: "P2", title: "공유 링크 만료·비밀번호·렌더링 결과 보관 정책", desc: "만료일/비밀번호 옵션, media/renders 디스크 정리(오래된 원본 캐시·MP4 자동 삭제), 공유별 사용량 통계(관리자)" },
  { priority: "P2", title: "소재 수집기 결과 캐시·중복 표시", desc: "최근 수집 결과 서버 캐시(12시간), 이미 파이프라인에 저장된 영상 표시, 채널 단위 중복 제거" },
  { priority: "P2", title: "테스트 정착", desc: "세션 중 작성한 e2e 스크립트(회원·공유·렌더링·수집)를 Vitest + Playwright 로 저장소에 편입, GitHub Actions 에서 배포 전 실행" },
  { priority: "P3", title: "자막 언어 상위 10개국 확장", desc: "1차 스페인어·포르투갈어·프랑스어·독일어·인도네시아어·베트남어·러시아어(폰트 추가 불필요), 2차 태국어·힌디어·아랍어(전용 폰트·RTL). 라틴 문자 언어 감지(Whisper/CC 코드 우선 + 불용어), 공통 영어 프롬프트 템플릿, 다중 언어 일괄 번역", status: "보류" },
];

type Roadmap = { title: string; desc: string };
const ROADMAP: Roadmap[] = [
  { title: "멀티플랫폼 자동 업로드 실제 연동", desc: "YouTube Data API videos.insert(업로드 1건 약 1,600 units — 일일 6건 한도, 쿼터 확장 신청 필요), TikTok Content Posting API, 예약 배포 큐" },
  { title: "결제·플랜 자동화", desc: "Stripe 구독 → VIP 자동 전환/만료, 사용량(번역 줄 수·렌더링 분) 집계와 플랜별 한도" },
  { title: "워크스페이스 단위 멀티테넌트", desc: "기관/팀별 워크스페이스 격리, 초대·역할, 워크스페이스별 공용 API 키·OpenClaw 에이전트" },
  { title: "고급 AI 편집", desc: "대본 기반 B-roll 자동 삽입, TTS 더빙(보이스 클로닝), 모션 그래픽 템플릿, 자막 스타일 애니메이션" },
  { title: "수익 분석 실데이터", desc: "YouTube Analytics API 연동으로 조회수·수익·CTR 자동 집계, 소재 등급 대비 성과 피드백으로 점수 모델 보정" },
  { title: "데이터베이스 인덱스·정리", desc: "PipelineVideo(stage, workspaceId), SubtitleShare(createdById), HunterSearch(createdAt) 인덱스, 오래된 검색 기록·세션 정리 배치" },
];

type Ops = { title: string; desc: string };
const OPS: Ops[] = [
  { title: "배포", desc: "GitHub main 푸시 → Orbitron 웹훅 자동 빌드(약 1.5분). Orbitron 이 Dockerfile 을 자체 양식으로 다시 쓰므로 ENV·apk 패키지 변경은 이미지에 반영되지 않음 → 환경변수는 대시보드 env_vars, 바이너리·폰트는 런타임 자동 설치(media 볼륨)" },
  { title: "환경변수 (Orbitron env_vars)", desc: "DATABASE_URL · AUTH_SECRET · AUTH_TRUST_HOST · OPENAI_API_KEY · YOUTUBE_API_KEY · TRANSLATE_PROVIDER=openclaw · OPENCLAW_GATEWAY_URL · OPENCLAW_TOKEN · OPENCLAW_AGENT_ID · TRANSLATE_FALLBACK · (선택) ADMIN_EMAILS" },
  { title: "YouTube 쿼터", desc: "Data API 일일 10,000 units(태평양 자정 = 한국 16~17시 초기화). 검색은 yt-dlp 로 처리해 수집 1회 약 2 units. 유료 확장 불가, 공식 확장 신청 폼만 존재" },
  { title: "영구 볼륨 /app/media", desc: "downloads(원본·클립), renders(렌더링 결과·원본 캐시), fonts(Noto Sans CJK), bin(yt-dlp 최신판). 컨테이너 이름은 재배포마다 바뀌므로 docker ps --filter name=kcontentshub 로 조회" },
  { title: "DB 스키마", desc: "스키마 변경은 npm run db:push(.env.local 로드) 또는 배포 CMD 의 prisma db push 로 반영. 컬럼 추가는 안전, 삭제·타입 변경은 데이터 확인 후" },
];

/* ── 스타일 헬퍼 ──────────────────────────────────────── */
const sectionTitle = (icon: React.ReactNode, text: string) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
    {icon}
    <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{text}</h2>
  </div>
);

const STATUS_BADGE: Record<Stage["status"], string> = { "운영": "badge-green", "부분": "badge-amber", "UI만": "badge-gray" };
const PRIORITY_COLOR: Record<Task["priority"], string> = { P1: "#f87171", P2: "#fbbf24", P3: "#818cf8" };

export default function PlanPage() {
  return (
    <div className="fade-in" style={{ padding: 24, paddingBottom: 64, maxWidth: 1000, margin: "0 auto" }}>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10 }}>
          <Map size={24} className="text-brand" />
          KContent Studio 개발계획
        </h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 8, fontSize: 14 }}>
          {AS_OF} 기준 현행 아키텍처 · 완료 항목 · 단기 과제 · 로드맵 · 운영 메모
        </p>
      </header>

      <div style={{ display: "grid", gap: 24, gridTemplateColumns: "1fr" }}>

        {/* 1. 현행 시스템 */}
        <section className="card" style={{ padding: 24 }}>
          {sectionTitle(<Target size={20} color="#3b82f6" />, "1. 현행 시스템 (Current State)")}
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 14, lineHeight: 1.6 }}>
            Next.js 16 · React 19 · Prisma/PostgreSQL · NextAuth v5 · ffmpeg/yt-dlp(서버) · OpenAI(GPT-4o, Whisper) · OpenClaw 게이트웨이(twinverse-ai). Orbitron Docker 컨테이너(포트 3555)로 운영.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
            {STAGES.map(s => {
              const Icon = s.icon;
              return (
                <div key={s.title} style={{ padding: 14, background: "var(--bg-void)", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Icon size={15} color="#818cf8" />
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", flex: 1 }}>{s.title}</span>
                    <span className={`badge ${STATUS_BADGE[s.status]}`} style={{ fontSize: 10 }}>{s.status}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>{s.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* 2. 완료된 개선 */}
        <section className="card" style={{ padding: 24 }}>
          {sectionTitle(<CheckCircle2 size={20} color="#10b981" />, "2. 이전 계획 대비 완료 항목 (2026-03 → 2026-10)")}
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {DONE.map(d => (
              <li key={d.title} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", background: "rgba(16,185,129,0.05)", borderLeft: "3px solid #10b981", borderRadius: "0 8px 8px 0" }}>
                <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{d.title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55, marginTop: 2 }}>{d.note}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))" }}>
          {/* 3. 단기 과제 */}
          <section className="card" style={{ padding: 24 }}>
            {sectionTitle(<Zap size={20} color="#f59e0b" />, "3. 단기 과제 (Short-term)")}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {SHORT_TERM.map(t => (
                <div key={t.title} style={{ padding: 14, borderLeft: `3px solid ${PRIORITY_COLOR[t.priority]}`, background: `${PRIORITY_COLOR[t.priority]}0d`, borderRadius: "0 8px 8px 0", opacity: t.status === "보류" ? 0.75 : 1 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: PRIORITY_COLOR[t.priority], fontFamily: "JetBrains Mono, monospace" }}>{t.priority}</span>
                    {t.status === "보류" ? <PauseCircle size={13} color="var(--text-muted)" /> : <Circle size={13} color={PRIORITY_COLOR[t.priority]} />}
                    {t.title}
                    {t.status === "보류" && <span className="badge badge-gray" style={{ fontSize: 9 }}>보류</span>}
                  </h3>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>{t.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 4. 로드맵 */}
          <section className="card" style={{ padding: 24 }}>
            {sectionTitle(<Rocket size={20} color="#8b5cf6" />, "4. 중장기 로드맵 (Roadmap)")}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {ROADMAP.map(item => (
                <div key={item.title} style={{ background: "var(--bg-void)", padding: 14, borderRadius: 8 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>{item.title}</h4>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.55 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* 5. 운영 메모 */}
        <section className="card" style={{ padding: 24 }}>
          {sectionTitle(<Server size={20} color="#22d3ee" />, "5. 운영 메모 (Operations)")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
            {OPS.map(o => (
              <div key={o.title} style={{ padding: 14, background: "var(--bg-void)", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>{o.title}</div>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>{o.desc}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)", display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            <AlertTriangle size={14} color="#fbbf24" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              <strong style={{ color: "#fbbf24" }}>보안 주의</strong> — 저장소 Dockerfile 과 .env.local 에 비밀값(AUTH_SECRET, 관리자 계정 메모)이 평문으로 남아 있습니다. 운영 값은 모두 Orbitron 대시보드에 있으므로 저장소 쪽은 P1 과제로 정리할 것. 회원 개인 API 키 암호화 키가 AUTH_SECRET 에서 파생되므로 교체 전 마이그레이션 계획이 필요합니다.
            </span>
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "var(--text-muted)" }}>
            <Shield size={13} color="#818cf8" />
            자세한 변경 내역은 사이드바의 <strong style={{ color: "var(--text-secondary)" }}>변경이력</strong> 페이지, 값의 원본은 인프라 레지스트리(ai-shared-registry.md)를 참조하세요.
          </div>
        </section>
      </div>
    </div>
  );
}
