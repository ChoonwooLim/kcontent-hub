# 버그 수정 로그

| 날짜 | 버그 | 원인 | 수정 내용 | 관련 파일 |
|------|------|------|-----------|-----------|
| 2026-10-09 | 자막 3중 겹침(내장자막+YT CC+오버레이)·뒷부분 끊김 | YouTube 자동 자막 큐 시간 겹침으로 첫 큐만 표시, YT 자체 CC 동시 노출 | YT CC 기본 숨김 토글, 큐 정리+최신 큐 우선 표시, 조각 자막 병합 옵션 | src/app/dashboard/studio/page.tsx, src/app/api/studio/subtitle/route.ts |
| 2026-10-09 | 운영 서버 yt-dlp YouTube 다운로드 403 Forbidden | Alpine 패키지 yt-dlp(2026.03.17)가 낡아 YouTube 차단 | python3+media/bin/yt-dlp 최신 릴리스 자동 설치·3일마다 갱신, 403 시 강제 갱신 후 재시도 | src/lib/ytdlp.ts, src/lib/render.ts, src/app/api/studio/subtitle/route.ts, src/app/api/pipeline/[id]/download/route.ts |
| 2026-10-09 | 소재 수집기 언어 선택이 검색 결과에 반영 안 됨 | 분야 키워드가 전체 언어 혼합이고 relevanceLanguage 힌트만 사용 | 분야 키워드를 언어별로 재구성, 결과 defaultAudioLanguage로 2차 필터, 부족 시 영어 보충 표시 | src/lib/niches.ts, src/app/api/youtube/search/route.ts |
| 2026-10-09 | YouTube Data API 일일 검색 쿼터(Search Queries) 소진 | search.list 1회 100 units로 한도 조기 소진 | 검색을 yt-dlp 웹 검색(쿼터 0)으로 이전, 실패 키워드만 Data API 폴백 | src/lib/ytsearch.ts, src/app/api/youtube/search/route.ts |
| 2026-10-09 | 짧은 자막이 두 줄로 쪼개져 표시됨 | 번역 프롬프트의 "최대 2줄" 지침으로 번역 결과에 줄바꿈 삽입 | 프롬프트를 "줄바꿈 없이 한 줄"로 변경, 결과 저장 시 줄바꿈→공백, singleLine() 표시/렌더링 통일, 기존 세션용 일괄 정리 버튼 | src/lib/subtitle-presets.ts, src/lib/render.ts, src/app/api/studio/subtitle/route.ts, src/app/dashboard/studio/page.tsx |
