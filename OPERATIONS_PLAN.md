# 4개 프로젝트 지속 개발/운영 계획

## 목표
- 서비스 가용성 99% 유지
- 배포/변경의 재현성 확보
- 핵심 사용자 플로우 회귀 없이 점진적 개선

## 프로젝트별 4주 운영 로드맵

### 1) moltbets2
- API 가용성
  - `/api` 라우트/헬스체크 자동화
  - 라운드 타이밍/게임 진행 지표 모니터링(처리량, 에러율)
- UX
  - 배치/로그 텍스트 안정성, 폴링 간격 최적화

### 2) StoryVerse
- sv.moss.land 동작성 점검
  - 핵심 페이지 3개(Landing, gameplay, profile) 200/리다이렉트 체크
  - 정적 에셋 캐시 전략 리뷰(필요시 TTL 재조정)

### 3) mossland-promptfolio
- UI/라우팅 회귀 테스트
  - 주요 화면 렌더/로딩 상태 진단 (`npm test` 84케이스 + `npm run build` 라우트 검증)
  - 배포 포인트 정합성 점검 (`npm run ops:check` — `/`, `/api/health`, `/season` 프로브 + 저장소 신선도 체크)

### 4) null
- 백엔드 스케줄링/translator 파이프라인 동작성
  - 일일 번들러/큐 로그의 실패율 추적
  - 프런트 빌드-런타임 기본 회귀 테스트

## 주기 작업 (3시간)
- PM2 상태 확인
- 주요 도메인 헬스체크
- 에러 로그의 5xx/5분간 spike 탐지
- 이상 징후 있으면 즉시 수정/패치 후 커밋 & 푸시

## 실행 규칙
- 최소 변경 원칙
- 커밋 메시지 규칙: `type(scope): concise`
- 변경 전/후 헬스체크 로그를 남김

## 스프린트 진행 현황 (자동운영)
- 1) Add ops check script and baseline endpoint monitoring for UI/API pages. ✅
- 2) Season lifecycle 자동화 완료 — 주간 시즌 자동 프로비저닝(`ensureWeeklySeason`) + `/api/health` 확장(uptime/version) + 푸터 헬스 배지(30초 폴링). ✅
- 3) Next cycle: synthetic runbook for tick execution freshness (15분 staleness budget 기준) + 배포 후 스모크 체크 자동화.
