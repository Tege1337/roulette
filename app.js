const ROULETTE_POCKETS = 37;
const PAYOUT_BOOST_PER_LEVEL = 0.1;
const INSURANCE_REFUND_PER_LEVEL = 0.1;
const STIPEND_TOKENS_PER_LEVEL = 2;
const UPGRADE_COST_MULTIPLIER = 1.5;
const MAX_HISTORY_ITEMS = 20;
const redNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

const state = {
  tokens: 100,
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
    payout: 0,
    insurance: 0,
    stipend: 0
  },
  costs: {
    payout: 200,
    insurance: 150,
    stipend: 180
  },
  bets: [],
  spinning: false
};

const elements = {
  tokens: document.getElementById("tokens"),
  spins: document.getElementById("spins"),
  wins: document.getElementById("wins"),
  losses: document.getElementById("losses"),
  winRate: document.getElementById("winRate"),
  netProfit: document.getElementById("netProfit"),
  totalWagered: document.getElementById("totalWagered"),
  biggestWin: document.getElementById("biggestWin"),
  currentStreak: document.getElementById("currentStreak"),
  bestWinStreak: document.getElementById("bestWinStreak"),
  worstLosingStreak: document.getElementById("worstLosingStreak"),
  hotNumber: document.getElementById("hotNumber"),
  redRolls: document.getElementById("redRolls"),
  blackRolls: document.getElementById("blackRolls"),
  evenRolls: document.getElementById("evenRolls"),
  oddRolls: document.getElementById("oddRolls"),
  totalBet: document.getElementById("totalBet"),
  activeBets: document.getElementById("activeBets"),
  betList: document.getElementById("betList"),
  history: document.getElementById("history"),
  chipAmount: document.getElementById("chipAmount"),
  spinButton: document.getElementById("spinButton"),
  undoBet: document.getElementById("undoBet"),
  clearBets: document.getElementById("clearBets"),
  result: document.getElementById("result"),
  wheel: document.getElementById("wheel"),
  wheelNumber: document.getElementById("wheelNumber"),
  numberBoard: document.getElementById("numberBoard"),
  payoutLevel: document.getElementById("payoutLevel"),
  insuranceLevel: document.getElementById("insuranceLevel"),
  stipendLevel: document.getElementById("stipendLevel"),
  payoutCost: document.getElementById("payoutCost"),
  insuranceCost: document.getElementById("insuranceCost"),
  stipendCost: document.getElementById("stipendCost"),
  payoutPercentPerLevel: document.getElementById("payoutPercentPerLevel"),
  insurancePercentPerLevel: document.getElementById("insurancePercentPerLevel"),
  stipendTokensPerLevel: document.getElementById("stipendTokensPerLevel"),
  buyPayout: document.getElementById("buyPayout"),
  buyInsurance: document.getElementById("buyInsurance"),
  buyStipend: document.getElementById("buyStipend")
};

const boardBets = [];

for (let n = 1; n <= 36; n += 1) {
  const button = document.createElement("button");
  button.className = `bet-spot ${redNumbers.has(n) ? "red" : "black"}`;
  button.dataset.betKey = `number:${n}`;
  button.dataset.label = String(n);
  button.textContent = String(n);
  elements.numberBoard.append(button);
}

document.querySelectorAll(".bet-spot").forEach((button) => {
  boardBets.push(button);
});

function addHistory(text) {
  const item = document.createElement("li");
  item.textContent = text;
  elements.history.prepend(item);
  while (elements.history.children.length > MAX_HISTORY_ITEMS) {
    elements.history.removeChild(elements.history.lastChild);
  }
}

function totalBetAmount() {
  return state.bets.reduce((sum, bet) => sum + bet.amount, 0);
}

function getHotNumber() {
  let maxCount = 0;
  let hotNumber = "-";
  state.rollCounts.forEach((count, number) => {
    if (count > maxCount) {
      maxCount = count;
      hotNumber = String(number);
    }
  });
  return maxCount > 0 ? hotNumber : "-";
}

function payoutRatioFor(key) {
  if (key.startsWith("number:")) return 35;
  if (key.startsWith("dozen:") || key.startsWith("column:")) return 2;
  return 1;
}

function evaluateBet(key, rolled) {
  if (key.startsWith("number:")) return rolled === Number(key.split(":")[1]);
  if (rolled === 0) return false;

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

  return false;
}

function renderBetBoardHighlights() {
  boardBets.forEach((button) => {
    const key = button.dataset.betKey;
    const hasBet = state.bets.some((bet) => bet.key === key);
    button.classList.toggle("has-bet", hasBet);
  });
}

function renderBetList() {
  elements.betList.textContent = "";
  state.bets.forEach((bet) => {
    const li = document.createElement("li");
    li.textContent = `${bet.label}: ${bet.amount}`;
    elements.betList.append(li);
  });
}

function updateUI() {
  const winRate = state.spins > 0 ? Math.round((state.wins / state.spins) * 100) : 0;
  const totalBet = totalBetAmount();

  elements.tokens.textContent = state.tokens;
  elements.spins.textContent = state.spins;
  elements.wins.textContent = state.wins;
  elements.losses.textContent = state.losses;
  elements.winRate.textContent = `${winRate}%`;
  elements.netProfit.textContent = state.netProfit;
  elements.totalWagered.textContent = state.totalWagered;
  elements.biggestWin.textContent = state.biggestWin;
  elements.currentStreak.textContent = state.currentStreak;
  elements.bestWinStreak.textContent = state.bestWinStreak;
  elements.worstLosingStreak.textContent = state.worstLosingStreak;
  elements.hotNumber.textContent = getHotNumber();
  elements.redRolls.textContent = state.colorStats.red;
  elements.blackRolls.textContent = state.colorStats.black;
  elements.evenRolls.textContent = state.colorStats.even;
  elements.oddRolls.textContent = state.colorStats.odd;
  elements.totalBet.textContent = totalBet;
  elements.activeBets.textContent = state.bets.length;

  elements.payoutLevel.textContent = state.upgrades.payout;
  elements.insuranceLevel.textContent = state.upgrades.insurance;
  elements.stipendLevel.textContent = state.upgrades.stipend;
  elements.payoutCost.textContent = state.costs.payout;
  elements.insuranceCost.textContent = state.costs.insurance;
  elements.stipendCost.textContent = state.costs.stipend;

  const disableTableActions = state.spinning || state.bets.length === 0 || totalBet > state.tokens;
  elements.spinButton.disabled = disableTableActions;
  elements.undoBet.disabled = state.spinning || state.bets.length === 0;
  elements.clearBets.disabled = state.spinning || state.bets.length === 0;
  elements.buyPayout.disabled = state.spinning || state.tokens < state.costs.payout;
  elements.buyInsurance.disabled = state.spinning || state.tokens < state.costs.insurance;
  elements.buyStipend.disabled = state.spinning || state.tokens < state.costs.stipend;

  renderBetList();
  renderBetBoardHighlights();

  if (totalBet > state.tokens) {
    elements.result.textContent = "Not enough tokens for current bets. Reduce your table amount.";
    elements.result.className = "result-loss";
  }
}

function addBet(key, label) {
  const chip = parseInt(elements.chipAmount.value, 10);
  if (!Number.isInteger(chip) || chip <= 0) {
    elements.result.textContent = "Enter a valid positive chip amount.";
    elements.result.className = "result-loss";
    return;
  }

  const existing = state.bets.find((bet) => bet.key === key);
  if (existing) {
    existing.amount += chip;
  } else {
    state.bets.push({ key, label, amount: chip });
  }

  elements.result.textContent = `Placed ${chip} on ${label}.`;
  elements.result.className = "";
  updateUI();
}

function undoBet() {
  state.bets.pop();
  updateUI();
}

function clearBets() {
  state.bets = [];
  updateUI();
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

function animateRoll(finalNumber) {
  return new Promise((resolve) => {
    let ticks = 0;
    state.spinning = true;
    elements.wheel.classList.add("rolling");
    const timer = setInterval(() => {
      ticks += 1;
      elements.wheelNumber.textContent = String(Math.floor(Math.random() * ROULETTE_POCKETS));
      if (ticks >= 28) {
        clearInterval(timer);
        elements.wheel.classList.remove("rolling");
        elements.wheelNumber.textContent = String(finalNumber);
        state.spinning = false;
        resolve();
      }
    }, 70);
  });
}

async function spinRoulette() {
  if (state.spinning) return;
  if (state.bets.length === 0) {
    elements.result.textContent = "Place at least one bet on the board.";
    elements.result.className = "result-loss";
    return;
  }

  const tableAmount = totalBetAmount();
  if (tableAmount > state.tokens) {
    elements.result.textContent = "Not enough tokens for that table.";
    elements.result.className = "result-loss";
    return;
  }

  const tokensBeforeSpin = state.tokens;
  state.tokens -= tableAmount;
  state.totalWagered += tableAmount;

  updateUI();
  const rolled = Math.floor(Math.random() * ROULETTE_POCKETS);
  await animateRoll(rolled);

  let grossPayout = 0;
  let losingStake = 0;
  let wonAny = false;

  for (const bet of state.bets) {
    const won = evaluateBet(bet.key, rolled);
    if (won) {
      wonAny = true;
      const ratio = payoutRatioFor(bet.key);
      const profit = bet.amount * ratio;
      const boostedProfit = Math.round(profit * (1 + state.upgrades.payout * PAYOUT_BOOST_PER_LEVEL));
      grossPayout += bet.amount + boostedProfit;
    } else {
      losingStake += bet.amount;
    }
  }

  state.tokens += grossPayout;
  if (losingStake > 0) {
    state.tokens += Math.round(losingStake * state.upgrades.insurance * INSURANCE_REFUND_PER_LEVEL);
  }

  const stipendGain = state.upgrades.stipend * STIPEND_TOKENS_PER_LEVEL;
  if (stipendGain > 0) {
    state.tokens += stipendGain;
  }

  state.spins += 1;
  const netChange = state.tokens - tokensBeforeSpin;
  state.netProfit = state.tokens - 100;
  if (netChange > state.biggestWin) state.biggestWin = netChange;

  if (wonAny) {
    state.wins += 1;
    state.currentStreak = state.currentStreak >= 0 ? state.currentStreak + 1 : 1;
    if (state.currentStreak > state.bestWinStreak) state.bestWinStreak = state.currentStreak;
    elements.result.textContent = `Roulette: ${rolled}. Net gain: +${netChange}.`;
    elements.result.className = "result-win";
  } else {
    state.losses += 1;
    state.currentStreak = state.currentStreak <= 0 ? state.currentStreak - 1 : -1;
    if (state.currentStreak < state.worstLosingStreak) state.worstLosingStreak = state.currentStreak;
    elements.result.textContent = `Roulette: ${rolled}. Net change: ${netChange}.`;
    elements.result.className = "result-loss";
  }

  applyRollStats(rolled);
  addHistory(`${wonAny ? "Win" : "Loss"} - rolled ${rolled}, table ${tableAmount}, net ${netChange}, tokens ${state.tokens}`);
  clearBets();
}

function buyUpgrade(type) {
  const cost = state.costs[type];
  if (state.tokens < cost || state.spinning) return;

  state.tokens -= cost;
  state.upgrades[type] += 1;
  state.costs[type] = Math.round(cost * UPGRADE_COST_MULTIPLIER);

  addHistory(`Bought ${type} upgrade (level ${state.upgrades[type]}).`);
  updateUI();
}

boardBets.forEach((button) => {
  button.addEventListener("click", () => addBet(button.dataset.betKey, button.dataset.label));
});

elements.spinButton.addEventListener("click", spinRoulette);
elements.undoBet.addEventListener("click", undoBet);
elements.clearBets.addEventListener("click", clearBets);
elements.buyPayout.addEventListener("click", () => buyUpgrade("payout"));
elements.buyInsurance.addEventListener("click", () => buyUpgrade("insurance"));
elements.buyStipend.addEventListener("click", () => buyUpgrade("stipend"));
elements.chipAmount.addEventListener("input", updateUI);

elements.payoutPercentPerLevel.textContent = String(Math.round(PAYOUT_BOOST_PER_LEVEL * 100));
elements.insurancePercentPerLevel.textContent = String(Math.round(INSURANCE_REFUND_PER_LEVEL * 100));
elements.stipendTokensPerLevel.textContent = String(STIPEND_TOKENS_PER_LEVEL);

updateUI();
