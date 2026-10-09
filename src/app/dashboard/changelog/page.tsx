"use client";
import { useState } from "react";
import {
  Wrench, Bug, Sparkles, Calendar, GitCommit, Server, FileText,
  ChevronDown, ChevronRight, CheckCircle2, Tag
} from "lucide-react";

/* ── 데이터 ─────────────────────────────────────────────── */

type TagKind = "feat" | "fix" | "upgrade" | "refactor" | "infra" | "docs";

type LogEntry = {
  date: string;
  tag: TagKind;
  title: string;
  commit?: string;
  details?: string[];
};

type Release = { version: string; date: string; summary: string };

const RELEASES: Release[] = [
  { version: "v2.1", date: "2026-10-09", summary: "다국어 자막 · OpenClaw 번역 · 회원 등급/관리자 · 공유 링크 & MP4 렌더링 · 소재 수집기 고도화" },
  { version: "v2.0", date: "2026-03-25", summary: "자막/대본/썸네일 스튜디오 · 에셋 보관소 · 영상 변환엔진 · 세션 저장 · Orbitron 배포" },
  { version: "v1.0", date: "2026-03-23", summary: "초기 구축 — 대시보드 · 소재 수집기 · AI 대본 엔진 · Prisma/PostgreSQL · 인증" },
];

const CHANGELOG: LogEntry[] = [
  /* ════════════════ 2026-10-09 — v2.1 ════════════════ */
  {
    date: "2026-10-09", tag: "docs", title: "개발계획·변경이력 페이지 전면 갱신",
    details: [
      "133개 커밋 이력을 날짜·태그별로 재정리하고 릴리스(v1.0 / v2.0 / v2.1) 구분 추가",
      "개발계획을 2026-10-09 기준 현행 아키텍처·완료 항목·단기 과제·로드맵·운영 메모로 재작성",
    ],
  },
  {
    date: "2026-10-09", tag: "feat", title: "소재 수집기 → 자막 스튜디오 바로 보내기", commit: "9459e2b",
    details: [
      "결과 카드와 미리보기 모달에 '자막 스튜디오' 버튼 추가 — 영상 ID·제목·채널을 넘겨 바로 ① 자막 추출부터 진행",
    ],
  },
  {
    date: "2026-10-09", tag: "feat", title: "소재 수집기 구독자·조회수 '이상(최소)' 조건 — 범위 검색", commit: "20c216b",
    details: [
      "설정 패널 2단 재배치: 분야·기간·언어·버튼 / 구독자 최소·최대·조회수 최소·최대",
      "최소 1천~100만 이상, 최대 5천~100만 이하·무제한. 범위가 어긋나면 반대쪽 자동 해제, 서버에서도 400 으로 검증",
      "HunterSearch 에 minSubs/minViews 컬럼 — 검색 기록 저장·복원",
    ],
  },
  {
    date: "2026-10-09", tag: "fix", title: "언어 선택이 검색에 반영되지 않던 문제 + YouTube 검색 쿼터 0 전환", commit: "22df2ec",
    details: [
      "원인: 언어를 골라도 분야 키워드를 전체 언어에서 무작위로 뽑고 relevanceLanguage 힌트만 전달",
      "분야 키워드를 10개 언어별로 분류 — 선택 언어 키워드 우선, 부족하면 영어로 보충(화면에 안내), 결과 영상의 언어 메타데이터가 다르면 제외",
      "검색 1단계를 yt-dlp 웹 검색(/results?search_query&sp=기간필터)으로 이전 — Data API search.list(100 units/회) 사용 제거, 수집 1회 쿼터 약 302 → 2 units",
      "실패 키워드만 Data API 폴백(maxResults 50), 쇼츠(60초 미만) 제외, 쿼터 초과 시 초기화 시각(한국 16~17시) 안내, '검색: yt-dlp (쿼터 0)' 배지",
    ],
  },
  {
    date: "2026-10-09", tag: "fix", title: "운영 서버 yt-dlp 403 오류 — 최신 릴리스 자동 설치·갱신", commit: "f21a501",
    details: [
      "원인: Orbitron 이미지의 Alpine 패키지 yt-dlp(2026.03.17)가 낡아 YouTube 가 다운로드를 403 으로 차단. 컨테이너 내 실측으로 최신판(2026.08.19)은 정상 확인",
      "Linux 에서는 python3 + media/bin/yt-dlp(최신 릴리스 zipapp, 3일마다 자동 갱신) 사용, 실패 시 시스템 바이너리 폴백",
      "403·서명 오류 등 '낡은 버전' 징후면 강제 갱신 후 1회 재시도. 렌더링·Whisper 오디오·파이프라인 HD 다운로드 모두 적용",
    ],
  },
  {
    date: "2026-10-09", tag: "feat", title: "소재 수집기 상한 옵션 확장 — 50만/100만/무제한, 6개월/1년/무제한", commit: "fecf5a8",
    details: ["값 0 = 무제한 (publishedAfter 생략, 필터 건너뜀). 검색 기록 복원 시 0 이 기본값으로 덮어써지지 않도록 수정"],
  },
  {
    date: "2026-10-09", tag: "feat", title: "자막 작업 공유 링크 + 자막 번인 MP4 렌더링·다운로드", commit: "b3b4277",
    details: [
      "SubtitleShare 모델 — /share/<token> 에 자막 트랙·스타일·위치 저장. 비공개 링크는 로그인한 회원 누구나(등급·API 키 무관), 공개 링크는 로그인 없이 열람",
      "공유 뷰어: YouTube·서버 파일 재생 + 자막 오버레이, 트랙 전환·이중 자막, 전체화면(F)·Space 재생, SRT/VTT 다운로드, 자막 목록 클릭 이동, 로그인 후 원래 페이지 복귀(callbackUrl)",
      "렌더링: Noto Sans CJK 폰트 1회 다운로드 → yt-dlp 원본 캐시 → ASS(프리셋 색·박스·상단/하단·보조 트랙) → ffmpeg libass 번인(x264 veryfast) → media/renders/<token>.mp4. 전역 큐 1개씩, 진행률 DB 기록, Range 지원 다운로드",
      "스튜디오 '공유 · MP4 렌더링' 카드: 링크 생성(복사)·공개 토글·렌더링 시작/진행률/다운로드·삭제. 운영 실측 3분25초 1080p 60초",
    ],
  },
  {
    date: "2026-10-09", tag: "feat", title: "자막 스튜디오 플레이어 전체화면 (자막 오버레이 포함)", commit: "ac0adfb",
    details: [
      "YouTube 자체 전체화면 대신 플레이어 컨테이너를 Fullscreen API 로 띄워 우리 자막·언어 뱃지·시간이 함께 표시",
      "우상단 버튼·컨트롤 바 아이콘·F 키, Esc 종료. 전체화면에서 자막 폰트 clamp(22px~48px) 자동 확대",
    ],
  },
  {
    date: "2026-10-09", tag: "feat", title: "소재 수집기 분야 확장(12종) + 키워드 직접 입력 수집", commit: "75cbf6e",
    details: [
      "분야 정의를 src/lib/niches.ts 로 일원화: K-컬처 9종 + 요가·필라테스·마사지·홈트레이닝·러닝 / 축구·야구·농구·골프 / 현대무용·발레·스트릿댄스",
      "수집 조건: 전체 / 그룹 전체 / 특정 분야 / 키워드 직접 입력(쉼표 구분 최대 5개, 앞 3개 사용)",
      "설정 패널에 그룹별 분야 선택, 결과 칩은 필터 전용으로 분리, 최근 수집 제목·사용 키워드 표시, HunterSearch.keywords 로 직접 입력 복원",
    ],
  },
  {
    date: "2026-10-09", tag: "feat", title: "회원 관리 대시보드 + 등급(일반/VIP)·역할(회원/관리자) 접근 제어", commit: "9714bd9",
    details: [
      "User.role / plan / disabled / 개인 API 키(AES-256-GCM 암호화) / lastLoginAt. 부트스트랩 관리자(ADMIN_EMAILS) 자동 승격, JWT 콜백에서 매 요청 갱신(재로그인 불필요), 비활성 계정 즉시 로그아웃",
      "/dashboard/admin: 회원 목록·통계, 등급/역할 인라인 변경, 비활성화·삭제·메모. 자기 자신 강등·마지막 관리자 제거 차단",
      "일반 회원은 본인 OpenAI 키(+소재 수집용 YouTube 키) 등록 전까지 기능 화면 잠금 + API 403 KEY_REQUIRED. VIP/관리자는 OpenClaw 번역 + 서버 공용 키",
      "자막/대본/파이프라인/소재검색 API 로그인 필수화, '내 API 키' 설정 페이지(마스킹·검증·삭제), /api/me + useMe 훅",
    ],
  },
  {
    date: "2026-10-09", tag: "feat", title: "자막 번역을 twinverse-ai OpenClaw 게이트웨이로 라우팅", commit: "acc67b7",
    details: [
      "TRANSLATE_PROVIDER=openclaw 이면 OpenClaw OpenAI 호환 엔드포인트(에이전트 codex-pro)로 번역, 실패 시 OpenAI GPT-4o 대체(사유를 메시지에 표시)",
      "번역을 비동기 잡으로 전환: POST async → 202 jobId → GET ?job= 폴링 (Orbitron 프록시 60초 한도 회피), 청크 진행률 표시",
      "GET ?config=1 로 현재 엔진 노출, UI '엔진: OpenClaw · codex-pro' 라벨. OpenClaw 는 청크 60줄·동시 2개, JSON 관대 파싱",
    ],
  },
  {
    date: "2026-10-09", tag: "infra", title: "운영 환경변수 누락 복구 · DB 스키마 반영 절차 정비",
    details: [
      "운영 컨테이너에 DATABASE_URL 등이 전혀 주입되지 않아 DB 조회가 실패하던 문제 발견 — Orbitron 이 Dockerfile ENV 를 제거하고 env_vars 가 비어 있었음. 대시보드 환경변수로 DATABASE_URL·OPENAI_API_KEY·YOUTUBE_API_KEY·AUTH_SECRET·OPENCLAW_TOKEN 등 주입",
      "Prisma CLI 가 .env.local 을 읽지 않는 문제 — npm run db:push / db:validate (dotenv-cli) 스크립트 추가",
      "인프라 레지스트리에 OPENCLAW_GATEWAY_URL 표준 변수 및 ContentsHub 자막 번역 용도 등록",
    ],
  },
  {
    date: "2026-10-09", tag: "fix", title: "자막 3중 겹침·뒷부분 끊김 수정", commit: "edda6ca",
    details: [
      "YouTube 플레이어 자체 CC 기본 숨김(우상단 YT CC 토글) — 영상에 구워진 자막·YouTube CC·우리 오버레이가 겹치던 문제",
      "YouTube 자동 자막의 큐 시간이 겹쳐 뒤 큐가 영영 표시되지 않던 문제 — 겹치는 큐 정리(end 를 다음 start 로) + 가장 최근 시작한 큐 우선 표시",
      "짧게 끊긴 조각 자막을 앞 문장에 이어 붙이는 옵션(기본 ON), 오버레이 위치 하단/상단 선택",
    ],
  },
  {
    date: "2026-10-09", tag: "feat", title: "자막 스튜디오 한·영·일·중(간체·번체) 상호 번역", commit: "edda6ca",
    details: [
      "언어 트랙 구조(texts) 도입 — 한 자막에 ko/en/ja/zh/zh-Hant 텍스트 동시 보관, 트랙 칩으로 편집·미리보기·내보내기 전환, 번역된 트랙에서 2차 번역 가능",
      "추출: 원본 언어 자동 감지/지정, YouTube CC 언어 트랙 우선(zh-Hans/zh-TW 등), Whisper language·prompt 힌트, 간체/번체 한자 자동 판별, HTML 엔티티 복원",
      "번역: 언어별 전용 프롬프트 + 방송 윤문/원문 충실 스타일, 청크 3개 병렬, 동일 언어 차단",
      "이중 자막 미리보기(보조 트랙), 편집 리스트 원본 참고 텍스트, 언어별 SRT/VTT 및 이중 자막 SRT 내보내기, 저장 목록 'EN → KO' 뱃지",
      "Noto Sans KR/JP/SC/TC 웹폰트 및 lang 속성으로 한자 글리프 정확히 렌더링. StudioSession 에 sourceLang/activeLang 컬럼",
    ],
  },

  /* ════════════════ 2026-03-25 — v2.0 ════════════════ */
  {
    date: "2026-03-25", tag: "feat", title: "썸네일 스튜디오 신규 제작 (Canvas 2D · FHD)",
    details: [
      "미리캔버스 스타일 네이티브 유튜브 썸네일 편집기 — 1920×1080 FHD 출력, 좌측 UI 패널 개편",
      "원클릭 스마트 템플릿 20종 + 시스템 기본 프리셋 12종(배경 이미지 마운트·타이포그래피 강화·폰트 사이즈 조정), 리얼 스케일 비주얼 갤러리(5단)",
      "무료 유튜브 폰트 4종(도현·검은고딕 등) 속성 제어, 오토세이브(localStorage), 현재 템플릿 덮어쓰기, 캡처 이미지를 갤러리 프리뷰로 사용",
      "제작 썸네일 스토리지(ThumbnailAsset) — 저장 시 '내 템플릿' 커스텀 프리셋으로 자동 등록, 에셋 보관소 전용 탭",
    ],
  },
  {
    date: "2026-03-25", tag: "feat", title: "에셋 보관소 — 캡처 이미지·다운로드 영상 통합 관리",
    details: [
      "사이드바 메뉴 추가, 캡처 이미지/영상 관리 대시보드 및 API",
      "자막 스튜디오 '현재 화면 캡처'를 세션 DB에 연동해 통합 노출, 다중 캡처·영상/대본별 그룹핑 렌더링",
      "컴팩트 프리미엄 갤러리 레이아웃, 상세보기 모달, '썸네일 스튜디오로 보내기' 원클릭 연동",
    ],
  },
  {
    date: "2026-03-25", tag: "feat", title: "AI 대본 엔진 — 코릿치 브랜딩 · 프레임 캡처 · 세션 UX",
    details: [
      "코릿치(Koritch) 채널 브랜딩: 오프닝/클로징 인사말 자동 생성, 3파트 나레이션 구조(인트로 20~30초 + 본편 보조 나레이션 + 아웃트로 10초)",
      "로컬 비디오 프레임 자동 캡처(현재 시간 매칭) 및 수동 저장 — DB에 프레임·캡처 보관",
      "자막 스튜디오와 동일한 '현재 작업 저장'/'저장된 작업' 세션 UX, 목록 보기 전환, 캔버스 캐시 우회(Cache Buster)",
      "대본 엔진·자막 번역 프롬프트 고도화(프로 작가/방송 스타일)",
    ],
  },
  {
    date: "2026-03-25", tag: "fix", title: "AI 대본 엔진 4대 버그 패치",
    details: [
      "로컬 영상 길이 파악 불가로 대본이 무한정 길어지던 타임스탬프 과다 생성 수정(길이 선행 계측)",
      "자막 스튜디오에서 넘어온 타임스탬프가 GPT 프롬프트에서 유실되던 문제 수정([00:15] 맵핑)",
      "로컬 영상 저장 불가(videoId 400) 및 썸네일 클릭 시 YouTube 플레이어 모달 에러 수정 — HTML5 video 로 전환",
      "저장 목록 불러오기 JSON 구조 불일치 크래시, React Key 미할당 textarea 재사용 버그, 로컬 썸네일 누락 플레이스홀더",
    ],
  },
  {
    date: "2026-03-25", tag: "feat", title: "자막 스튜디오 세션 저장/불러오기 + 스마트 자막 추출",
    details: [
      "Prisma StudioSession 모델, CRUD API, 같은 영상 upsert, 썸네일·자막 수·번역 상태 카드 UI, 세션 복원·삭제",
      "스마트 추출: YouTube CC 우선 → ffmpeg 오디오 추출(HD 400MB → 4MB) → Whisper 음성 분석 폴백, 추출 방법 표시",
      "Whisper 안정화: 25MB 사전 체크, 4분 타임아웃, HTML 에러 응답 안전 처리, bodySizeLimit 50MB",
      "504 HTML 응답을 JSON 파싱하던 SyntaxError 수정(content-type 검사), 전송 시 이전 자막 완전 초기화",
    ],
  },
  {
    date: "2026-03-25", tag: "upgrade", title: "다운로드 영상 관리 — 영구 볼륨·삭제·DB 연동",
    details: [
      "저장 경로를 영구 볼륨(media/downloads)으로 이전 — Docker 재빌드 시 보존, 항상 Orbitron 서버에서 로드(CORS 허용, DB filepath 직접 사용)",
      "다운로드 완료 시 자동 DB 등록, 파일명 타임스탬프로 덮어쓰기 방지, 목록 제거(✕)/완전 삭제(🗑️) 분리, 파이프라인 목록 제거 버튼",
      "서빙: DB filepath 우선 + saved/루트/하위폴더 검색 + 원격 프록시",
    ],
  },
  {
    date: "2026-03-25", tag: "fix", title: "Docker/Orbitron 빌드 안정화",
    details: [
      "youtube-transcript 정적 import → dynamic import (ESM 빌드 에러), 빌드용 DATABASE_URL 더미, serverExternalPackages 정리",
      "메뉴 명칭 정리: '편집 스튜디오' → '자막 스튜디오', '영상 편집기' → '영상 변환엔진', 사이드바 순서 조정, 배포 패널 → 'AI 대본엔진으로 보내기'",
      "변경이력 페이지 신설, SSH 서버 워크플로우 문서 추가",
    ],
  },

  /* ════════════════ 2026-03-24 ════════════════ */
  {
    date: "2026-03-24", tag: "feat", title: "영상 변환엔진 — yt-dlp 다운로드 + ffmpeg 클립 트림/병합",
    details: [
      "파이프라인 편집기: 클립 관리(시작/끝/라벨), AI 자동 클립 분석(자막 없는 영상은 균등 분할 폴백), 처리 단계 API",
      "yt-dlp·ffmpeg 자동 탐색(findBinary), curl 바이너리 설치, 비동기 다운로드 + 실시간 진행률(504 타임아웃 해결), 트림/병합 단계별 진행률",
      "ffmpeg -progress 블로킹 제거(runFFmpegSimple), 타임아웃 10분",
    ],
  },
  {
    date: "2026-03-24", tag: "feat", title: "자막 스튜디오 — CC 추출 + GPT-4o 번역 + 파일 재생 + Whisper",
    details: [
      "YouTube CC 자막 추출 API, GPT-4o 한국어 번역(30줄 청크), 스타일 프리셋 4종, SRT/VTT 내보내기, 실시간 싱크 미리보기",
      "서버 파일 HTML5 video 모드, 편집기 '자막 스튜디오로 전송', Whisper AI 음성분석 자막 추출(편집 영상도 정확한 싱크)",
    ],
  },
  {
    date: "2026-03-24", tag: "feat", title: "인증 시스템 — NextAuth v5 + 회원가입 + 워크스페이스",
    details: [
      "Credentials 로그인(bcrypt), JWT 세션, 로그인/회원가입 페이지·API, 홈페이지 버튼",
      "Workspace 기반 구조, 가입 시 기본 워크스페이스 멤버 등록, PipelineVideo workspaceId 추가(Null constraint 해결)",
    ],
  },
  {
    date: "2026-03-24", tag: "upgrade", title: "PostgreSQL 동기화 — 다운로드 영상·소재 수집 기록",
    details: [
      "다운로드 영상 DB 영구 저장(다른 PC 에서도 동일), 소재 수집기 검색 기록 HunterSearch 모델(localStorage 제거)",
      "저장된 대본 로딩 안정화, DB 에러 노출, prisma db push 비차단 배포",
    ],
  },

  /* ════════════════ 2026-03-23 — v1.0 ════════════════ */
  {
    date: "2026-03-23", tag: "feat", title: "소재 수집기 — YouTube Data API 검색 + AI 점수/등급",
    details: [
      "니치별 다국어 키워드 검색, 구독자·조회수·기간 필터, 한국어 영상 자동 제외, 임베드 가능 필터",
      "S/A/B 등급 산정(구독자 대비 조회수, 좋아요 비율, 최신성, 길이, 구독자 규모), 미리보기 모달",
    ],
  },
  {
    date: "2026-03-23", tag: "feat", title: "AI 대본 엔진 — GPT-4o + YouTube Transcript + 스토리보드",
    details: [
      "youtube-transcript 자막 추출(영어 → 한국어 폴백), Data API 메타데이터, GPT-4o 한국어 대본(hook/reaction/narration/commentary), 썸네일 카피",
      "영상 길이 기반 장면 수 계산(40초당 1장면, 최소 12개), 스토리보드 프레임 API, Script 모델 DB 저장·목록·삭제",
    ],
  },
  {
    date: "2026-03-23", tag: "feat", title: "KContent Studio 초기 구축 + Orbitron 배포",
    details: [
      "Next.js 16(Turbopack) + React 19 + Tailwind 4 + Prisma/PostgreSQL, 대시보드 레이아웃(사이드바·탑바), 프리미엄 다크 테마",
      "Prisma 핵심 모델, API 키 설정 페이지(YouTube·OpenAI 검증), 파이프라인 API, 자막 스튜디오 초기 페이지(SRT/VTT)",
      "Orbitron 배포: 커스텀 Dockerfile, turbopack.root, Next 15+ 동적 라우트 params 타입 수정",
    ],
  },
];

/* ── 태그 색상/아이콘 ──────────────────────────────────── */
const TAG_STYLE: Record<TagKind, { label: string; color: string; bg: string; icon: typeof Sparkles }> = {
  feat:     { label: "기능추가", color: "#818cf8", bg: "rgba(129,140,248,0.08)", icon: Sparkles },
  fix:      { label: "버그수정", color: "#f87171", bg: "rgba(248,113,113,0.08)", icon: Bug },
  upgrade:  { label: "개선",     color: "#34d399", bg: "rgba(52,211,153,0.08)",  icon: Wrench },
  refactor: { label: "리팩터",   color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  icon: Wrench },
  infra:    { label: "운영·배포", color: "#22d3ee", bg: "rgba(34,211,238,0.08)",  icon: Server },
  docs:     { label: "문서",     color: "#a78bfa", bg: "rgba(167,139,250,0.08)", icon: FileText },
};

type Filter = "all" | TagKind;

/* ── 컴포넌트 ─────────────────────────────────────────── */
export default function ChangelogPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [expandedIdx, setExpandedIdx] = useState<Set<number>>(new Set());

  const filtered = filter === "all" ? CHANGELOG : CHANGELOG.filter(e => e.tag === filter);

  // 날짜별 그룹핑 (최신순)
  const grouped = filtered.reduce<Record<string, LogEntry[]>>((acc, entry) => {
    (acc[entry.date] ??= []).push(entry);
    return acc;
  }, {});

  const toggle = (i: number) => {
    setExpandedIdx(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const count = (t: TagKind) => CHANGELOG.filter(e => e.tag === t).length;
  const statCards: { label: string; val: number; color: string; filter: Filter }[] = [
    { label: "전체", val: CHANGELOG.length, color: "#818cf8", filter: "all" },
    { label: "기능추가", val: count("feat"), color: "#818cf8", filter: "feat" },
    { label: "버그수정", val: count("fix"), color: "#f87171", filter: "fix" },
    { label: "개선", val: count("upgrade"), color: "#34d399", filter: "upgrade" },
    { label: "운영·배포", val: count("infra"), color: "#22d3ee", filter: "infra" },
  ];

  const releaseOf = (date: string) => RELEASES.find(r => r.date === date);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 900 }}>
      {/* 헤더 */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>변경이력</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          작업일지 · 버그수정 히스토리 · 업그레이드 이력 — 총 133개 커밋 (2026-03-23 ~ 2026-10-09)
        </p>
      </div>

      {/* 릴리스 */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 6 }}>
          <Tag size={13} color="#818cf8" /> 릴리스
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {RELEASES.map(r => (
            <div key={r.version} style={{ display: "flex", gap: 10, alignItems: "baseline", fontSize: 12 }}>
              <span className="badge badge-brand" style={{ fontSize: 11, minWidth: 44, justifyContent: "center" }}>{r.version}</span>
              <span style={{ color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace", flexShrink: 0 }}>{r.date}</span>
              <span style={{ color: "var(--text-secondary)" }}>{r.summary}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 통계 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
        {statCards.map(s => (
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
        {Object.entries(grouped).map(([date, entries]) => {
          const rel = releaseOf(date);
          return (
            <div key={date} style={{ position: "relative" }}>
              {/* 날짜 헤더 */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "12px 0 8px",
                fontSize: 13, fontWeight: 700, color: "var(--text-secondary)",
              }}>
                <Calendar size={14} color="#818cf8" />
                {new Date(date).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>({entries.length}건)</span>
                {rel && <span className="badge badge-brand" style={{ fontSize: 10 }}>{rel.version}</span>}
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
                      style={{ padding: "12px 16px", cursor: "pointer", transition: "all 0.15s", position: "relative" }}
                      onClick={() => toggle(globalIdx)}
                    >
                      <div style={{
                        position: "absolute", left: -28, top: 16,
                        width: 10, height: 10, borderRadius: "50%",
                        background: ts.color, border: "2px solid var(--bg-base)",
                      }} />

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                          color: ts.color, background: ts.bg,
                          display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
                        }}>
                          <TagIcon size={10} />
                          {ts.label}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, flex: 1, color: "var(--text-primary)" }}>
                          {entry.title}
                        </span>
                        {entry.commit && (
                          <code style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>{entry.commit}</code>
                        )}
                        {entry.details && (
                          open
                            ? <ChevronDown size={14} color="var(--text-muted)" />
                            : <ChevronRight size={14} color="var(--text-muted)" />
                        )}
                      </div>

                      {open && entry.details && (
                        <div style={{
                          marginTop: 10, paddingTop: 10,
                          borderTop: "1px solid var(--border-subtle)",
                          display: "flex", flexDirection: "column", gap: 5,
                        }}>
                          {entry.details.map((d, j) => (
                            <div key={j} style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                              <CheckCircle2 size={12} color={ts.color} style={{ marginTop: 3, flexShrink: 0 }} />
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
          );
        })}
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
        이 페이지는 KContent Studio 의 주요 변경사항을 기록합니다. 커밋 단위 상세 이력은 GitHub ChoonwooLim/kcontent-hub 를 참조하세요.
      </div>
    </div>
  );
}
