# 업그레이드 로그

| 날짜 | 변경 내용 | 카테고리 | 관련 파일 |
|------|-----------|----------|-----------|
| 2026-10-09 | 자막 스튜디오 한·영·일·중(간체/번체) 상호 번역 (언어 트랙 구조) | feat | src/lib/subtitle-lang.ts, src/app/dashboard/studio/page.tsx, src/app/api/studio/subtitle/route.ts |
| 2026-10-09 | 자막 번역을 OpenClaw 게이트웨이로 라우팅 (비동기 잡 + OpenAI 폴백) | feat | src/lib/translate-engine.ts, src/app/api/studio/subtitle/route.ts |
| 2026-10-09 | 회원 관리 대시보드 + 등급(일반/VIP)·역할(회원/관리자) 접근 제어 | feat | prisma/schema.prisma, src/lib/access.ts, src/app/dashboard/admin/page.tsx, src/app/api/admin/users/route.ts |
| 2026-10-09 | 소재 수집기 분야 12종 확장 + 키워드 직접 입력 수집 | feat | src/lib/niches.ts, src/app/dashboard/hunter/page.tsx |
| 2026-10-09 | 자막 스튜디오 플레이어 전체화면 (오버레이 포함) | feat | src/app/dashboard/studio/page.tsx |
| 2026-10-09 | 자막 작업 공유 링크 + 자막 번인 MP4 렌더링·다운로드 | feat | src/lib/share.ts, src/lib/render.ts, src/app/share/[token]/, src/app/api/share/ |
| 2026-10-09 | 소재 수집기 구독자·조회수 범위(이상/이하, 무제한 포함) 옵션 | feat | src/app/dashboard/hunter/page.tsx, src/app/api/youtube/search/route.ts |
| 2026-10-09 | 소재 수집기 결과 → 자막 스튜디오 바로 이동 버튼 | feat | src/app/dashboard/hunter/page.tsx |
| 2026-10-09 | 개발계획·변경이력 페이지 전면 갱신 (133커밋 정리) | docs | src/app/dashboard/plan/page.tsx, src/app/dashboard/changelog/page.tsx |
| 2026-10-09 | 자막 위치 미세 이동(D-pad·드래그), 저장/공유/렌더링 동일 적용 | feat | src/lib/subtitle-presets.ts, src/app/dashboard/studio/page.tsx |
| 2026-10-09 | 자막 상자 폭 확대 + 긴 문장 자동 축소 (가로 한 줄 표기) | feat | src/lib/subtitle-presets.ts, src/lib/render.ts |
