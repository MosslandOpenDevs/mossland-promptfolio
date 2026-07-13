# ROADMAP — mossland-promptfolio

## ✅ v0.0 (MVP, 완료)
- [x] Agent 생성(이름/아바타/프롬프트)
- [x] Season 시작(starting cash)
- [x] Tick 실행(CoinGecko MOC 가격 fetch + 밈 전략 엔진)
- [x] Leaderboard(현재 포트폴리오 순위)
- [x] 프롬프트 수정 제한(하루 1회 + 변경 히스토리)

## ✅ v0.1 (Replay & Operator Console, 대부분 완료)
- [x] **Replay UI** — 에이전트별 거래 타임라인(날짜/가격/이유/실현·미실현 PnL)
  - `/agents/[id]/replay` + 전체 데스크 필터 인덱스 `/replay` (정렬/검색/자산 범위/공유 링크)
- [x] **주간 시즌 자동 생성** — ISO 주 단위 시즌 자동 프로비저닝(`season_YYYYwWW`, 방문/틱 시 자동 생성)
- [x] **운영자 대시보드** — 레이더 알림, 브리핑, 우선순위 큐, 체크리스트, 시프트 핸드오프, 펄스 보드, 마켓 레짐, 데스크 워치리스트
- [x] **키보드 퀵 점프** — Alt+0-9/D/L/P/U/R 섹션 점프, `/` 필터, 핀보드, 최근 이동 기록
- [x] **EN/KO 이중 언어 UI** — 쿠키 기반 로케일 토글
- [x] **헬스 배지** — `/api/health` 30초 폴링 + 수동 새로고침
- [x] **틱 실행 후 자동 갱신** — AJAX 틱 후 `router.refresh()`, 폼 POST는 리더보드로 리다이렉트
- [ ] **밈 배지 자동 부여** (수상 개념 — 엔진용 DEGEN/MONK/NORMIE 프로필은 이미 구현됨)
  - Degen: 평균 MOC 보유율 >70%
  - Monk: 평균 MOC 보유율 <20%
  - Prophet: 수익률 상위 10%
  - Diamond Hands: 한 번도 매도 안 함
- [ ] **SSE 실시간 스트리밍** — 현재는 폴링/리프레시 기반, 진짜 push 미구현
- [ ] **스코어링 확장** — max drawdown, 거래 빈도 페널티 (PnL/ROI는 완료)

## ✅ v0.1.1 (Hardening & Security, 완료)
- [x] **데이터 무결성** — 틱/에이전트 생성/프롬프트 수정을 SQLite 트랜잭션으로 원자화(부분 반영 롤백)
- [x] **POST-redirect-GET** — 폼 리다이렉트를 307→303으로 정정
- [x] **헬스 준비성 검사** — `/api/health`가 DB/스키마 확인, 불가 시 `503`
- [x] **최초 프롬프트 이력화** — 생성 시 프롬프트를 v1로 기록
- [x] **보안 업그레이드** — Next.js 14→16 (advisory 9건 해소), postcss override, `npm audit --omit=dev` 0건
- [x] **쓰기 API 보호** — 동일 출처(CSRF) 검사 + 라우트별 IP 레이트리밋(`429`/`Retry-After`)
- [x] **툴링** — ESLint 9 flat config, `typecheck` 스크립트, GitHub Actions CI

## 🚀 v0.2 (Share & LLM)
- [ ] OG image 생성 — 리더보드 상위 3명 카드 이미지
- [ ] 에이전트 공유 링크(`/agents/{id}/card.png`)
- [ ] LLM 전략 엔진(Ollama/Claude/Gemini) — 프롬프트를 LLM이 해석해서 allocation 결정
  - 현재 엔진은 결정적 키워드 매처(degen/올인→90%, monk/금욕→0%, 기본 50/50)
- [ ] 템포 옵션: 15분/1시간/1일 선택 가능

## 🌐 v0.3 (Public Seasons)
- [x] 주간 토너먼트(1주 단위, 자동 시즌 생성) — v0.1에서 조기 구현됨
- [ ] 퍼블릭 시즌 + 관전 모드
- [ ] 리더보드 공개 페이지(`/public/season/{id}`)

## 🔐 v0.4 (Anti-cheat & Polish)
- [x] Rate limit — 라우트별 IP 레이트리밋 완료(에이전트/시즌/틱/프롬프트/로케일)
- [ ] Seeded price simulation(같은 시드 → 같은 결과) — 전략 엔진 자체는 이미 결정적
- [ ] 사기 전략 방지(초단타 100번 → 페널티)

## 🧭 향후 계획 (Deferred — 우선순위순)

리뷰에서 제기됐지만 이번 범위에 넣지 않은 항목들. 규모가 크거나 제품/법적 결정이 필요해
별도 작업으로 남긴다.

1. **사용자 인증 / 소유권 모델** — 현재 사용자 모델이 없어 동일 출처면 누구나 쓰기 가능.
   퍼블릭·멀티테넌트 운영 전 세션 + 에이전트/프롬프트 소유권 검사가 필요. (레이트리밋·CSRF는
   남용을 줄일 뿐 호출자를 인증하지는 않음 — [SECURITY.md](SECURITY.md) 참고)
2. **LLM 전략 엔진 (StrategySpec)** — 자연어 프롬프트를 검증 가능한 JSON 정책으로 1회 컴파일하고,
   시즌은 그 정책을 결정적으로 실행. 현재는 키워드 매처(v0.2 항목과 연계).
3. **레이트리밋 공유 스토어** — 현재 인메모리/프로세스별. 다중 인스턴스 시 SQLite/Redis 등
   공유 저장소 필요.
4. **시즌 데이터 모델 강화** — 시즌 roster/state, 수수료·슬리피지 반영 `fills`,
   `market_snapshots`(출처·시간·해시), idempotency key로 중복 틱 방지, FK/CHECK 제약.
5. **Replay 200건 상한 정리** — 현재 `ORDER BY ts ASC LIMIT 200`(오래된 200건). 원가기준 PnL이
   전체 이력에 의존하므로 "전체 계산 + 최근 N행 표시"로 분리 필요(표시 정책 결정 사항).
6. **밈 배지 자동 부여 / drawdown·거래빈도 스코어링 / SSE 스트리밍** (위 v0.1 미완 항목).
7. **React 19 업그레이드** — Next 16은 React 18 지원(현행 유지). 향후 View Transitions 등
   활용 시 이전.
8. **LICENSE 선언** — 오픈소스 라이선스 미선언(현재 all-rights-reserved). 소유자 결정 필요.

## ✨ Future
- [ ] 에이전트 마켓플레이스(프롬프트 거래/평가)
- [ ] 상금 시즌(MOC 보상)
