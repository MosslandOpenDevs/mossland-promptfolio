import { cookies } from 'next/headers';

export type Locale = 'en' | 'ko';

export function getLocale(): Locale {
  const c = cookies();
  const v = c.get('pf_locale')?.value;
  return v === 'ko' ? 'ko' : 'en';
}

const dict = {
  en: {
    appName: 'mossland-promptfolio',
    tagline: 'paper trading league for MOC — prompts, memes, replays',
    home: 'home',
    arenaTitle: 'THE PROMPTFOLIO ARENA',
    arenaSubtitle: 'Create meme trader agents with prompts. Run ticks. Watch the leaderboard. Replay every trade.',
    agents: 'Agents',
    season: 'Season',
    leaderboard: 'Leaderboard',
    replay: 'Replay',
    disclaimer: 'Disclaimer: paper trading only. Not financial advice.',

    agentsTitle: 'Agents',
    summonAgent: 'Summon agent',
    name: 'Name',
    avatarEmoji: 'Avatar emoji',
    promptPersona: 'Prompt persona',
    noAgents: 'No agents yet. Summon the first meme trader.',
    noAgentsMatch: 'No agents matched your search.',
    agentsFilterLabel: 'Search agents',
    agentsFilterPlaceholder: 'Filter by name, id, or prompt',
    agentsFilterApply: 'Apply',
    agentsFilterClear: 'Clear',
    agentsFilterShowing: 'Showing',
    agentsFilterOf: 'of',

    seasonTitle: 'Season',
    currentSeason: 'Current season',
    noSeason: 'No season yet. Create one.',
    seasonName: 'Season name',
    startingCash: 'Starting cash (USD)',
    startNewSeason: 'Start new season',
    runTick: 'Run tick (fetch MOC price + rebalance all agents)',
    createSeasonFirst: 'Create a season first.',
    recentTicks: 'Recent ticks',
    noTicks: 'No ticks yet.',
    noPortfolios: 'No portfolios yet. Create agents + run a tick.',
    mocUsdLabel: 'moc_usd',

    currentPrompt: 'Current prompt',
    updatePrompt: 'Update prompt',
    updatePromptLimit: 'Update prompt (1x per day)',
    promptLocked: 'Prompt already updated today. Come back tomorrow.',
    promptHistory: 'Prompt change history',
    noChanges: 'No changes yet.',

    locale: 'Language',
    english: 'English',
    korean: 'Korean',
    skipToContent: 'Skip to content',
  },
  ko: {
    appName: 'mossland-promptfolio',
    tagline: 'MOC 모의투자 리그 — 프롬프트, 밈, 리플레이',
    home: '홈',
    arenaTitle: '프롬프트폴리오 아레나',
    arenaSubtitle: '프롬프트로 밈 트레이더 에이전트를 만들고, Tick 돌리고, 랭킹 보고, 거래 이유를 리플레이해.',
    agents: '에이전트',
    season: '시즌',
    leaderboard: '랭킹',
    replay: '리플레이',
    disclaimer: '면책: 모의투자 게임이야. 투자 조언 아님.',

    agentsTitle: '에이전트',
    summonAgent: '에이전트 소환',
    name: '이름',
    avatarEmoji: '아바타 이모지',
    promptPersona: '프롬프트(페르소나)',
    noAgents: '아직 에이전트가 없어. 첫 밈 트레이더를 소환해봐.',
    noAgentsMatch: '검색 조건에 맞는 에이전트가 없어.',
    agentsFilterLabel: '에이전트 검색',
    agentsFilterPlaceholder: '이름, id, 프롬프트로 필터',
    agentsFilterApply: '적용',
    agentsFilterClear: '초기화',
    agentsFilterShowing: '표시',
    agentsFilterOf: '/',

    seasonTitle: '시즌',
    currentSeason: '현재 시즌',
    noSeason: '시즌이 없어. 새로 만들어.',
    seasonName: '시즌 이름',
    startingCash: '시작 현금(USD)',
    startNewSeason: '새 시즌 시작',
    runTick: 'Tick 실행 (MOC 가격 가져오기 + 전체 리밸런스)',
    createSeasonFirst: '먼저 시즌을 만들어야 해.',
    recentTicks: '최근 Tick',
    noTicks: '아직 Tick이 없어.',
    noPortfolios: '아직 포트폴리오가 없어. 에이전트를 만든 뒤 Tick을 실행해.',
    mocUsdLabel: 'moc_usd',

    currentPrompt: '현재 프롬프트',
    updatePrompt: '프롬프트 수정',
    updatePromptLimit: '프롬프트 수정 (하루 1회)',
    promptLocked: '오늘은 이미 수정했어. 내일 다시 와.',
    promptHistory: '프롬프트 변경 기록',
    noChanges: '변경 기록이 없어.',

    locale: '언어',
    english: '영어',
    korean: '한국어',
    skipToContent: '본문으로 이동',
  },
} as const;

export type I18nKey = keyof typeof dict.en;

export function t(locale: Locale, key: I18nKey): string {
  return dict[locale][key] ?? dict.en[key];
}
