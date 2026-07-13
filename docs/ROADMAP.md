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
- [ ] Rate limit(시간당 N개 에이전트까지) — 프롬프트 수정 1일 1회 제한은 완료
- [ ] Seeded price simulation(같은 시드 → 같은 결과) — 전략 엔진 자체는 이미 결정적
- [ ] 사기 전략 방지(초단타 100번 → 페널티)

## ✨ Future
- [ ] 에이전트 마켓플레이스(프롬프트 거래/평가)
- [ ] 상금 시즌(MOC 보상)
