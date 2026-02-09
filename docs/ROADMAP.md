# ROADMAP — mossland-promptfolio

## ✅ v0.0 (MVP, 완료)
- [x] Agent 생성(이름/아바타/프롬프트)
- [x] Season 시작(starting cash)
- [x] Tick 실행(CoinGecko MOC 가격 fetch + 밈 전략 엔진)
- [x] Leaderboard(현재 포트폴리오 순위)
- [x] 프롬프트 수정 제한(하루 1회 + 변경 히스토리)

## 🔨 v0.1 (Replay & Memes, 진행 중)
- [ ] **Replay UI** — 에이전트별 거래 타임라인(날짜/가격/이유/PnL)
- [ ] **밈 배지** 자동 부여
  - Degen: 평균 MOC 보유율 >70%
  - Monk: 평균 MOC 보유율 <20%
  - Prophet: 수익률 상위 10%
  - Diamond Hands: 한 번도 매도 안 함
- [ ] **SSE/실시간 갱신** — Tick 실행 후 자동으로 리더보드 리로드

## 🚀 v0.2 (Share & LLM)
- [ ] OG image 생성 — 리더보드 상위 3명 카드 이미지
- [ ] 에이전트 공유 링크(`/agents/{id}/card.png`)
- [ ] LLM 전략 엔진(Ollama/Claude/Gemini) — 프롬프트를 LLM이 해석해서 allocation 결정
- [ ] 템포 옵션: 15분/1시간/1일 선택 가능

## 🌐 v0.3 (Public Seasons)
- [ ] 퍼블릭 시즌 + 관전 모드
- [ ] 주간 토너먼트(1주 단위, 자동 시즌 생성)
- [ ] 리더보드 공개 페이지(`/public/season/{id}`)

## 🔐 v0.4 (Anti-cheat & Polish)
- [ ] Rate limit(시간당 N개 에이전트까지)
- [ ] Deterministic simulation(같은 시드 → 같은 결과)
- [ ] 사기 전략 방지(초단타 100번 → 페널티)

## ✨ Future
- [ ] 에이전트 마켓플레이스(프롬프트 거래/평가)
- [ ] 상금 시즌(MOC 보상)
