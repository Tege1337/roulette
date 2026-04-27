const ROULETTE_POCKETS = 37;
const MAX_HISTORY_ITEMS = 30;
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
const redNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

if (EUROPEAN_ROULETTE_SEQUENCE.length !== ROULETTE_POCKETS) {
  throw new Error(`Invalid roulette sequence length: expected ${ROULETTE_POCKETS}, got ${EUROPEAN_ROULETTE_SEQUENCE.length}.`);
}

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

const MISSION_TEMPLATES = [
  { id: "mission_spins", text: "Complete 10 spins", target: 10, type: "spins", reward: { tokens: 50, xp: 40 } },
  { id: "mission_wins", text: "Win 4 spins", target: 4, type: "wins", reward: { tokens: 60, xp: 50 } },
  { id: "mission_outside", text: "Place 8 outside bets", target: 8, type: "outsideBets", reward: { tokens: 40, gems: 5 } },
  { id: "mission_high", text: "Bet 5 times in High-Risk mode", target: 5, type: "highRiskSpins", reward: { xp: 60, gems: 5 } }
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
  rollCounts: Array.from({ length: ROULETTE_POCKETS }, () => 0),
  colorStats: { red: 0, black: 0, even: 0, odd: 0 },

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
  powerChoice: "none",
  currentModifier: null,
  currentEvent: "standard",
  reducedMotion: false,
  colorblindMode: false,

  bets: [],
  betActions: [],
  spinning: false,
  wheelRotation: 0,
  history: [],
  leaderboard: [],
  savedPreset: [],

  missions: [],
  missionStats: {
    spins: 0,
    wins: 0,
    outsideBets: 0,
    highRiskSpins: 0
  },
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
    milestonesClaimed: 0
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

  spinButton: byId("spinButton"), undoBet: byId("undoBet"), clearBets: byId("clearBets"), savePreset: byId("savePreset"), loadPreset: byId("loadPreset"),
  submitRun: byId("submitRun"), shareSummary: byId("shareSummary"), prestigeButton: byId("prestigeButton"),

  result: byId("result"), spinBreakdown: byId("spinBreakdown"), leaderboardList: byId("leaderboardList"),
  missionList: byId("missionList"), challengeList: byId("challengeList"), achievementList: byId("achievementList"),
  nextMilestone: byId("nextMilestone"), missionsCompleted: byId("missionsCompleted"), achievementCount: byId("achievementCount"), dailyStreak: byId("dailyStreak"),

  offenseLevel: byId("offenseLevel"), economyLevel: byId("economyLevel"), safetyLevel: byId("safetyLevel"),
  offenseCost: byId("offenseCost"), economyCost: byId("economyCost"), safetyCost: byId("safetyCost"),
  buyOffense: byId("buyOffense"), buyEconomy: byId("buyEconomy"), buySafety: byId("buySafety"),

  equippedTheme: byId("equippedTheme"), equippedWheel: byId("equippedWheel"), equippedTrail: byId("equippedTrail"),

  wheelTrack: byId("wheelTrack"), wheelNumber: byId("wheelNumber"), numberBoard: byId("numberBoard"),

  tutorialDialog: byId("tutorialDialog"), openTutorial: byId("openTutorial"), closeTutorial: byId("closeTutorial")
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
  if (number === 0) return "green";
  return redNumbers.has(number) ? "red" : "black";
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
  const pocketAngle = 360 / EUROPEAN_ROULETTE_SEQUENCE.length;
  const colorStops = [];

  EUROPEAN_ROULETTE_SEQUENCE.forEach((number, index) => {
    const start = index * pocketAngle;
    const end = (index + 1) * pocketAngle;
    const pocketColor = getNumberColor(number);
    const fill = pocketColor === "red" ? "#7f1d1d" : pocketColor === "black" ? "#020617" : "#14532d";
    colorStops.push(`${fill} ${start}deg ${end}deg`);

    const pocket = document.createElement("div");
    pocket.className = `wheel-pocket ${pocketColor}`;
    pocket.dataset.number = String(number);
    pocket.style.setProperty("--angle", `${index * pocketAngle}deg`);
    pocket.textContent = String(number);
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
}

function ensureMissions() {
  if (state.missions.length) return;
  state.missions = MISSION_TEMPLATES.slice(0, 3).map((m) => ({ ...m, progress: 0, done: false }));
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
  if (state.mode !== "chaos") {
    state.currentModifier = Math.random() < 0.15 ? MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)].key : null;
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
  elements.wheelNumber.textContent = String(number);
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
    const duration = state.reducedMotion ? 150 : Math.max(350, Math.round(SPIN_TRANSITION_DURATION_MS * modeDuration));

    const pocketAngle = 360 / EUROPEAN_ROULETTE_SEQUENCE.length;
    const index = EUROPEAN_ROULETTE_SEQUENCE.indexOf(finalNumber);
    const desiredRotation = normalizeAngle(-index * pocketAngle);
    const currentRotation = normalizeAngle(state.wheelRotation);

    let delta = desiredRotation - currentRotation;
    if (delta < 0) delta += 360;

    state.wheelRotation += 360 * (state.reducedMotion ? 1 : SPIN_FULL_ROTATIONS) + delta;
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
  if (key.startsWith("dozen:") || key.startsWith("column:")) return 2;
  if (key.startsWith("combo:")) return 3;
  if (key.startsWith("streak:")) return 2;
  return 1;
}

function evaluateBet(key, rolled, spinWonAny) {
  if (key.startsWith("number:")) return rolled === Number(key.split(":")[1]);
  if (rolled === 0 && !key.startsWith("streak:")) return false;

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
  state.bets = [];
  state.betActions = [];
  updateProgress();
}

function setResult(text, positive, silent) {
  elements.result.textContent = text;
  elements.result.className = positive ? "result-win" : "result-loss";
  if (!silent) addHistoryText(text);
}

function applyRollStats(rolled) {
  state.rollCounts[rolled] += 1;
  if (rolled !== 0) {
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
    if (wonAny && !redNumbers.has(rolled) && rolled !== 0) state.daily.progress.winOnBlack += 1;
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
  if (state.bets.length === 0) {
    setResult("Place at least one bet on the board.", false);
    return;
  }

  const tableAmount = totalBetAmount();
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

  const tokensBeforeSpin = state.tokens;
  state.tokens -= tableAmount;
  state.totalWagered += tableAmount;

  const rolled = Math.floor(getRandomValue() * ROULETTE_POCKETS);
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
      losingStake += bet.amount;
    }
  }

  let insuranceRefund = Math.round(losingStake * 0.1 * ctx.insuranceMultiplier * mode.insuranceMultiplier);
  if (ctx.shield > 0) insuranceRefund += Math.round(losingStake * ctx.shield);

  const stipendGain = Math.round((2 + state.upgrades.economy * 2) * ctx.stipendMultiplier) + ctx.stipendFlat;

  const baseTokensAfterSpin = state.tokens + grossPayout + insuranceRefund + stipendGain;
  let netChange = baseTokensAfterSpin - tokensBeforeSpin;
  if (useRisk) {
    state.riskTokens -= 1;
    netChange *= 2;
  }
  state.tokens = tokensBeforeSpin + netChange;

  state.spins += 1;
  state.netProfit = state.tokens - (100 + state.prestige * 10);
  if (netChange > state.biggestWin) state.biggestWin = netChange;
  if (netChange > state.meta.biggestSingleNet) state.meta.biggestSingleNet = netChange;

  const color = getNumberColor(rolled);
  const colorLabel = capitalize(color);

  if (wonAny) {
    state.wins += 1;
    state.currentStreak = state.currentStreak >= 0 ? state.currentStreak + 1 : 1;
    state.bestWinStreak = Math.max(state.bestWinStreak, state.currentStreak);
    setResult(`Roulette: ${rolled} (${colorLabel}). Net ${netChange >= 0 ? `+${netChange}` : netChange}.`, true, true);
  } else {
    state.losses += 1;
    state.currentStreak = state.currentStreak <= 0 ? state.currentStreak - 1 : -1;
    state.worstLosingStreak = Math.min(state.worstLosingStreak, state.currentStreak);
    setResult(`Roulette: ${rolled} (${colorLabel}). Net ${netChange}.`, false, true);
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

  applyMissionsAndChallenges({ wonAny, rolled, netChange });
  applyMilestoneRewards();
  checkAchievements();

  if (netChange >= 180) {
    document.body.classList.add("celebrate");
    setTimeout(() => document.body.classList.remove("celebrate"), 700);
  }

  clearBets();
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
    mode: state.mode,
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

function updateProgress() {
  const winRate = state.spins > 0 ? Math.round((state.wins / state.spins) * 100) : 0;
  const totalBet = totalBetAmount();

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
  elements.colorblindMode.checked = state.colorblindMode;
  elements.reducedMotion.checked = state.reducedMotion;

  renderBetList();
  renderMissions();
  renderChallenges();
  renderAchievements();
  renderHistory();
  renderLeaderboard();
  renderBetHighlights();
  updateCosmeticSelects();
  applyCosmeticClasses();

  document.body.classList.toggle("colorblind", state.colorblindMode);

  const disableTableActions = state.spinning || state.bets.length === 0 || totalBet > state.tokens;
  elements.spinButton.disabled = disableTableActions;
  elements.undoBet.disabled = state.spinning || state.bets.length === 0;
  elements.clearBets.disabled = state.spinning || state.bets.length === 0;
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
  state.history.forEach((entry) => {
    const li = document.createElement("li");
    if (entry.type === "spin") {
      li.textContent = `${entry.won ? "Win" : "Loss"} • ${entry.rolled} ${entry.color} • Table ${entry.table} • Net ${entry.net >= 0 ? `+${entry.net}` : entry.net} • ${entry.mode} • ${entry.modifier}`;
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

  state.leaderboard.forEach((entry, idx) => {
    const li = document.createElement("li");
    li.textContent = `#${idx + 1} Profit ${entry.netProfit} • Spins ${entry.spins} • Streak ${entry.bestWinStreak} • ${entry.mode}`;
    elements.leaderboardList.append(li);
  });
}

function wireEvents() {
  document.querySelectorAll(".bet-spot").forEach((button) => {
    const key = button.dataset.betKey;
    const label = button.dataset.label;
    if (!key || !label) return;
    button.addEventListener("click", () => addBet(key, label));
  });

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

  elements.buyOffense.addEventListener("click", () => buyUpgrade("offense"));
  elements.buyEconomy.addEventListener("click", () => buyUpgrade("economy"));
  elements.buySafety.addEventListener("click", () => buyUpgrade("safety"));

  elements.submitRun.addEventListener("click", submitRun);
  elements.shareSummary.addEventListener("click", shareSummary);
  elements.prestigeButton.addEventListener("click", prestigeReset);

  elements.modeSelect.addEventListener("change", () => {
    state.mode = elements.modeSelect.value;
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

  elements.openTutorial.addEventListener("click", () => {
    elements.tutorialDialog.showModal();
    state.meta.tutorialSeen = true;
    updateProgress();
  });

  elements.closeTutorial.addEventListener("click", () => elements.tutorialDialog.close());
}

function init() {
  buildNumberBoard();
  buildWheel();
  ensureMissions();
  updateDailyLogin();
  updateWeeklyReset();
  rotateEventIfNeeded();
  updateWheelNumber(0);
  setWinningPocket(0);
  wireEvents();

  if (!state.meta.tutorialSeen) {
    setTimeout(() => {
      if (typeof elements.tutorialDialog.showModal === "function") elements.tutorialDialog.showModal();
      state.meta.tutorialSeen = true;
      updateProgress();
    }, 150);
  }

  updateProgress();
}

init();
