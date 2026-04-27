const MAX_ROULETTE_POCKETS = 38;
const DOUBLE_ZERO_NUMBER = 37;
const MAX_HISTORY_ITEMS = 120;
const DEFAULT_NAV_VIEW = "play";
const SPIN_TRANSITION_DURATION_MS = 3200;
const SPIN_FULL_ROTATIONS = 6;
const UPGRADE_COST_MULTIPLIER = 1.45;
const SAVE_KEY = "roulette_plus_v2";
const DAILY_DATE_KEY = new Date().toISOString().slice(0, 10);
function getWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
const WEEK_KEY = getWeekKey();

const EUROPEAN_ROULETTE_SEQUENCE = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const AMERICAN_ROULETTE_SEQUENCE = [0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, DOUBLE_ZERO_NUMBER, 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2];
const FRENCH_CALL_BUNDLES = {
  voisins: [22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25],
  tiers: [27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33],
  orphelins: [1, 20, 14, 31, 9, 17, 34, 6]
};
const TABLE_VARIANTS = {
  european: { label: "European", sequence: EUROPEAN_ROULETTE_SEQUENCE, houseEdge: 2.7, hasDoubleZero: false },
  french: { label: "French", sequence: EUROPEAN_ROULETTE_SEQUENCE, houseEdge: 1.35, hasDoubleZero: false },
  american: { label: "American", sequence: AMERICAN_ROULETTE_SEQUENCE, houseEdge: 5.26, hasDoubleZero: true }
};
const redNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const EVEN_MONEY_KEYS = new Set(["red", "black", "even", "odd", "low", "high"]);
const AUTO_WARN = "Auto-betting can rapidly increase losses. Always use stop limits.";
const CHART_BARS = " ▁▂▃▄▅▆▇█";

const MODE_CONFIG = {
  classic: { label: "Classic", payoutMultiplier: 1, insuranceMultiplier: 1, durationMultiplier: 1 },
  highRisk: { label: "High-Risk", payoutMultiplier: 1.35, insuranceMultiplier: 0.7, durationMultiplier: 1 },
  chaos: { label: "Chaos", payoutMultiplier: 1.05, insuranceMultiplier: 1, durationMultiplier: 1 },
  speed: { label: "Speed", payoutMultiplier: 0.95, insuranceMultiplier: 1, durationMultiplier: 0.45 }
};

const MODIFIERS = [
  { key: "doubleRed", label: "Double Red Payout", apply: (ctx) => { if (ctx.bet.key === "red") ctx.profitMultiplier *= 2; } },
  { key: "insuranceBoost", label: "Insurance Boost", after: (ctx) => { ctx.insuranceMultiplier *= 2; } },
  { key: "luckyStipend", label: "Lucky Stipend", after: (ctx) => { ctx.stipendFlat += 5; } },
  { key: "jackpotNumbers", label: "Jackpot Numbers", apply: (ctx) => { if (ctx.bet.key.startsWith("number:")) ctx.profitMultiplier *= 1.5; } }
];

const MISSION_POOL = [
  { id: "mission_spins_easy", tier: "easy", text: "Complete 8 spins", target: 8, type: "spins", reward: { tokens: 40, xp: 30 } },
  { id: "mission_wins_easy", tier: "easy", text: "Win 3 spins", target: 3, type: "wins", reward: { tokens: 45, xp: 35 } },
  { id: "mission_outside_easy", tier: "easy", text: "Place 6 outside bets", target: 6, type: "outsideBets", reward: { tokens: 35, gems: 3 } },
  { id: "mission_high_med", tier: "medium", text: "Bet 5 times in High-Risk mode", target: 5, type: "highRiskSpins", reward: { xp: 70, gems: 5 } },
  { id: "mission_inside_med", tier: "medium", text: "Play 6 inside bets", target: 6, type: "insideBets", reward: { tokens: 70, xp: 55 } },
  { id: "mission_profit_hard", tier: "hard", text: "Finish 4 spins with positive net", target: 4, type: "positiveSpins", reward: { tokens: 90, gems: 6, xp: 70 } },
  { id: "mission_streak_hard", tier: "hard", text: "Reach win streak 4", target: 4, type: "bestWinStreak", reward: { tokens: 100, gems: 8, xp: 80 } }
];

const ACHIEVEMENTS = [
  { id: "ach_first_win", text: "First Win", check: (s) => s.wins >= 1, reward: { tokens: 25, xp: 25 } },
  { id: "ach_big_win", text: "Big Win (+200 net in one spin)", check: (s) => s.meta.biggestSingleNet >= 200, reward: { gems: 8, xp: 40 } },
  { id: "ach_hot_streak", text: "Reach 5-win streak", check: (s) => s.bestWinStreak >= 5, reward: { tokens: 80, gems: 6 } },
  { id: "ach_grinder", text: "Play 50 spins", check: (s) => s.spins >= 50, reward: { tokens: 120, xp: 100 } },
  { id: "ach_collector", text: "Unlock 3 cosmetics", check: (s) => Object.keys(s.cosmetics.unlocked).length >= 3, reward: { gems: 10, xp: 80 } }
];

const SHOP_ITEMS = {
  "theme:neon": { category: "theme", id: "neon", label: "Neon Theme", cost: 15 },
  "theme:classic": { category: "theme", id: "classic", label: "Classic Theme", cost: 12 },
  "wheel:gold": { category: "wheel", id: "gold", label: "Gold Wheel", cost: 20 },
  "trail:spark": { category: "trail", id: "spark", label: "Spark Trail", cost: 10 }
};

const EVENTS = [
  { id: "standard", label: "Standard Session", missionRewardBoost: 1 },
  { id: "fortune", label: "Fortune Friday", missionRewardBoost: 1.2 },
  { id: "rush", label: "Spin Rush", missionRewardBoost: 1.1 }
];

const DEFAULT_STATE = {
  tokens: 100,
  gems: 0,
  riskTokens: 1,
  xp: 0,
  level: 1,
  seasonXp: 0,
  seasonLevel: 1,
  prestige: 0,

  spins: 0,
  wins: 0,
  losses: 0,
  totalWagered: 0,
  biggestWin: 0,
  netProfit: 0,
  currentStreak: 0,
  bestWinStreak: 0,
  worstLosingStreak: 0,
  rollCounts: Array.from({ length: MAX_ROULETTE_POCKETS }, () => 0),
  colorStats: { red: 0, black: 0, even: 0, odd: 0 },
  drawdown: 0,
  peakTokens: 100,
  bankrollCurve: [100],
  modePerformance: {},

  upgrades: {
    offense: 0,
    economy: 0,
    safety: 0
  },
  costs: {
    offense: 200,
    economy: 180,
    safety: 150
  },

  mode: "classic",
  tableVariant: "european",
  frenchRule: "laPartage",
  tableLimits: { min: 5, max: 500 },
  noMoreBetsMs: 1200,
  noMoreBetsUntil: 0,
  dealer: { speed: "normal", ballReleaseMs: 250, signature: false },
  powerChoice: "none",
  currentModifier: null,
  currentEvent: "standard",
  currentView: DEFAULT_NAV_VIEW,
  reducedMotion: false,
  colorblindMode: false,
  highContrastMode: false,
  onboardingPath: "beginner",

  bets: [],
  betActions: [],
  lastClearedBets: [],
  spinning: false,
  wheelRotation: 0,
  history: [],
  leaderboard: [],
  savedPreset: [],
  strategyProfiles: { slot1: [], slot2: [], slot3: [] },
  autoBet: { enabled: false, system: "none", stopLoss: 150, takeProfit: 250, baseChip: 10, fibIndex: 0, dalembertStep: 0, lossStreak: 0 },
  tournament: { enabled: false, seed: "", started: false, bankroll: 300, prevTokens: null },
  ghost: { targetNet: 0 },
  analytics: { simulation: null, historyFilter: "all", leaderboardCategory: "profit" },
  enPrisonCredits: 0,

  missions: [],
  missionStats: {
    spins: 0,
    wins: 0,
    outsideBets: 0,
    highRiskSpins: 0,
    insideBets: 0,
    positiveSpins: 0,
    bestWinStreak: 0
  },
  missionRerollsUsed: 0,
  missionsCompleted: 0,
  achievementsUnlocked: {},

  daily: {
    lastLogin: null,
    streak: 0,
    dayKey: null,
    completed: false,
    progress: { winOnBlack: 0, outsideBets: 0 }
  },
  weekly: {
    weekKey: null,
    completed: false,
    progress: { spins: 0, netPositiveSpins: 0 }
  },

  cosmetics: {
    unlocked: {},
    equipped: { theme: "default", wheel: "default", trail: "default" }
  },

  meta: {
    biggestSingleNet: 0,
    challengeSeed: "",
    rngState: 0,
    tutorialSeen: false,
    lastTip: "",
    milestonesClaimed: 0,
    seasonTrackClaimed: 0
  }
};

const elements = {
  tokens: byId("tokens"), gems: byId("gems"), riskTokens: byId("riskTokens"),
  level: byId("level"), xp: byId("xp"), xpToNext: byId("xpToNext"),
  seasonLevel: byId("seasonLevel"), seasonXp: byId("seasonXp"), prestige: byId("prestige"),
  activeModifier: byId("activeModifier"), activeEvent: byId("activeEvent"), eventBanner: byId("eventBanner"),

  spins: byId("spins"), wins: byId("wins"), losses: byId("losses"), winRate: byId("winRate"),
  netProfit: byId("netProfit"), totalWagered: byId("totalWagered"), biggestWin: byId("biggestWin"),
  currentStreak: byId("currentStreak"), bestWinStreak: byId("bestWinStreak"), worstLosingStreak: byId("worstLosingStreak"),
  hotNumber: byId("hotNumber"), redRolls: byId("redRolls"), blackRolls: byId("blackRolls"), evenRolls: byId("evenRolls"), oddRolls: byId("oddRolls"),

  totalBet: byId("totalBet"), activeBets: byId("activeBets"), betList: byId("betList"), history: byId("history"),
  chipAmount: byId("chipAmount"), modeSelect: byId("modeSelect"), powerChoice: byId("powerChoice"), seedInput: byId("seedInput"),
  useRiskToken: byId("useRiskToken"), colorblindMode: byId("colorblindMode"), reducedMotion: byId("reducedMotion"),
  tableVariant: byId("tableVariant"), frenchRule: byId("frenchRule"), tableMin: byId("tableMin"), tableMax: byId("tableMax"), noMoreBetsMs: byId("noMoreBetsMs"), noMoreBetsStatus: byId("noMoreBetsStatus"),
  dealerSpeed: byId("dealerSpeed"), ballReleaseMs: byId("ballReleaseMs"), dealerSignature: byId("dealerSignature"), highContrastMode: byId("highContrastMode"), onboardingPath: byId("onboardingPath"), houseEdge: byId("houseEdge"), hintText: byId("hintText"),
  insideBetType: byId("insideBetType"), insideBetNumbers: byId("insideBetNumbers"), addInsideBet: byId("addInsideBet"),
  neighborNumber: byId("neighborNumber"), neighborSpan: byId("neighborSpan"), addNeighbors: byId("addNeighbors"),
  finaleDigit: byId("finaleDigit"), addFinale: byId("addFinale"), callBundle: byId("callBundle"), addCallBundle: byId("addCallBundle"),
  strategySlot: byId("strategySlot"), saveStrategy: byId("saveStrategy"), loadStrategy: byId("loadStrategy"), rerollMissions: byId("rerollMissions"), rebet: byId("rebet"),
  autoBetSystem: byId("autoBetSystem"), autoBetStopLoss: byId("autoBetStopLoss"), autoBetTakeProfit: byId("autoBetTakeProfit"), autoBetEnabled: byId("autoBetEnabled"),
  halveBets: byId("halveBets"), doubleBets: byId("doubleBets"),

  spinButton: byId("spinButton"), undoBet: byId("undoBet"), clearBets: byId("clearBets"), savePreset: byId("savePreset"), loadPreset: byId("loadPreset"),
  submitRun: byId("submitRun"), shareSummary: byId("shareSummary"), prestigeButton: byId("prestigeButton"), shareReplay: byId("shareReplay"), setGhostTarget: byId("setGhostTarget"),

  result: byId("result"), spinBreakdown: byId("spinBreakdown"), leaderboardList: byId("leaderboardList"),
  missionList: byId("missionList"), challengeList: byId("challengeList"), achievementList: byId("achievementList"),
  nextMilestone: byId("nextMilestone"), missionsCompleted: byId("missionsCompleted"), achievementCount: byId("achievementCount"), dailyStreak: byId("dailyStreak"),
  historyFilter: byId("historyFilter"), leaderboardCategory: byId("leaderboardCategory"), tournamentMode: byId("tournamentMode"), tournamentSeed: byId("tournamentSeed"),
  distributionSummary: byId("distributionSummary"), ghostSummary: byId("ghostSummary"),
  evPerSpin: byId("evPerSpin"), volatility: byId("volatility"), drawdown: byId("drawdown"), bestMode: byId("bestMode"),
  simSpins: byId("simSpins"), runSimulation: byId("runSimulation"), simulationResult: byId("simulationResult"),
  seedBrowser: byId("seedBrowser"), applySeedBrowser: byId("applySeedBrowser"), bankrollCurve: byId("bankrollCurve"),

  offenseLevel: byId("offenseLevel"), economyLevel: byId("economyLevel"), safetyLevel: byId("safetyLevel"),
  offenseCost: byId("offenseCost"), economyCost: byId("economyCost"), safetyCost: byId("safetyCost"),
  buyOffense: byId("buyOffense"), buyEconomy: byId("buyEconomy"), buySafety: byId("buySafety"),

  equippedTheme: byId("equippedTheme"), equippedWheel: byId("equippedWheel"), equippedTrail: byId("equippedTrail"),

  wheelTrack: byId("wheelTrack"), wheelNumber: byId("wheelNumber"), numberBoard: byId("numberBoard"), doubleZeroSpot: byId("doubleZeroSpot"),

  tutorialDialog: byId("tutorialDialog"), openTutorial: byId("openTutorial"), closeTutorial: byId("closeTutorial"),
  viewPanels: Array.from(document.querySelectorAll("[data-view-panel]")),
  viewButtons: Array.from(document.querySelectorAll("[data-view-button]"))
};

let state = mergeDeep(structuredClone(DEFAULT_STATE), loadState());

function byId(id) {
  return document.getElementById(id);
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function hasUnsafeOwnKeys(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  for (const [key, value] of Object.entries(obj)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") return true;
    if (hasUnsafeOwnKeys(value)) return true;
  }
  return false;
}

function mergeDeep(base, patch) {
  if (!patch || typeof patch !== "object") return base;
  for (const [key, value] of Object.entries(patch)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    if (hasUnsafeOwnKeys(value)) continue;
    if (value && typeof value === "object" && !Array.isArray(value) && Object.hasOwn(base, key)) {
      base[key] = mergeDeep(base[key], value);
    } else if (Object.hasOwn(base, key)) {
      base[key] = value;
    }
  }
  return base;
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function getNumberColor(number) {
  if (number === 0 || number === DOUBLE_ZERO_NUMBER) return "green";
  return redNumbers.has(number) ? "red" : "black";
}

function currentTable() {
  return TABLE_VARIANTS[state.tableVariant] || TABLE_VARIANTS.european;
}

function currentSequence() {
  return currentTable().sequence;
}

function currentPocketCount() {
  return currentSequence().length;
}

function numberLabel(number) {
  return number === DOUBLE_ZERO_NUMBER ? "00" : String(number);
}

function houseEdgeText() {
  const t = currentTable();
  if (state.tableVariant === "french" && state.frenchRule === "laPartage") return "1.35% (La Partage)";
  if (state.tableVariant === "french" && state.frenchRule === "enPrison") return "1.35% (En Prison approx)";
  return `${t.houseEdge.toFixed(2)}%`;
}

function totalBetAmount() {
  return state.bets.reduce((sum, bet) => sum + bet.amount, 0);
}

function getHotNumber() {
  let max = 0;
  let idx = "-";
  state.rollCounts.forEach((count, number) => {
    if (count > max) {
      max = count;
      idx = String(number);
    }
  });
  return idx;
}

function xpForNextLevel(level) {
  return 100 + (level - 1) * 45;
}

function addXp(amount) {
  state.xp += amount;
  while (state.xp >= xpForNextLevel(state.level)) {
    state.xp -= xpForNextLevel(state.level);
    state.level += 1;
    state.tokens += 30;
    addHistoryText(`Level up! You reached level ${state.level} (+30 tokens).`);
  }
}

function addSeasonXp(amount) {
  state.seasonXp += amount;
  while (state.seasonXp >= 120) {
    state.seasonXp -= 120;
    state.seasonLevel += 1;
    state.gems += 2;
    addHistoryText(`Season level ${state.seasonLevel} reached (+2 gems).`);
  }
}

function giveRewards(reward, source = "reward") {
  if (!reward) return;
  const boost = state.currentEvent === "fortune" ? 1.2 : state.currentEvent === "rush" ? 1.1 : 1;
  const tokens = Math.round((reward.tokens || 0) * boost);
  const gems = reward.gems || 0;
  const xp = reward.xp || 0;
  const riskTokens = reward.riskTokens || 0;

  state.tokens += tokens;
  state.gems += gems;
  state.riskTokens += riskTokens;
  addXp(xp);
  addSeasonXp(Math.ceil(xp / 2));

  const bits = [];
  if (tokens) bits.push(`${tokens} tokens`);
  if (gems) bits.push(`${gems} gems`);
  if (xp) bits.push(`${xp} xp`);
  if (riskTokens) bits.push(`${riskTokens} risk token`);
  if (bits.length) addHistoryText(`${source}: +${bits.join(", +")}`);
}

function addHistoryText(text) {
  state.history.unshift({ type: "text", text });
  if (state.history.length > MAX_HISTORY_ITEMS) state.history.length = MAX_HISTORY_ITEMS;
}

function addHistorySpin(entry) {
  state.history.unshift({ type: "spin", ...entry });
  if (state.history.length > MAX_HISTORY_ITEMS) state.history.length = MAX_HISTORY_ITEMS;
}

function buildWheel() {
  elements.wheelTrack.textContent = "";
  const sequence = currentSequence();
  const pocketAngle = 360 / sequence.length;
  const colorStops = [];

  sequence.forEach((number, index) => {
    const start = index * pocketAngle;
    const end = (index + 1) * pocketAngle;
    const pocketColor = getNumberColor(number);
    const fill = pocketColor === "red" ? "#7f1d1d" : pocketColor === "black" ? "#020617" : "#14532d";
    colorStops.push(`${fill} ${start}deg ${end}deg`);

    const pocket = document.createElement("div");
    pocket.className = `wheel-pocket ${pocketColor}`;
    pocket.dataset.number = String(number);
    pocket.style.setProperty("--angle", `${index * pocketAngle}deg`);
    pocket.textContent = numberLabel(number);
    elements.wheelTrack.append(pocket);
  });

  elements.wheelTrack.style.background = `conic-gradient(from 0deg, ${colorStops.join(",")})`;
}

function buildNumberBoard() {
  elements.numberBoard.textContent = "";
  for (let row = 1; row <= 12; row += 1) {
    const high = row * 3;
    const numbers = [high, high - 1, high - 2];
    numbers.forEach((n) => {
      const button = document.createElement("button");
      button.className = `bet-spot ${redNumbers.has(n) ? "red" : "black"}`;
      button.dataset.betKey = `number:${n}`;
      button.dataset.label = String(n);
      button.textContent = String(n);
      elements.numberBoard.append(button);
    });
  }
  if (elements.doubleZeroSpot) {
    const showDoubleZero = currentTable().hasDoubleZero;
    elements.doubleZeroSpot.hidden = !showDoubleZero;
  }
}

function ensureMissions() {
  if (state.missions.length) return;
  const easy = MISSION_POOL.filter((m) => m.tier === "easy");
  const medium = MISSION_POOL.filter((m) => m.tier === "medium");
  const hard = MISSION_POOL.filter((m) => m.tier === "hard");
  const picks = [
    easy[Math.floor(Math.random() * easy.length)],
    medium[Math.floor(Math.random() * medium.length)],
    hard[Math.floor(Math.random() * hard.length)]
  ];
  state.missions = picks.map((m) => ({ ...m, progress: 0, done: false }));
}

function rerollMissions() {
  if (state.missionRerollsUsed >= 2) {
    setResult("Mission reroll limit reached for this run.", false);
    return;
  }
  state.missions = [];
  state.missionStats = { spins: 0, wins: 0, outsideBets: 0, highRiskSpins: 0, insideBets: 0, positiveSpins: 0, bestWinStreak: state.bestWinStreak };
  state.missionRerollsUsed += 1;
  ensureMissions();
  addHistoryText(`Missions rerolled (${state.missionRerollsUsed}/2).`);
  updateProgress();
}

function resetRunKeepMeta() {
  const keep = {
    gems: state.gems,
    level: state.level,
    xp: state.xp,
    seasonLevel: state.seasonLevel,
    seasonXp: state.seasonXp,
    prestige: state.prestige,
    achievementsUnlocked: state.achievementsUnlocked,
    cosmetics: state.cosmetics,
    leaderboard: state.leaderboard,
    tableVariant: state.tableVariant,
    frenchRule: state.frenchRule,
    tableLimits: state.tableLimits,
    noMoreBetsMs: state.noMoreBetsMs,
    dealer: state.dealer,
    highContrastMode: state.highContrastMode,
    onboardingPath: state.onboardingPath,
    strategyProfiles: state.strategyProfiles,
    tournament: state.tournament,
    analytics: state.analytics,
    ghost: state.ghost,
    daily: state.daily,
    weekly: state.weekly,
    meta: state.meta
  };

  state = mergeDeep(structuredClone(DEFAULT_STATE), keep);
  state.tokens = 100 + state.prestige * 10;
  ensureMissions();
}

function updateDailyLogin() {
  if (state.daily.lastLogin === DAILY_DATE_KEY) return;
  const prev = state.daily.lastLogin;
  const currentDate = new Date(`${DAILY_DATE_KEY}T00:00:00Z`);
  let streak = 1;

  if (prev) {
    const prevDate = new Date(`${prev}T00:00:00Z`);
    const diffDays = Math.floor((currentDate - prevDate) / (1000 * 60 * 60 * 24));
    streak = diffDays === 1 ? state.daily.streak + 1 : 1;
  }

  state.daily.streak = streak;
  state.daily.lastLogin = DAILY_DATE_KEY;
  state.daily.dayKey = DAILY_DATE_KEY;
  state.daily.completed = false;
  state.daily.progress = { winOnBlack: 0, outsideBets: 0 };
  const reward = 20 + Math.min(5 * streak, 60);
  state.tokens += reward;
  state.gems += streak % 3 === 0 ? 1 : 0;
  addHistoryText(`Daily login streak ${streak}: +${reward} tokens${streak % 3 === 0 ? " and +1 gem" : ""}.`);
}

function updateWeeklyReset() {
  if (state.weekly.weekKey === WEEK_KEY) return;
  state.weekly.weekKey = WEEK_KEY;
  state.weekly.completed = false;
  state.weekly.progress = { spins: 0, netPositiveSpins: 0 };
  addHistoryText("Weekly challenges reset.");
}

function nextModifier() {
  const eventBoost = state.currentEvent === "fortune" ? 0.25 : state.currentEvent === "rush" ? 0.2 : 0.15;
  if (state.mode !== "chaos") {
    state.currentModifier = Math.random() < eventBoost ? MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)].key : null;
    return;
  }
  state.currentModifier = MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)].key;
}

function modifierDef() {
  return MODIFIERS.find((m) => m.key === state.currentModifier) || null;
}

function setWinningPocket(number) {
  elements.wheelTrack.querySelectorAll(".wheel-pocket.winner").forEach((el) => el.classList.remove("winner"));
  if (typeof number !== "number") return;
  const winner = elements.wheelTrack.querySelector(`.wheel-pocket[data-number="${number}"]`);
  if (winner) winner.classList.add("winner");
}

function updateWheelNumber(number) {
  const color = getNumberColor(number);
  elements.wheelNumber.textContent = numberLabel(number);
  elements.wheelNumber.className = `wheel-number ${color}`;
}

function normalizeAngle(angle) {
  return ((angle % 360) + 360) % 360;
}

function animateRoll(finalNumber) {
  return new Promise((resolve) => {
    state.spinning = true;
    setWinningPocket(null);

    const modeDuration = MODE_CONFIG[state.mode].durationMultiplier;
    const dealerSpeedMult = state.dealer.speed === "fast" ? 0.75 : state.dealer.speed === "slow" ? 1.25 : 1;
    const signatureVariance = state.dealer.signature ? (0.9 + getRandomValue() * 0.25) : 1;
    const duration = state.reducedMotion ? 150 : Math.max(350, Math.round(SPIN_TRANSITION_DURATION_MS * modeDuration * dealerSpeedMult * signatureVariance));

    const seq = currentSequence();
    const pocketAngle = 360 / seq.length;
    const index = seq.indexOf(finalNumber);
    const desiredRotation = normalizeAngle(-index * pocketAngle);
    const currentRotation = normalizeAngle(state.wheelRotation);

    let delta = desiredRotation - currentRotation;
    if (delta < 0) delta += 360;

    const releaseRotBoost = state.dealer.signature ? Math.floor(getRandomValue() * 2) : 0;
    state.wheelRotation += 360 * (state.reducedMotion ? 1 : SPIN_FULL_ROTATIONS + releaseRotBoost) + delta;
    elements.wheelTrack.style.transition = `transform ${duration}ms cubic-bezier(0.12,0.76,0.16,1)`;

    requestAnimationFrame(() => {
      elements.wheelTrack.style.transform = `rotate(${state.wheelRotation}deg)`;
      updateWheelNumber(finalNumber);
    });

    const done = () => {
      setWinningPocket(finalNumber);
      state.spinning = false;
      resolve();
    };

    if (state.reducedMotion) {
      setTimeout(done, duration + 10);
      return;
    }

    const timeout = setTimeout(done, duration + 250);
    elements.wheelTrack.addEventListener("transitionend", () => {
      clearTimeout(timeout);
      done();
    }, { once: true });
  });
}

function getRandomValue() {
  if (!state.meta.challengeSeed) return Math.random();
  if (!state.meta.rngState) {
    let seed = 0;
    for (const char of state.meta.challengeSeed) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
    state.meta.rngState = seed || 123456789;
  }
  state.meta.rngState = (1664525 * state.meta.rngState + 1013904223) >>> 0;
  return state.meta.rngState / 4294967296;
}

function payoutRatioFor(key) {
  if (key.startsWith("number:")) return 35;
  if (key.startsWith("split:")) return 17;
  if (key.startsWith("street:")) return 11;
  if (key.startsWith("corner:")) return 8;
  if (key.startsWith("sixline:")) return 5;
  if (key.startsWith("neighbor:")) return 35;
  if (key.startsWith("finale:")) return 9;
  if (key.startsWith("call:")) return 35;
  if (key.startsWith("dozen:") || key.startsWith("column:")) return 2;
  if (key.startsWith("combo:")) return 3;
  if (key.startsWith("streak:")) return 2;
  return 1;
}

function evaluateBet(key, rolled, spinWonAny) {
  if (key.startsWith("number:")) return rolled === Number(key.split(":")[1]);
  if (key.startsWith("split:") || key.startsWith("street:") || key.startsWith("corner:") || key.startsWith("sixline:") || key.startsWith("neighbor:") || key.startsWith("finale:") || key.startsWith("call:")) {
    const nums = key.split(":")[1].split(",").map((n) => Number(n));
    return nums.includes(rolled);
  }
  if ((rolled === 0 || rolled === DOUBLE_ZERO_NUMBER) && !key.startsWith("streak:")) return false;

  if (key === "red") return redNumbers.has(rolled);
  if (key === "black") return !redNumbers.has(rolled);
  if (key === "even") return rolled % 2 === 0;
  if (key === "odd") return rolled % 2 === 1;
  if (key === "low") return rolled >= 1 && rolled <= 18;
  if (key === "high") return rolled >= 19 && rolled <= 36;

  if (key.startsWith("dozen:")) {
    const dozen = Number(key.split(":")[1]);
    return rolled >= (dozen - 1) * 12 + 1 && rolled <= dozen * 12;
  }

  if (key.startsWith("column:")) {
    const column = Number(key.split(":")[1]);
    return ((rolled - 1) % 3) + 1 === column;
  }

  if (key === "combo:redOdd") return redNumbers.has(rolled) && rolled % 2 === 1;
  if (key === "combo:blackEven") return !redNumbers.has(rolled) && rolled !== 0 && rolled % 2 === 0;

  if (key === "streak:win") return spinWonAny;
  if (key === "streak:loss") return !spinWonAny;

  return false;
}

function parseNumbersInput(raw) {
  return raw.split(",").map((n) => Number(n.trim())).filter(isValidNumberForCurrentTable);
}

function isValidNumberForCurrentTable(n) {
  return Number.isInteger(n) && n >= 0 && n <= DOUBLE_ZERO_NUMBER && (n !== DOUBLE_ZERO_NUMBER || currentTable().hasDoubleZero);
}

function addInsideBetFromBuilder() {
  const type = elements.insideBetType.value;
  const nums = Array.from(new Set(parseNumbersInput(elements.insideBetNumbers.value || "")));
  const validLen = (type === "split" && nums.length === 2)
    || (type === "street" && nums.length === 3)
    || (type === "corner" && nums.length === 4)
    || (type === "sixline" && nums.length === 6);
  if (!validLen) {
    setResult("Inside bet requires exactly 2/3/4/6 unique numbers.", false);
    return;
  }
  addBet(`${type}:${nums.join(",")}`, `${capitalize(type)} (${nums.map(numberLabel).join(", ")})`);
}

function addNeighborsBet() {
  const center = Number(elements.neighborNumber.value);
  const span = Math.max(1, Math.min(4, Number(elements.neighborSpan.value) || 2));
  const seq = currentSequence();
  const index = seq.indexOf(center);
  if (index < 0) {
    setResult("Neighbor center is invalid for current table variant.", false);
    return;
  }
  const nums = [];
  for (let i = -span; i <= span; i += 1) nums.push(seq[(index + i + seq.length) % seq.length]);
  const uniq = Array.from(new Set(nums));
  addBet(`neighbor:${uniq.join(",")}`, `Neighbors ${numberLabel(center)} ±${span}`);
}

function addFinaleBet() {
  const digit = Math.max(0, Math.min(9, Number(elements.finaleDigit.value) || 0));
  const pool = currentSequence().filter((n) => n !== DOUBLE_ZERO_NUMBER && n % 10 === digit);
  if (!pool.length) return;
  addBet(`finale:${pool.join(",")}`, `Finale ${digit}`);
}

function addCallBundle() {
  const key = elements.callBundle.value;
  const bundle = FRENCH_CALL_BUNDLES[key];
  if (!bundle?.length) return;
  addBet(`call:${bundle.join(",")}`, `Call ${capitalize(key)}`);
}

function rebetLast() {
  if (!state.lastClearedBets.length) {
    setResult("No previous table to rebet.", false);
    return;
  }
  state.bets = state.lastClearedBets.map((b) => ({ ...b }));
  addHistoryText("Rebet applied from last cleared table.");
  updateProgress();
}

function addBet(key, label) {
  const chip = parseInt(elements.chipAmount.value, 10);
  if (!Number.isInteger(chip) || chip <= 0) {
    setResult("Enter a valid positive chip amount.", false);
    return;
  }

  const existing = state.bets.find((bet) => bet.key === key);
  if (existing) existing.amount += chip;
  else state.bets.push({ key, label, amount: chip });

  state.betActions.push({ key, amount: chip });
  if (["red", "black", "even", "odd", "low", "high"].includes(key)) state.missionStats.outsideBets += 1;
  if (key.startsWith("split:") || key.startsWith("street:") || key.startsWith("corner:") || key.startsWith("sixline:")) state.missionStats.insideBets += 1;
  updateProgress();
  setResult(`Placed ${chip} on ${label}.`, true, true);
}

function undoBet() {
  const last = state.betActions.pop();
  if (!last) return;
  const entry = state.bets.find((bet) => bet.key === last.key);
  if (!entry) return;
  entry.amount -= last.amount;
  if (entry.amount <= 0) state.bets = state.bets.filter((bet) => bet.key !== last.key);
  updateProgress();
}

function clearBets() {
  state.lastClearedBets = state.bets.map((b) => ({ ...b }));
  state.bets = [];
  state.betActions = [];
  updateProgress();
}

function scaleBets(multiplier) {
  if (!state.bets.length) return;
  state.bets = state.bets.map((bet) => ({ ...bet, amount: Math.max(1, Math.round(bet.amount * multiplier)) }));
  addHistoryText(multiplier > 1 ? "Doubled active bets." : "Halved active bets.");
  updateProgress();
}

function setResult(text, positive, silent) {
  elements.result.textContent = text;
  elements.result.className = positive ? "result-win" : "result-loss";
  if (!silent) addHistoryText(text);
}

function applyRollStats(rolled) {
  state.rollCounts[rolled] += 1;
  if (rolled !== 0 && rolled !== DOUBLE_ZERO_NUMBER) {
    if (redNumbers.has(rolled)) state.colorStats.red += 1;
    else state.colorStats.black += 1;
    if (rolled % 2 === 0) state.colorStats.even += 1;
    else state.colorStats.odd += 1;
  }
}

function applyMissionsAndChallenges({ wonAny, rolled, netChange }) {
  state.missionStats.spins += 1;
  if (wonAny) state.missionStats.wins += 1;
  if (state.mode === "highRisk") state.missionStats.highRiskSpins += 1;
  if (netChange > 0) state.missionStats.positiveSpins += 1;
  state.missionStats.bestWinStreak = Math.max(state.missionStats.bestWinStreak, state.bestWinStreak);

  state.missions.forEach((mission) => {
    if (mission.done) return;
    mission.progress = Math.min(mission.target, state.missionStats[mission.type] || 0);
    if (mission.progress >= mission.target) {
      mission.done = true;
      state.missionsCompleted += 1;
      giveRewards(mission.reward, `Mission complete: ${mission.text}`);
    }
  });

  if (state.daily.dayKey !== DAILY_DATE_KEY) {
    state.daily.dayKey = DAILY_DATE_KEY;
    state.daily.progress = { winOnBlack: 0, outsideBets: 0 };
    state.daily.completed = false;
  }

  if (!state.daily.completed) {
    if (wonAny && !redNumbers.has(rolled) && rolled !== 0 && rolled !== DOUBLE_ZERO_NUMBER) state.daily.progress.winOnBlack += 1;
    state.daily.progress.outsideBets += state.bets.filter((b) => ["red", "black", "even", "odd", "low", "high"].includes(b.key)).length;
    if (state.daily.progress.winOnBlack >= 3 && state.daily.progress.outsideBets >= 5) {
      state.daily.completed = true;
      giveRewards({ tokens: 100, gems: 4, xp: 60 }, "Daily challenge complete");
    }
  }

  if (!state.weekly.completed) {
    state.weekly.progress.spins += 1;
    if (netChange > 0) state.weekly.progress.netPositiveSpins += 1;
    if (state.weekly.progress.spins >= 30 && state.weekly.progress.netPositiveSpins >= 12) {
      state.weekly.completed = true;
      giveRewards({ tokens: 250, gems: 10, xp: 120, riskTokens: 1 }, "Weekly challenge complete");
    }
  }
}

function applySeasonTrackRewards() {
  const checkpoints = [2, 4, 7, 10, 14, 18];
  while (state.meta.seasonTrackClaimed < checkpoints.length && state.seasonLevel >= checkpoints[state.meta.seasonTrackClaimed]) {
    state.meta.seasonTrackClaimed += 1;
    const idx = state.meta.seasonTrackClaimed;
    giveRewards({ tokens: 40 + idx * 15, gems: idx % 2 === 0 ? 2 : 1, xp: 20 + idx * 5 }, `Season track tier ${idx}`);
    if (idx === 4) state.currentModifier = "jackpotNumbers";
  }
}

function checkAchievements() {
  ACHIEVEMENTS.forEach((achievement) => {
    if (state.achievementsUnlocked[achievement.id]) return;
    if (achievement.check(state)) {
      state.achievementsUnlocked[achievement.id] = true;
      giveRewards(achievement.reward, `Achievement unlocked: ${achievement.text}`);
    }
  });
}

function applyMilestoneRewards() {
  const milestoneStep = 10;
  const reached = Math.floor(state.spins / milestoneStep);
  while (state.meta.milestonesClaimed < reached) {
    state.meta.milestonesClaimed += 1;
    const reward = {
      tokens: 45 + state.meta.milestonesClaimed * 5,
      gems: state.meta.milestonesClaimed % 2 === 0 ? 2 : 1,
      xp: 25
    };
    if (state.meta.milestonesClaimed % 3 === 0) reward.riskTokens = 1;
    giveRewards(reward, `Milestone ${state.meta.milestonesClaimed * milestoneStep} spins`);
  }
}

function preSpinPowerAdjust(ctx) {
  if (state.powerChoice === "focus") {
    ctx.profitBoost *= 1.15;
    ctx.stipendMultiplier *= 0.4;
  }
  if (state.powerChoice === "shield") {
    ctx.shield = 0.5;
  }
  if (state.powerChoice === "surge") {
    ctx.xpBoost += 20;
  }
}

function getNearMissMessage(rolled) {
  const straightNumbers = state.bets.filter((b) => b.key.startsWith("number:")).map((b) => Number(b.key.split(":")[1]));
  if (!straightNumbers.length) return "";
  const near = straightNumbers.some((n) => Math.abs(n - rolled) === 1);
  return near ? "Near miss on straight number bet!" : "";
}

async function spinRoulette() {
  if (state.spinning) return;
  if (Date.now() < state.noMoreBetsUntil) {
    setResult("No more bets. Wait for the next round.", false);
    return;
  }
  if (state.bets.length === 0) {
    setResult("Place at least one bet on the board.", false);
    return;
  }

  const tableAmount = totalBetAmount();
  if (tableAmount < state.tableLimits.min) {
    setResult(`Table minimum is ${state.tableLimits.min}.`, false);
    return;
  }
  if (tableAmount > state.tableLimits.max) {
    setResult(`Table maximum is ${state.tableLimits.max}.`, false);
    return;
  }
  if (tableAmount > state.tokens) {
    setResult("Not enough tokens for that table.", false);
    return;
  }

  const useRisk = elements.useRiskToken.checked && state.riskTokens > 0;
  if (elements.useRiskToken.checked && state.riskTokens <= 0) {
    setResult("No risk tokens available.", false);
    return;
  }

  nextModifier();
  state.noMoreBetsUntil = Date.now() + Math.max(0, state.noMoreBetsMs);

  const tokensBeforeSpin = state.tokens;
  state.tokens -= tableAmount;
  state.totalWagered += tableAmount;

  if (state.dealer.ballReleaseMs > 0 && !state.reducedMotion) await new Promise((r) => setTimeout(r, state.dealer.ballReleaseMs));
  const seq = currentSequence();
  const rolled = seq[Math.floor(getRandomValue() * seq.length)];
  await animateRoll(rolled);

  const mode = MODE_CONFIG[state.mode];
  const mod = modifierDef();

  let grossPayout = 0;
  let losingStake = 0;
  let wonAny = false;

  const ctx = {
    profitBoost: 1 + state.upgrades.offense * 0.1 + state.prestige * 0.04,
    stipendMultiplier: 1 + state.upgrades.economy * 0.2,
    insuranceMultiplier: 1 + state.upgrades.safety * 0.1,
    shield: 0,
    xpBoost: 0,
    stipendFlat: 0
  };

  preSpinPowerAdjust(ctx);
  if (mod?.after) mod.after(ctx);

  const nonStreakBets = state.bets.filter((b) => !b.key.startsWith("streak:"));
  for (const bet of nonStreakBets) {
    const won = evaluateBet(bet.key, rolled, false);
    if (won) {
      wonAny = true;
    }
  }

  for (const bet of state.bets) {
    const won = evaluateBet(bet.key, rolled, wonAny);
    if (won) {
      const ratio = payoutRatioFor(bet.key);
      let profitMultiplier = ctx.profitBoost * mode.payoutMultiplier;
      if (mod?.apply) {
        const mut = { bet, profitMultiplier };
        mod.apply(mut);
        profitMultiplier = mut.profitMultiplier;
      }
      const profit = Math.round(bet.amount * ratio * profitMultiplier);
      grossPayout += bet.amount + profit;
    } else {
      if (state.tableVariant === "french" && rolled === 0 && EVEN_MONEY_KEYS.has(bet.key)) {
        if (state.frenchRule === "laPartage") {
          const rescue = Math.round(bet.amount / 2);
          grossPayout += rescue;
        } else {
          state.enPrisonCredits += bet.amount;
          addHistoryText(`En Prison: ${bet.amount} held for next spin resolution.`);
          continue;
        }
      }
      losingStake += bet.amount;
    }
  }

  let insuranceRefund = Math.round(losingStake * 0.1 * ctx.insuranceMultiplier * mode.insuranceMultiplier);
  if (ctx.shield > 0) insuranceRefund += Math.round(losingStake * ctx.shield);

  const stipendGain = Math.round((2 + state.upgrades.economy * 2) * ctx.stipendMultiplier) + ctx.stipendFlat;

  const baseTokensAfterSpin = state.tokens + grossPayout + insuranceRefund + stipendGain;
  let netChange = baseTokensAfterSpin - tokensBeforeSpin;
  const streakBonus = state.currentStreak >= 2 ? Math.round(Math.max(0, netChange) * 0.06) : 0;
  const comebackBonus = state.currentStreak <= -3 && netChange > 0 ? Math.round(netChange * 0.08) : 0;
  netChange += streakBonus + comebackBonus;
  if (useRisk) {
    state.riskTokens -= 1;
    netChange *= 2;
  }
  state.tokens = tokensBeforeSpin + netChange;

  if (state.tableVariant === "french" && state.frenchRule === "enPrison" && state.enPrisonCredits > 0 && rolled !== 0) {
    const wonEvenMoney = state.bets.some((bet) => EVEN_MONEY_KEYS.has(bet.key) && evaluateBet(bet.key, rolled, wonAny));
    if (wonEvenMoney) {
      state.tokens += state.enPrisonCredits;
      netChange += state.enPrisonCredits;
      addHistoryText(`En Prison released: +${state.enPrisonCredits}.`);
    } else {
      addHistoryText(`En Prison forfeited: ${state.enPrisonCredits}.`);
    }
    state.enPrisonCredits = 0;
  }

  state.spins += 1;
  state.netProfit = state.tokens - (100 + state.prestige * 10);
  if (netChange > state.biggestWin) state.biggestWin = netChange;
  if (netChange > state.meta.biggestSingleNet) state.meta.biggestSingleNet = netChange;
  state.peakTokens = Math.max(state.peakTokens, state.tokens);
  state.drawdown = Math.max(state.drawdown, state.peakTokens - state.tokens);
  state.bankrollCurve.push(state.tokens);
  if (state.bankrollCurve.length > 180) state.bankrollCurve.shift();

  const color = getNumberColor(rolled);
  const colorLabel = capitalize(color);

  if (wonAny) {
    state.wins += 1;
    state.currentStreak = state.currentStreak >= 0 ? state.currentStreak + 1 : 1;
    state.bestWinStreak = Math.max(state.bestWinStreak, state.currentStreak);
    setResult(`Roulette: ${numberLabel(rolled)} (${colorLabel}). Net ${netChange >= 0 ? `+${netChange}` : netChange}.`, true, true);
  } else {
    state.losses += 1;
    state.currentStreak = state.currentStreak <= 0 ? state.currentStreak - 1 : -1;
    state.worstLosingStreak = Math.min(state.worstLosingStreak, state.currentStreak);
    setResult(`Roulette: ${numberLabel(rolled)} (${colorLabel}). Net ${netChange}.`, false, true);
  }

  applyRollStats(rolled);

  const nearMiss = getNearMissMessage(rolled);
  const modeLabel = MODE_CONFIG[state.mode].label;
  elements.spinBreakdown.textContent = [
    `Mode ${modeLabel}`,
    mod ? `Modifier ${mod.label}` : "No modifier",
    `Payout ${grossPayout}`,
    `Insurance ${insuranceRefund}`,
    `Stipend ${stipendGain}`,
    streakBonus ? `Streak bonus +${streakBonus}` : "",
    comebackBonus ? `Comeback +${comebackBonus}` : "",
    useRisk ? "Risk token applied" : "No risk token",
    nearMiss
  ].filter(Boolean).join(" • ");

  addHistorySpin({
    won: wonAny,
    rolled,
    color,
    table: tableAmount,
    net: netChange,
    tokens: state.tokens,
    mode: modeLabel,
    modifier: mod?.label || "None"
  });

  const xpGain = 15 + (wonAny ? 10 : 5) + ctx.xpBoost;
  addXp(xpGain);
  addSeasonXp(Math.floor(xpGain / 2));

  state.modePerformance[state.mode] = state.modePerformance[state.mode] || { spins: 0, net: 0 };
  state.modePerformance[state.mode].spins += 1;
  state.modePerformance[state.mode].net += netChange;

  applyMissionsAndChallenges({ wonAny, rolled, netChange });
  applyMilestoneRewards();
  applySeasonTrackRewards();
  checkAchievements();

  if (netChange >= 180) {
    document.body.classList.add("celebrate");
    setTimeout(() => document.body.classList.remove("celebrate"), 700);
  }

  clearBets();
  applyAutoBet(netChange);
  updateProgress();
}

function buyUpgrade(type) {
  const cost = state.costs[type];
  if (state.tokens < cost || state.spinning) return;
  state.tokens -= cost;
  state.upgrades[type] += 1;
  state.costs[type] = Math.round(cost * UPGRADE_COST_MULTIPLIER);
  addHistoryText(`Bought ${type} upgrade (level ${state.upgrades[type]}).`);
  updateProgress();
}

function savePreset() {
  state.savedPreset = state.bets.map((b) => ({ ...b }));
  addHistoryText("Saved current bet preset.");
  updateProgress();
}

function loadPreset() {
  if (!state.savedPreset.length) {
    setResult("No preset saved yet.", false);
    return;
  }
  state.bets = state.savedPreset.map((b) => ({ ...b }));
  state.betActions = [];
  addHistoryText("Loaded bet preset.");
  updateProgress();
}

function saveStrategyProfile() {
  const slot = elements.strategySlot.value;
  state.strategyProfiles[slot] = state.bets.map((b) => ({ ...b }));
  addHistoryText(`Saved strategy ${slot}.`);
  updateProgress();
}

function loadStrategyProfile() {
  const slot = elements.strategySlot.value;
  const profile = state.strategyProfiles[slot] || [];
  if (!profile.length) {
    setResult("Strategy slot is empty.", false);
    return;
  }
  state.bets = profile.map((b) => ({ ...b }));
  state.betActions = [];
  addHistoryText(`Loaded strategy ${slot}.`);
  updateProgress();
}

function applyAutoBet(lastNet) {
  if (!state.autoBet.enabled || state.autoBet.system === "none") return;
  if (state.netProfit <= -Math.abs(state.autoBet.stopLoss)) {
    state.autoBet.enabled = false;
    addHistoryText("Auto-bet stopped by stop-loss.");
    return;
  }
  if (state.netProfit >= Math.abs(state.autoBet.takeProfit)) {
    state.autoBet.enabled = false;
    addHistoryText("Auto-bet stopped by take-profit.");
    return;
  }
  if (!state.lastClearedBets.length) return;
  state.autoBet.lossStreak = lastNet < 0 ? state.autoBet.lossStreak + 1 : 0;
  const fib = [1, 1, 2, 3, 5, 8, 13];
  if (state.autoBet.system === "fibonacci") {
    state.autoBet.fibIndex = lastNet < 0 ? Math.min(fib.length - 1, state.autoBet.fibIndex + 1) : Math.max(0, state.autoBet.fibIndex - 2);
  }
  if (state.autoBet.system === "dalembert") {
    state.autoBet.dalembertStep = lastNet < 0 ? state.autoBet.dalembertStep + 1 : Math.max(0, state.autoBet.dalembertStep - 1);
  }

  let mult = 1;
  if (state.autoBet.system === "martingale") mult = 2 ** Math.min(5, state.autoBet.lossStreak);
  if (state.autoBet.system === "fibonacci") mult = fib[state.autoBet.fibIndex];
  if (state.autoBet.system === "dalembert") mult = 1 + state.autoBet.dalembertStep;

  const next = state.lastClearedBets.map((b) => ({ ...b, amount: Math.max(1, Math.round(b.amount * mult)) }));
  const total = next.reduce((sum, b) => sum + b.amount, 0);
  if (total <= state.tokens && total <= state.tableLimits.max) {
    state.bets = next;
    addHistoryText(`Auto-bet prepared next table (${state.autoBet.system}, x${mult}).`);
  } else {
    state.autoBet.enabled = false;
    addHistoryText("Auto-bet disabled (next table exceeded bankroll/limit).");
  }
}

function buyShopItem(itemKey) {
  const item = SHOP_ITEMS[itemKey];
  if (!item) return;
  if (state.cosmetics.unlocked[itemKey]) {
    addHistoryText(`${item.label} already unlocked.`);
    return;
  }
  if (state.gems < item.cost) {
    setResult("Not enough gems.", false);
    return;
  }

  state.gems -= item.cost;
  state.cosmetics.unlocked[itemKey] = true;
  state.cosmetics.equipped[item.category] = item.id;
  addHistoryText(`Unlocked cosmetic: ${item.label}.`);
  updateProgress();
}

function updateCosmeticSelects() {
  const themeOptions = [{ value: "default", label: "Default" }];
  const wheelOptions = [{ value: "default", label: "Default" }];
  const trailOptions = [{ value: "default", label: "Default" }];

  Object.keys(state.cosmetics.unlocked).forEach((key) => {
    const item = SHOP_ITEMS[key];
    if (!item) return;
    if (item.category === "theme") themeOptions.push({ value: item.id, label: item.label });
    if (item.category === "wheel") wheelOptions.push({ value: item.id, label: item.label });
    if (item.category === "trail") trailOptions.push({ value: item.id, label: item.label });
  });

  fillSelect(elements.equippedTheme, themeOptions, state.cosmetics.equipped.theme);
  fillSelect(elements.equippedWheel, wheelOptions, state.cosmetics.equipped.wheel);
  fillSelect(elements.equippedTrail, trailOptions, state.cosmetics.equipped.trail);
}

function fillSelect(el, options, value) {
  el.textContent = "";
  options.forEach((option) => {
    const o = document.createElement("option");
    o.value = option.value;
    o.textContent = option.label;
    el.append(o);
  });
  el.value = options.some((o) => o.value === value) ? value : "default";
}

function applyCosmeticClasses() {
  document.body.classList.toggle("theme-neon", state.cosmetics.equipped.theme === "neon");
  document.body.classList.toggle("theme-classic", state.cosmetics.equipped.theme === "classic");
  document.body.classList.toggle("wheel-gold", state.cosmetics.equipped.wheel === "gold");
  document.body.classList.toggle("trail-spark", state.cosmetics.equipped.trail === "spark");
}

function submitRun() {
  const entry = {
    netProfit: state.netProfit,
    spins: state.spins,
    bestWinStreak: state.bestWinStreak,
    consistency: state.spins ? state.wins / state.spins : 0,
    drawdown: state.drawdown,
    mode: state.mode,
    tableVariant: state.tableVariant,
    tournament: state.tournament.enabled,
    at: new Date().toISOString()
  };

  state.leaderboard.push(entry);
  state.leaderboard.sort((a, b) => b.netProfit - a.netProfit);
  state.leaderboard = state.leaderboard.slice(0, 10);
  addHistoryText("Run submitted to local leaderboard.");
  updateProgress();
}

async function shareSummary() {
  const summary = `Roulette+ run | Profit ${state.netProfit} | Spins ${state.spins} | Best streak ${state.bestWinStreak} | Mode ${MODE_CONFIG[state.mode].label} | Seed ${state.meta.challengeSeed || "none"}`;
  try {
    await navigator.clipboard.writeText(summary);
    addHistoryText("Run summary copied to clipboard.");
  } catch {
    addHistoryText(`Share summary: ${summary}`);
  }
  updateProgress();
}

async function shareReplay() {
  const replay = {
    seed: state.meta.challengeSeed,
    mode: state.mode,
    tableVariant: state.tableVariant,
    netProfit: state.netProfit,
    spins: state.spins,
    bets: state.lastClearedBets
  };
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(replay))));
  const text = `${location.origin}${location.pathname}#replay=${encoded}`;
  try {
    await navigator.clipboard.writeText(text);
    addHistoryText("Replay link copied to clipboard.");
  } catch {
    addHistoryText(`Replay link: ${text}`);
  }
  updateProgress();
}

function setGhostTarget() {
  const target = prompt("Set ghost target net profit:", String(state.ghost.targetNet || 200));
  if (target == null) return;
  const val = Number(target);
  if (!Number.isFinite(val)) return;
  state.ghost.targetNet = Math.round(val);
  addHistoryText(`Ghost target set to ${state.ghost.targetNet}.`);
  updateProgress();
}

function prestigeReset() {
  if (state.spins < 50 && state.level < 5) {
    setResult("Prestige requires 50 spins or level 5.", false);
    return;
  }

  submitRun();
  const gained = 12 + state.prestige * 2;
  state.prestige += 1;
  state.gems += gained;
  addHistoryText(`Prestige ${state.prestige} reached (+${gained} gems, permanent gain boost).`);

  resetRunKeepMeta();
  updateProgress();
}

function rotateEventIfNeeded() {
  const day = new Date().getUTCDay();
  state.currentEvent = day === 5 ? "fortune" : day === 2 ? "rush" : "standard";
}

function setCurrentView(view) {
  const validViews = new Set(elements.viewPanels.map((panel) => panel.dataset.viewPanel).filter(Boolean));
  state.currentView = validViews.has(view) ? view : DEFAULT_NAV_VIEW;
}

function renderCurrentView() {
  const currentView = state.currentView || DEFAULT_NAV_VIEW;
  elements.viewPanels.forEach((panel) => {
    panel.hidden = panel.dataset.viewPanel !== currentView;
  });
  elements.viewButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.viewButton === currentView);
  });
}

function updateProgress() {
  const winRate = state.spins > 0 ? Math.round((state.wins / state.spins) * 100) : 0;
  const totalBet = totalBetAmount();
  const table = currentTable();
  const now = Date.now();
  const noMoreBetsActive = now < state.noMoreBetsUntil;

  elements.tokens.textContent = String(state.tokens);
  elements.gems.textContent = String(state.gems);
  elements.riskTokens.textContent = String(state.riskTokens);
  elements.level.textContent = String(state.level);
  elements.xp.textContent = String(state.xp);
  elements.xpToNext.textContent = String(xpForNextLevel(state.level));
  elements.seasonLevel.textContent = String(state.seasonLevel);
  elements.seasonXp.textContent = String(state.seasonXp);
  elements.prestige.textContent = String(state.prestige);

  const mod = modifierDef();
  elements.activeModifier.textContent = mod ? mod.label : "None";
  const ev = EVENTS.find((e) => e.id === state.currentEvent) || EVENTS[0];
  elements.activeEvent.textContent = ev.label;
  elements.eventBanner.textContent = `Event: ${ev.label}`;

  elements.spins.textContent = String(state.spins);
  elements.wins.textContent = String(state.wins);
  elements.losses.textContent = String(state.losses);
  elements.winRate.textContent = `${winRate}%`;
  elements.netProfit.textContent = String(state.netProfit);
  elements.totalWagered.textContent = String(state.totalWagered);
  elements.biggestWin.textContent = String(state.biggestWin);
  elements.currentStreak.textContent = String(state.currentStreak);
  elements.bestWinStreak.textContent = String(state.bestWinStreak);
  elements.worstLosingStreak.textContent = String(state.worstLosingStreak);
  elements.hotNumber.textContent = getHotNumber();
  elements.redRolls.textContent = String(state.colorStats.red);
  elements.blackRolls.textContent = String(state.colorStats.black);
  elements.evenRolls.textContent = String(state.colorStats.even);
  elements.oddRolls.textContent = String(state.colorStats.odd);

  elements.totalBet.textContent = String(totalBet);
  elements.activeBets.textContent = String(state.bets.length);
  elements.houseEdge.textContent = houseEdgeText();
  elements.noMoreBetsStatus.textContent = noMoreBetsActive ? `Closed (${Math.ceil((state.noMoreBetsUntil - now) / 1000)}s)` : "Open";

  elements.dailyStreak.textContent = String(state.daily.streak);
  elements.missionsCompleted.textContent = String(state.missionsCompleted);
  elements.achievementCount.textContent = String(Object.keys(state.achievementsUnlocked).length);
  const nextMilestoneSpins = (state.meta.milestonesClaimed + 1) * 10;
  elements.nextMilestone.textContent = `${nextMilestoneSpins} spins`;

  elements.offenseLevel.textContent = String(state.upgrades.offense);
  elements.economyLevel.textContent = String(state.upgrades.economy);
  elements.safetyLevel.textContent = String(state.upgrades.safety);
  elements.offenseCost.textContent = String(state.costs.offense);
  elements.economyCost.textContent = String(state.costs.economy);
  elements.safetyCost.textContent = String(state.costs.safety);

  elements.modeSelect.value = state.mode;
  elements.powerChoice.value = state.powerChoice;
  elements.seedInput.value = state.meta.challengeSeed;
  elements.tableVariant.value = state.tableVariant;
  elements.frenchRule.value = state.frenchRule;
  elements.tableMin.value = String(state.tableLimits.min);
  elements.tableMax.value = String(state.tableLimits.max);
  elements.noMoreBetsMs.value = String(state.noMoreBetsMs);
  elements.dealerSpeed.value = state.dealer.speed;
  elements.ballReleaseMs.value = String(state.dealer.ballReleaseMs);
  elements.dealerSignature.checked = !!state.dealer.signature;
  elements.highContrastMode.checked = state.highContrastMode;
  elements.onboardingPath.value = state.onboardingPath;
  elements.autoBetSystem.value = state.autoBet.system;
  elements.autoBetStopLoss.value = String(state.autoBet.stopLoss);
  elements.autoBetTakeProfit.value = String(state.autoBet.takeProfit);
  elements.autoBetEnabled.checked = !!state.autoBet.enabled;
  elements.historyFilter.value = state.analytics.historyFilter;
  elements.leaderboardCategory.value = state.analytics.leaderboardCategory;
  elements.tournamentMode.checked = state.tournament.enabled;
  elements.tournamentSeed.value = state.tournament.seed;
  elements.colorblindMode.checked = state.colorblindMode;
  elements.reducedMotion.checked = state.reducedMotion;
  setCurrentView(state.currentView);
  const showFrenchRules = state.tableVariant === "french";
  elements.frenchRule.disabled = !showFrenchRules;
  elements.hintText.textContent = state.onboardingPath === "beginner"
    ? "Beginner tip: start with outside bets and a low table amount."
    : state.onboardingPath === "intermediate"
      ? "Intermediate tip: mix outside + inside bets for balanced volatility."
      : "Advanced tip: exploit table variant edge and challenge seeds for optimization.";
  elements.doubleZeroSpot.hidden = !table.hasDoubleZero;

  renderBetList();
  renderMissions();
  renderChallenges();
  renderAchievements();
  renderHistory();
  renderLeaderboard();
  renderDistributionAndAnalytics();
  renderBetHighlights();
  updateCosmeticSelects();
  applyCosmeticClasses();
  renderCurrentView();

  document.body.classList.toggle("colorblind", state.colorblindMode);
  document.body.classList.toggle("high-contrast", state.highContrastMode);

  const disableTableActions = state.spinning || state.bets.length === 0 || totalBet > state.tokens || noMoreBetsActive || totalBet < state.tableLimits.min || totalBet > state.tableLimits.max;
  elements.spinButton.disabled = disableTableActions;
  elements.undoBet.disabled = state.spinning || state.bets.length === 0;
  elements.clearBets.disabled = state.spinning || state.bets.length === 0;
  elements.doubleBets.disabled = state.spinning || state.bets.length === 0;
  elements.halveBets.disabled = state.spinning || state.bets.length === 0;
  elements.buyOffense.disabled = state.spinning || state.tokens < state.costs.offense;
  elements.buyEconomy.disabled = state.spinning || state.tokens < state.costs.economy;
  elements.buySafety.disabled = state.spinning || state.tokens < state.costs.safety;

  if (totalBet > state.tokens) setResult("Not enough tokens for current bets. Reduce your table amount.", false, true);

  saveState();
}

function renderBetList() {
  elements.betList.textContent = "";
  state.bets.forEach((bet) => {
    const li = document.createElement("li");
    li.textContent = `${bet.label}: ${bet.amount}`;
    elements.betList.append(li);
  });
}

function renderBetHighlights() {
  document.querySelectorAll(".bet-spot").forEach((button) => {
    const key = button.dataset.betKey;
    if (!key) return;
    const hasBet = state.bets.some((bet) => bet.key === key);
    button.classList.toggle("has-bet", hasBet);
  });
}

function setupAccessibility() {
  elements.result.setAttribute("aria-live", "polite");
  document.querySelectorAll(".bet-spot").forEach((button) => {
    button.setAttribute("role", "button");
    button.setAttribute("tabindex", "0");
    button.setAttribute("aria-label", `${button.dataset.label || "bet"} spot`);
    if (button.dataset.a11yBound === "1") return;
    button.dataset.a11yBound = "1";
    button.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        button.click();
      }
    });
  });
}

function renderMissions() {
  elements.missionList.textContent = "";
  state.missions.forEach((mission) => {
    const li = document.createElement("li");
    li.textContent = `${mission.done ? "✅" : "⬜"} ${mission.text} (${mission.progress}/${mission.target})`;
    elements.missionList.append(li);
  });
}

function renderChallenges() {
  elements.challengeList.textContent = "";

  const daily = document.createElement("li");
  daily.textContent = `${state.daily.completed ? "✅" : "⬜"} Daily: Win on black 3x + place 5 outside bets (${state.daily.progress.winOnBlack}/3, ${state.daily.progress.outsideBets}/5)`;

  const weekly = document.createElement("li");
  weekly.textContent = `${state.weekly.completed ? "✅" : "⬜"} Weekly: 30 spins + 12 positive net spins (${state.weekly.progress.spins}/30, ${state.weekly.progress.netPositiveSpins}/12)`;

  elements.challengeList.append(daily, weekly);
}

function renderAchievements() {
  elements.achievementList.textContent = "";
  ACHIEVEMENTS.forEach((achievement) => {
    const li = document.createElement("li");
    li.textContent = `${state.achievementsUnlocked[achievement.id] ? "🏆" : "•"} ${achievement.text}`;
    elements.achievementList.append(li);
  });
}

function renderHistory() {
  elements.history.textContent = "";
  const filter = state.analytics.historyFilter || "all";
  const limit = filter === "all" ? state.history.length : Number(filter);
  state.history.slice(0, limit).forEach((entry) => {
    const li = document.createElement("li");
    if (entry.type === "spin") {
      li.textContent = `${entry.won ? "Win" : "Loss"} • ${numberLabel(entry.rolled)} ${entry.color} • Table ${entry.table} • Net ${entry.net >= 0 ? `+${entry.net}` : entry.net} • ${entry.mode} • ${entry.modifier}`;
    } else {
      li.textContent = entry.text;
    }
    elements.history.append(li);
  });
}

function renderLeaderboard() {
  elements.leaderboardList.textContent = "";
  if (!state.leaderboard.length) {
    const li = document.createElement("li");
    li.textContent = "No submitted runs yet.";
    elements.leaderboardList.append(li);
    return;
  }

  const category = state.analytics.leaderboardCategory || "profit";
  const sorted = [...state.leaderboard].sort((a, b) => {
    if (category === "profit") return b.netProfit - a.netProfit;
    if (category === "consistency") return b.consistency - a.consistency;
    if (category === "streak") return b.bestWinStreak - a.bestWinStreak;
    return a.drawdown - b.drawdown;
  });

  sorted.forEach((entry, idx) => {
    const li = document.createElement("li");
    const extra = category === "consistency"
      ? `Consistency ${(entry.consistency * 100).toFixed(1)}%`
      : category === "streak"
        ? `Streak ${entry.bestWinStreak}`
        : category === "drawdown"
          ? `Drawdown ${entry.drawdown}`
          : `Profit ${entry.netProfit}`;
    li.textContent = `#${idx + 1} ${extra} • Spins ${entry.spins} • ${entry.mode}${entry.tournament ? " • Tournament" : ""}`;
    elements.leaderboardList.append(li);
  });
}

function renderDistributionAndAnalytics() {
  const spinEntries = state.history.filter((h) => h.type === "spin");
  const nets = spinEntries.map((h) => h.net);
  const ev = nets.length ? nets.reduce((a, b) => a + b, 0) / nets.length : 0;
  const variance = nets.length ? nets.reduce((a, n) => a + ((n - ev) ** 2), 0) / nets.length : 0;
  const volatility = Math.sqrt(variance);
  const hot = getHotNumber();

  const coldCandidate = state.rollCounts
    .map((count, idx) => ({ count, idx }))
    .filter((x) => currentSequence().includes(x.idx))
    .sort((a, b) => a.count - b.count)[0];
  const cold = coldCandidate ? numberLabel(coldCandidate.idx) : "-";

  const modeRows = Object.entries(state.modePerformance)
    .map(([mode, info]) => ({ mode, avg: info.spins ? info.net / info.spins : -Infinity }))
    .sort((a, b) => b.avg - a.avg);
  const bestMode = modeRows[0]?.mode ? MODE_CONFIG[modeRows[0].mode].label : "-";

  elements.evPerSpin.textContent = ev.toFixed(2);
  elements.volatility.textContent = volatility.toFixed(2);
  elements.drawdown.textContent = String(state.drawdown);
  elements.bestMode.textContent = bestMode;
  const hotLabel = hot === "-" ? "-" : numberLabel(Number(hot));
  elements.distributionSummary.textContent = `Hot: ${hotLabel} • Cold: ${cold} • Red ${state.colorStats.red} / Black ${state.colorStats.black} • Even ${state.colorStats.even} / Odd ${state.colorStats.odd}`;
  elements.ghostSummary.textContent = `Ghost target: ${state.ghost.targetNet} • Current: ${state.netProfit} • Delta: ${state.netProfit - state.ghost.targetNet >= 0 ? "+" : ""}${state.netProfit - state.ghost.targetNet}`;

  const curve = state.bankrollCurve;
  if (!curve.length) {
    elements.bankrollCurve.textContent = "";
    return;
  }
  const min = Math.min(...curve);
  const max = Math.max(...curve);
  const spread = Math.max(1, max - min);
  const sample = curve.slice(-60);
  const bars = sample.map((value) => {
    const h = Math.round(((value - min) / spread) * 8);
    return CHART_BARS[h];
  }).join("");
  elements.bankrollCurve.textContent = `Bankroll curve\n${bars}\nmin ${min} max ${max}`;
}

function bindBetSpotEvents() {
  document.querySelectorAll(".bet-spot").forEach((button) => {
    if (button.dataset.bound === "1") return;
    const key = button.dataset.betKey;
    const label = button.dataset.label;
    if (!key || !label) return;
    button.dataset.bound = "1";
    button.addEventListener("click", () => addBet(key, label));
  });
}

function runSimulation() {
  const spins = Math.max(10, Math.min(5000, Number(elements.simSpins.value) || 500));
  const pocketCount = currentPocketCount();
  const baseBet = state.savedPreset.length ? state.savedPreset : state.bets;
  if (!baseBet.length) {
    elements.simulationResult.textContent = "Set current bets or a preset before simulation.";
    return;
  }
  let bankroll = state.tokens;
  const nets = [];
  for (let i = 0; i < spins; i += 1) {
    const rolled = currentSequence()[Math.floor(Math.random() * pocketCount)];
    let table = 0;
    let payout = 0;
    for (const bet of baseBet) {
      table += bet.amount;
      if (evaluateBet(bet.key, rolled, false)) payout += bet.amount + Math.round(bet.amount * payoutRatioFor(bet.key));
    }
    const net = payout - table;
    bankroll += net;
    nets.push(net);
  }
  const mean = nets.reduce((a, b) => a + b, 0) / nets.length;
  elements.simulationResult.textContent = `Simulation ${spins} spins • Avg net ${mean.toFixed(2)} • End bankroll ${Math.round(bankroll)}`;
  state.analytics.simulation = { spins, mean, bankroll };
  updateProgress();
}

function applySeedBrowserSelection() {
  const selected = elements.seedBrowser.value;
  if (!selected) return;
  state.meta.challengeSeed = selected === "official-daily" ? `official-${DAILY_DATE_KEY}` : selected;
  state.meta.rngState = 0;
  addHistoryText(`Seed applied from browser: ${state.meta.challengeSeed}`);
  updateProgress();
}

function applyReplayFromHash() {
  const hash = location.hash || "";
  if (!hash.startsWith("#replay=")) return;
  try {
    const payload = hash.slice("#replay=".length);
    const parsed = JSON.parse(decodeURIComponent(escape(atob(payload))));
    if (parsed.seed) state.meta.challengeSeed = String(parsed.seed);
    if (parsed.mode && MODE_CONFIG[parsed.mode]) state.mode = parsed.mode;
    if (parsed.tableVariant && TABLE_VARIANTS[parsed.tableVariant]) state.tableVariant = parsed.tableVariant;
    if (Array.isArray(parsed.bets)) state.bets = parsed.bets.filter((b) => b && typeof b.key === "string" && Number.isFinite(b.amount));
    addHistoryText("Replay snapshot loaded from URL.");
  } catch {
    addHistoryText("Replay snapshot in URL was invalid.");
  }
}

function wireEvents() {
  bindBetSpotEvents();

  document.querySelectorAll(".chip-preset").forEach((button) => {
    button.addEventListener("click", () => {
      const current = parseInt(elements.chipAmount.value, 10) || 0;
      const add = Number(button.dataset.chip || 0);
      elements.chipAmount.value = String(Math.max(1, current + add));
      updateProgress();
    });
  });

  document.querySelectorAll(".shop-item").forEach((button) => {
    button.addEventListener("click", () => buyShopItem(button.dataset.item));
  });

  elements.spinButton.addEventListener("click", spinRoulette);
  elements.undoBet.addEventListener("click", undoBet);
  elements.clearBets.addEventListener("click", clearBets);
  elements.savePreset.addEventListener("click", savePreset);
  elements.loadPreset.addEventListener("click", loadPreset);
  elements.doubleBets.addEventListener("click", () => scaleBets(2));
  elements.halveBets.addEventListener("click", () => scaleBets(0.5));
  elements.rebet.addEventListener("click", rebetLast);
  elements.addInsideBet.addEventListener("click", addInsideBetFromBuilder);
  elements.addNeighbors.addEventListener("click", addNeighborsBet);
  elements.addFinale.addEventListener("click", addFinaleBet);
  elements.addCallBundle.addEventListener("click", addCallBundle);
  elements.saveStrategy.addEventListener("click", saveStrategyProfile);
  elements.loadStrategy.addEventListener("click", loadStrategyProfile);
  elements.rerollMissions.addEventListener("click", rerollMissions);

  elements.buyOffense.addEventListener("click", () => buyUpgrade("offense"));
  elements.buyEconomy.addEventListener("click", () => buyUpgrade("economy"));
  elements.buySafety.addEventListener("click", () => buyUpgrade("safety"));

  elements.submitRun.addEventListener("click", submitRun);
  elements.shareSummary.addEventListener("click", shareSummary);
  elements.shareReplay.addEventListener("click", shareReplay);
  elements.setGhostTarget.addEventListener("click", setGhostTarget);
  elements.prestigeButton.addEventListener("click", prestigeReset);
  elements.runSimulation.addEventListener("click", runSimulation);
  elements.applySeedBrowser.addEventListener("click", applySeedBrowserSelection);

  elements.modeSelect.addEventListener("change", () => {
    state.mode = elements.modeSelect.value;
    updateProgress();
  });

  elements.tableVariant.addEventListener("change", () => {
    state.tableVariant = elements.tableVariant.value;
    if (!currentTable().hasDoubleZero) {
      state.bets = state.bets.filter((bet) => !bet.key.includes(String(DOUBLE_ZERO_NUMBER)));
      state.lastClearedBets = state.lastClearedBets.filter((bet) => !bet.key.includes(String(DOUBLE_ZERO_NUMBER)));
    }
    buildWheel();
    buildNumberBoard();
    bindBetSpotEvents();
    setupAccessibility();
    updateProgress();
  });

  elements.frenchRule.addEventListener("change", () => {
    state.frenchRule = elements.frenchRule.value;
    updateProgress();
  });

  elements.tableMin.addEventListener("change", () => {
    state.tableLimits.min = Math.max(1, Number(elements.tableMin.value) || 1);
    updateProgress();
  });
  elements.tableMax.addEventListener("change", () => {
    state.tableLimits.max = Math.max(state.tableLimits.min, Number(elements.tableMax.value) || state.tableLimits.min);
    updateProgress();
  });
  elements.noMoreBetsMs.addEventListener("change", () => {
    state.noMoreBetsMs = Math.max(0, Number(elements.noMoreBetsMs.value) || 0);
    updateProgress();
  });
  elements.dealerSpeed.addEventListener("change", () => {
    state.dealer.speed = elements.dealerSpeed.value;
    updateProgress();
  });
  elements.ballReleaseMs.addEventListener("change", () => {
    state.dealer.ballReleaseMs = Math.max(0, Number(elements.ballReleaseMs.value) || 0);
    updateProgress();
  });
  elements.dealerSignature.addEventListener("change", () => {
    state.dealer.signature = elements.dealerSignature.checked;
    updateProgress();
  });

  elements.powerChoice.addEventListener("change", () => {
    state.powerChoice = elements.powerChoice.value;
    updateProgress();
  });

  elements.seedInput.addEventListener("change", () => {
    state.meta.challengeSeed = elements.seedInput.value.trim();
    state.meta.rngState = 0;
    addHistoryText(state.meta.challengeSeed ? `Challenge seed set: ${state.meta.challengeSeed}` : "Challenge seed cleared.");
    updateProgress();
  });

  elements.colorblindMode.addEventListener("change", () => {
    state.colorblindMode = elements.colorblindMode.checked;
    updateProgress();
  });
  elements.highContrastMode.addEventListener("change", () => {
    state.highContrastMode = elements.highContrastMode.checked;
    updateProgress();
  });
  elements.onboardingPath.addEventListener("change", () => {
    state.onboardingPath = elements.onboardingPath.value;
    updateProgress();
  });
  elements.autoBetSystem.addEventListener("change", () => {
    state.autoBet.system = elements.autoBetSystem.value;
    updateProgress();
  });
  elements.autoBetStopLoss.addEventListener("change", () => {
    state.autoBet.stopLoss = Math.max(0, Number(elements.autoBetStopLoss.value) || 0);
    updateProgress();
  });
  elements.autoBetTakeProfit.addEventListener("change", () => {
    state.autoBet.takeProfit = Math.max(0, Number(elements.autoBetTakeProfit.value) || 0);
    updateProgress();
  });
  elements.autoBetEnabled.addEventListener("change", () => {
    state.autoBet.enabled = elements.autoBetEnabled.checked;
    if (state.autoBet.enabled) addHistoryText(AUTO_WARN);
    updateProgress();
  });
  elements.historyFilter.addEventListener("change", () => {
    state.analytics.historyFilter = elements.historyFilter.value;
    updateProgress();
  });
  elements.leaderboardCategory.addEventListener("change", () => {
    state.analytics.leaderboardCategory = elements.leaderboardCategory.value;
    updateProgress();
  });
  elements.tournamentMode.addEventListener("change", () => {
    state.tournament.enabled = elements.tournamentMode.checked;
    if (state.tournament.enabled) {
      if (!state.tournament.started) {
        state.tournament.prevTokens = state.tokens;
        state.tokens = state.tournament.bankroll;
        state.meta.challengeSeed = state.tournament.seed || `official-${DAILY_DATE_KEY}`;
        state.meta.rngState = 0;
        state.tournament.started = true;
        addHistoryText("Tournament mode started with fixed bankroll and seed.");
      }
    } else if (state.tournament.started) {
      if (Number.isFinite(state.tournament.prevTokens)) state.tokens = state.tournament.prevTokens;
      state.tournament.started = false;
      state.tournament.prevTokens = null;
      addHistoryText("Tournament mode disabled; bankroll restored.");
    }
    updateProgress();
  });
  elements.tournamentSeed.addEventListener("change", () => {
    state.tournament.seed = elements.tournamentSeed.value.trim();
    updateProgress();
  });

  elements.reducedMotion.addEventListener("change", () => {
    state.reducedMotion = elements.reducedMotion.checked;
    updateProgress();
  });

  elements.equippedTheme.addEventListener("change", () => {
    state.cosmetics.equipped.theme = elements.equippedTheme.value;
    updateProgress();
  });

  elements.equippedWheel.addEventListener("change", () => {
    state.cosmetics.equipped.wheel = elements.equippedWheel.value;
    updateProgress();
  });

  elements.equippedTrail.addEventListener("change", () => {
    state.cosmetics.equipped.trail = elements.equippedTrail.value;
    updateProgress();
  });

  elements.chipAmount.addEventListener("input", updateProgress);

  elements.viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setCurrentView(button.dataset.viewButton);
      updateProgress();
    });
  });

  elements.openTutorial.addEventListener("click", () => {
    if (!elements.tutorialDialog.open) elements.tutorialDialog.showModal();
    state.meta.tutorialSeen = true;
    updateProgress();
  });

  elements.closeTutorial.addEventListener("click", () => elements.tutorialDialog.close());
}

function init() {
  applyReplayFromHash();
  buildNumberBoard();
  buildWheel();
  ensureMissions();
  updateDailyLogin();
  updateWeeklyReset();
  rotateEventIfNeeded();
  updateWheelNumber(0);
  setWinningPocket(0);
  wireEvents();
  setupAccessibility();

  if (!state.meta.tutorialSeen) {
    setTimeout(() => {
      if (typeof elements.tutorialDialog.showModal === "function" && !elements.tutorialDialog.open) elements.tutorialDialog.showModal();
      state.meta.tutorialSeen = true;
      updateProgress();
    }, 150);
  }

  updateProgress();
}

init();
