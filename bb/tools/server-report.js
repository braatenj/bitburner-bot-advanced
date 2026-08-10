const HACK_WORKER = "/bb/workers/hack.js";
const GROW_WORKER = "/bb/workers/grow.js";
const WEAKEN_WORKER = "/bb/workers/weaken.js";

const HACK_SECURITY_PER_THREAD = 0.002;
const GROW_SECURITY_PER_THREAD = 0.004;
const MIN_MONEY = 1;

export function autocomplete(data, args) {
  return data.flags([
    ["batch-gap", 1000],
    ["money-buffer", 0.1],
    ["prep-money-ratio", 0.99],
    ["prep-security-buffer", 0.05],
  ]);
}

export function main(ns) {
  ns.disableLog("ALL");

  const options = parseArgs(ns.args);
  const servers = scanAllServers(ns).sort((a, b) => a.localeCompare(b));
  const totalRam = servers
    .filter((server) => ns.hasRootAccess(server))
    .reduce((total, server) => total + ns.getServerMaxRam(server), 0);
  const formulaContext = getFormulaContext(ns);
  const workerRam = getWorkerRam(ns);
  const rows = servers.map((server) => buildRow(ns, server, totalRam, options, workerRam, formulaContext));

  rows.sort((a, b) => {
    if (b.expectedMoneyPerSecond !== a.expectedMoneyPerSecond) return b.expectedMoneyPerSecond - a.expectedMoneyPerSecond;
    return a.server.localeCompare(b.server);
  });

  printReport(ns, rows, totalRam, options, formulaContext, workerRam);
}

function parseArgs(rawArgs) {
  const options = {
    batchGapMs: 1000,
    moneyBuffer: 0.1,
    prepMoneyRatio: 0.99,
    prepSecurityBuffer: 0.05,
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = String(rawArgs[index]);
    if (arg === "--batch-gap") options.batchGapMs = parseMs(rawArgs[++index], options.batchGapMs, 100);
    else if (arg === "--money-buffer") options.moneyBuffer = parseRatio(rawArgs[++index], options.moneyBuffer, 0, 0.95);
    else if (arg === "--prep-money-ratio") options.prepMoneyRatio = parseRatio(rawArgs[++index], options.prepMoneyRatio, 0.01, 1);
    else if (arg === "--prep-security-buffer") options.prepSecurityBuffer = parseNumber(rawArgs[++index], options.prepSecurityBuffer, 0);
  }

  return options;
}

function scanAllServers(ns) {
  const seen = new Set(["home"]);
  const queue = ["home"];

  while (queue.length > 0) {
    const current = queue.shift();
    for (const neighbor of ns.scan(current)) {
      if (seen.has(neighbor)) continue;
      seen.add(neighbor);
      queue.push(neighbor);
    }
  }

  return Array.from(seen);
}

function buildRow(ns, server, totalRam, options, workerRam, formulaContext) {
  const rooted = ns.hasRootAccess(server);
  const maxMoney = ns.getServerMaxMoney(server);
  const money = Math.max(0, ns.getServerMoneyAvailable(server));
  const minSecurity = ns.getServerMinSecurityLevel(server);
  const security = ns.getServerSecurityLevel(server);
  const hackable = rooted && maxMoney > 0 && ns.getServerRequiredHackingLevel(server) <= ns.getHackingLevel();
  const metrics = hackable ? getTargetMetrics(ns, server, formulaContext) : null;
  const batchPlan = metrics ? chooseBestBatchPlan(ns, metrics, totalRam, options, workerRam, formulaContext) : null;

  return {
    server,
    root: rooted,
    requiredLevel: ns.getServerRequiredHackingLevel(server),
    portsRequired: ns.getServerNumPortsRequired(server),
    ram: ns.getServerMaxRam(server),
    money,
    maxMoney,
    security,
    minSecurity,
    prepped: maxMoney > 0
      && money >= maxMoney * options.prepMoneyRatio
      && security <= minSecurity + options.prepSecurityBuffer,
    hackChance: metrics ? metrics.hackChance : 0,
    hackPercent: batchPlan ? batchPlan.hackedFraction : 0,
    hackThreads: batchPlan ? batchPlan.hackThreads : 0,
    totalBatchThreads: batchPlan ? batchPlan.totalThreads : 0,
    expectedMoneyPerSecond: batchPlan ? batchPlan.expectedMoneyPerSecond : 0,
  };
}

function getFormulaContext(ns) {
  try {
    if (!ns.fileExists("Formulas.exe", "home") || !ns.formulas || !ns.formulas.hacking) return { enabled: false, player: null };
    return { enabled: true, player: ns.getPlayer() };
  } catch (_error) {
    return { enabled: false, player: null };
  }
}

function getTargetMetrics(ns, server, formulaContext) {
  const maxMoney = ns.getServerMaxMoney(server);
  const minSecurity = Math.max(1, ns.getServerMinSecurityLevel(server));

  if (formulaContext.enabled) {
    try {
      const formulaServer = ns.getServer(server);
      formulaServer.moneyAvailable = maxMoney;
      formulaServer.moneyMax = maxMoney;
      formulaServer.hackDifficulty = minSecurity;
      formulaServer.minDifficulty = minSecurity;

      return {
        method: "formulas",
        formulaServer,
        maxMoney,
        minSecurity,
        server,
        hackChance: clamp(ns.formulas.hacking.hackChance(formulaServer, formulaContext.player), 0, 1),
        hackPercent: Math.max(0, ns.formulas.hacking.hackPercent(formulaServer, formulaContext.player)),
        weakenTime: Math.max(1, ns.formulas.hacking.weakenTime(formulaServer, formulaContext.player)),
      };
    } catch (_error) {}
  }

  return {
    method: "ns",
    formulaServer: null,
    maxMoney,
    minSecurity,
    server,
    hackChance: clamp(ns.hackAnalyzeChance(server), 0, 1),
    hackPercent: Math.max(0, ns.hackAnalyze(server)),
    weakenTime: Math.max(1, ns.getWeakenTime(server)),
  };
}

function chooseBestBatchPlan(ns, metrics, availableRam, options, workerRam, formulaContext) {
  const maxHackFraction = 1 - options.moneyBuffer;
  if (availableRam <= 0 || workerRam.min <= 0 || metrics.hackPercent <= 0 || metrics.hackChance <= 0) return null;

  const maxHackThreads = Math.floor(maxHackFraction / metrics.hackPercent);
  const weakenPerThread = getWeakenPerThread(ns, formulaContext);
  if (maxHackThreads < 1 || weakenPerThread <= 0) return null;

  const cycleMs = metrics.weakenTime + options.batchGapMs * 3;
  const spacingMs = options.batchGapMs * 4;
  const maxUsefulBatches = Math.max(1, Math.ceil(cycleMs / spacingMs));
  const visited = new Set();
  let bestPlan = null;

  const evaluateHackThreads = (rawThreads) => {
    const hackThreads = Math.floor(rawThreads);
    if (hackThreads < 1 || hackThreads > maxHackThreads || visited.has(hackThreads)) return;
    visited.add(hackThreads);

    const hackedFraction = hackThreads * metrics.hackPercent;
    if (hackedFraction <= 0 || hackedFraction > maxHackFraction + 1e-9) return;
    const moneyAfterHack = Math.max(MIN_MONEY, metrics.maxMoney * (1 - hackedFraction));
    const growThreads = getGrowThreads(ns, metrics, moneyAfterHack, formulaContext);
    if (!Number.isFinite(growThreads) || growThreads < 1) return;

    const hackWeakenThreads = Math.ceil((hackThreads * HACK_SECURITY_PER_THREAD) / weakenPerThread);
    const growWeakenThreads = Math.ceil((growThreads * GROW_SECURITY_PER_THREAD) / weakenPerThread);
    const batchRam = hackThreads * workerRam.hack
      + growThreads * workerRam.grow
      + (hackWeakenThreads + growWeakenThreads) * workerRam.weaken;
    const ramCapacity = Math.floor(availableRam / batchRam);
    if (ramCapacity < 1) return;

    const concurrentBatches = Math.min(ramCapacity, maxUsefulBatches);
    const batchesPerSecond = Math.min(1000 / spacingMs, (concurrentBatches * 1000) / cycleMs);
    const expectedMoneyPerSecond = metrics.maxMoney * hackedFraction * metrics.hackChance * batchesPerSecond;

    if (!bestPlan || expectedMoneyPerSecond > bestPlan.expectedMoneyPerSecond) {
      bestPlan = {
        expectedMoneyPerSecond,
        hackedFraction,
        hackThreads,
        totalThreads: hackThreads + hackWeakenThreads + growThreads + growWeakenThreads,
      };
    }
  };

  for (const hackThreads of buildHackThreadCandidates(maxHackThreads, metrics.hackPercent, maxHackFraction)) {
    evaluateHackThreads(hackThreads);
  }

  if (bestPlan) {
    const start = Math.max(1, bestPlan.hackThreads - 64);
    const end = Math.min(maxHackThreads, bestPlan.hackThreads + 64);
    for (let hackThreads = start; hackThreads <= end; hackThreads += 1) evaluateHackThreads(hackThreads);
  }

  return bestPlan;
}

function buildHackThreadCandidates(maxThreads, hackPercent, maxFraction) {
  const candidates = new Set([1, maxThreads]);
  const exactLimit = Math.min(maxThreads, 128);

  for (let threads = 1; threads <= exactLimit; threads += 1) candidates.add(threads);
  for (let threads = 1; threads <= maxThreads; threads *= 2) candidates.add(threads);
  for (let fraction = 0.005; fraction <= maxFraction + 1e-9; fraction += 0.005) {
    candidates.add(Math.max(1, Math.floor(fraction / hackPercent)));
  }

  return Array.from(candidates).filter((threads) => threads >= 1 && threads <= maxThreads);
}

function getGrowThreads(ns, metrics, startingMoney, formulaContext) {
  if (metrics.method === "formulas" && formulaContext.enabled) {
    try {
      const growServer = Object.assign({}, metrics.formulaServer);
      growServer.moneyAvailable = startingMoney;
      return Math.ceil(ns.formulas.hacking.growThreads(growServer, formulaContext.player, metrics.maxMoney, 1));
    } catch (_error) {}
  }

  return Math.ceil(ns.growthAnalyze(metrics.server, metrics.maxMoney / startingMoney, 1));
}

function getWeakenPerThread(ns, formulaContext) {
  if (formulaContext.enabled) {
    try {
      return ns.formulas.hacking.weakenEffect(1, 1);
    } catch (_error) {}
  }

  return ns.weakenAnalyze(1, 1);
}

function getWorkerRam(ns) {
  const hack = ns.getScriptRam(HACK_WORKER, "home");
  const grow = ns.getScriptRam(GROW_WORKER, "home");
  const weaken = ns.getScriptRam(WEAKEN_WORKER, "home");
  return { hack, grow, weaken, min: Math.min(hack, grow, weaken) };
}

function printReport(ns, rows, totalRam, options, formulaContext, workerRam) {
  const header = [
    padRight("HOST", 22),
    padLeft("ROOT", 4),
    padLeft("LVL", 5),
    padLeft("PORT", 4),
    padLeft("RAM", 8),
    padLeft("MONEY NOW/MAX", 20),
    padLeft("SEC NOW/MIN", 14),
    padLeft("PREP", 5),
    padLeft("HACK%", 7),
    padLeft("HACK T", 6),
    padLeft("BATCH T", 7),
    padLeft("CHANCE", 7),
    padLeft("EXPECTED $/SEC", 16),
  ].join(" ");

  ns.tprint(`[bb:servers] total rooted RAM=${formatRam(totalRam)}; formulas=${formulaContext.enabled ? "yes" : "no"}; worker RAM=${workerRam.min > 0 ? "ready" : "missing"}`);
  ns.tprint(`[bb:servers] scoring assumes max money/min security, ${formatPercent(options.moneyBuffer)} money buffer, and ${options.batchGapMs}ms batch gap.`);
  ns.tprint(header);
  ns.tprint("-".repeat(header.length));

  for (const row of rows) {
    ns.tprint([
      padRight(row.server, 22),
      padLeft(row.root ? "yes" : "no", 4),
      padLeft(row.requiredLevel, 5),
      padLeft(row.portsRequired, 4),
      padLeft(formatRam(row.ram), 8),
      padLeft(`${formatMoney(row.money)}/${formatMoney(row.maxMoney)}`, 20),
      padLeft(`${formatSecurity(row.security)}/${formatSecurity(row.minSecurity)}`, 14),
      padLeft(row.maxMoney > 0 ? (row.prepped ? "yes" : "no") : "-", 5),
      padLeft(row.expectedMoneyPerSecond > 0 ? formatPercent(row.hackPercent) : "-", 7),
      padLeft(row.expectedMoneyPerSecond > 0 ? row.hackThreads : "-", 6),
      padLeft(row.expectedMoneyPerSecond > 0 ? row.totalBatchThreads : "-", 7),
      padLeft(row.expectedMoneyPerSecond > 0 ? formatPercent(row.hackChance) : "-", 7),
      padLeft(row.expectedMoneyPerSecond > 0 ? formatMoney(row.expectedMoneyPerSecond) : "-", 16),
    ].join(" "));
  }
}

function parseMs(value, fallback, minValue) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minValue, Math.round(parsed)) : fallback;
}

function parseNumber(value, fallback, minValue) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minValue, parsed) : fallback;
}

function parseRatio(value, fallback, minValue, maxValue) {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  let parsed = Number(raw.endsWith("%") ? raw.slice(0, -1) : raw);
  if (!Number.isFinite(parsed)) return fallback;
  if (raw.endsWith("%") || parsed > 1) parsed /= 100;
  return clamp(parsed, minValue, maxValue);
}

function clamp(value, minValue, maxValue) {
  return Math.min(maxValue, Math.max(minValue, value));
}

function padLeft(value, width) {
  return String(value).padStart(width);
}

function padRight(value, width) {
  return String(value).padEnd(width);
}

function formatMoney(value) {
  if (!Number.isFinite(value)) return "-";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}t`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}b`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}m`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}k`;
  return `$${Math.floor(value)}`;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatRam(value) {
  return `${value >= 1024 ? (value / 1024).toFixed(1) + "t" : value + "g"}`;
}

function formatSecurity(value) {
  return Number(value).toFixed(2);
}
