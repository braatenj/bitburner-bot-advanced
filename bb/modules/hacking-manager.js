/**
 * Reusable early-game hacking module.
 *
 * On each pass it discovers the network, attempts to root every reachable
 * server, and turns unused RAM into either income batches or preparation work.
 * The best available target is used for HWGW batches once it is prepped; until
 * then, RAM is used to weaken and grow it. A separate, unprepped target may be
 * prepared concurrently with the RAM reserved for that purpose.
 *
 * Optional arguments:
 * --target HOST              Prefer HOST when it is an eligible target.
 * --reserve-home GB|auto     RAM withheld on home (default: auto).
 * --batch-gap MS             Completion gap between HWGW operations.
 * --loop-delay MS            Time between scheduling passes.
 * --money-buffer RATIO       Maximum money fraction left after a hack.
 * --prep-money-ratio RATIO   Money threshold for a prepped server.
 * --prep-security-buffer N   Security allowed above the minimum when prepped.
 * --prep-ram-pct RATIO       Fleet RAM reserved for secondary preparation.
 * --prep-ram-min/max GB      Bounds for that preparation reserve.
 * --context PATH             Accepted for supervisor compatibility; unused.
 * --quiet                    Suppress status and manual-unlock hints.
 */
const HACK_WORKER = "/bb/workers/hack.js";
const GROW_WORKER = "/bb/workers/grow.js";
const WEAKEN_WORKER = "/bb/workers/weaken.js";
const WORKERS = [HACK_WORKER, GROW_WORKER, WEAKEN_WORKER];
const CLOUD_HOSTS_STATE_FILE = "/bb/data/cloud-hosts-state.json";
const STATE_FILE = "/bb/data/early-hack-state.json";

const HACK_SECURITY_PER_THREAD = 0.002;
const GROW_SECURITY_PER_THREAD = 0.004;
const MIN_MONEY = 1;

/** Runs the daemon's discovery, scheduling, reporting, and persistence loop. */
export async function main(ns) {
  ns.disableLog("ALL");

  const options = parseArgs(ns.args);
  let lastStatus = "";

  while (true) {
    const servers = scanAllServers(ns);
    const rooted = [];

    for (const server of servers) {
      if (tryRoot(ns, server)) rooted.push(server);
    }

    const homeReserve = resolveHomeReserve(ns, options.reserveHome);
    const fleet = buildFleet(ns, rooted, homeReserve, getDrainingHosts(ns));
    const totalFreeRam = sumFleetRam(fleet);
    const prepReserveRam = resolvePrepRamReserve(totalFreeRam, options);
    const incomeRamBudget = Math.max(0, totalFreeRam - prepReserveRam);
    const formulaContext = getFormulaContext(ns);
    const evaluations = evaluateTargets(ns, rooted, incomeRamBudget, options, formulaContext);
    const primary = choosePrimaryEvaluation(evaluations, options.target);
    const secondary = chooseSecondaryPrepEvaluation(ns, evaluations, primary, options);

    let primaryLaunch = emptyLaunch("primary");
    if (primary && isPrepped(ns, primary.server, options)) {
      primaryLaunch = await scheduleHackBatches(ns, fleet, primary, incomeRamBudget, options);
    } else if (primary) {
      primaryLaunch = await schedulePrep(ns, fleet, rooted, primary.server, incomeRamBudget, options, formulaContext, "primary");
    }

    let secondaryLaunch = emptyLaunch("secondary");
    if (secondary) {
      secondaryLaunch = await schedulePrep(ns, fleet, rooted, secondary.server, sumFleetRam(fleet), options, formulaContext, "secondary");
    }

    const status = buildStatus(rooted, servers, totalFreeRam, prepReserveRam, formulaContext, primary, secondary, primaryLaunch, secondaryLaunch);
    if (!options.quiet && status !== lastStatus) {
      ns.print(`[bb:hack] ${status}`);
      printManualHints(ns, rooted.length, servers.length);
      lastStatus = status;
    }

    writeState(ns, {
      updatedAt: Date.now(),
      formulas: formulaContext.enabled,
      knownServers: servers.length,
      rootedServers: rooted.length,
      ram: {
        freeGb: roundRam(totalFreeRam),
        incomeBudgetGb: roundRam(incomeRamBudget),
        prepReserveGb: roundRam(prepReserveRam),
        homeReserveGb: roundRam(homeReserve),
        homeMaxGb: ns.getServerMaxRam("home"),
        homeUsedGb: roundRam(ns.getServerUsedRam("home")),
      },
      primary: summarizeEvaluation(primary),
      secondaryPrep: summarizeEvaluation(secondary),
      launched: {
        primary: primaryLaunch,
        secondary: secondaryLaunch,
      },
      topTargets: evaluations.slice(0, 10).map(summarizeEvaluation),
      options: summarizeOptions(options),
    });

    await ns.sleep(options.loopDelayMs);
  }
}

/** Parses daemon flags and normalizes bounded numeric values. */
function parseArgs(rawArgs) {
  const options = {
    batchGapMs: 1000,
    context: "/bb/data/context.json",
    loopDelayMs: 5000,
    moneyBuffer: 0.1,
    prepMoneyRatio: 0.99,
    prepRamMax: 64,
    prepRamMin: 0,
    prepRamPct: 0.1,
    prepSecurityBuffer: 0.05,
    quiet: false,
    reserveHome: "auto",
    target: "",
  };

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = String(rawArgs[i]);
    if (arg === "--batch-gap") options.batchGapMs = parseMs(rawArgs[++i], options.batchGapMs, 100);
    else if (arg === "--context") options.context = String(rawArgs[++i] || options.context);
    else if (arg === "--loop-delay") options.loopDelayMs = parseMs(rawArgs[++i], options.loopDelayMs, 1000);
    else if (arg === "--money-buffer") options.moneyBuffer = parseRatio(rawArgs[++i], options.moneyBuffer, 0, 0.95);
    else if (arg === "--prep-money-ratio") options.prepMoneyRatio = parseRatio(rawArgs[++i], options.prepMoneyRatio, 0.01, 1);
    else if (arg === "--prep-ram-max") options.prepRamMax = parseNumber(rawArgs[++i], options.prepRamMax, 0, Number.MAX_SAFE_INTEGER);
    else if (arg === "--prep-ram-min") options.prepRamMin = parseNumber(rawArgs[++i], options.prepRamMin, 0, Number.MAX_SAFE_INTEGER);
    else if (arg === "--prep-ram-pct") options.prepRamPct = parseRatio(rawArgs[++i], options.prepRamPct, 0, 1);
    else if (arg === "--prep-security-buffer") options.prepSecurityBuffer = parseNumber(rawArgs[++i], options.prepSecurityBuffer, 0, Number.MAX_SAFE_INTEGER);
    else if (arg === "--quiet") options.quiet = true;
    else if (arg === "--reserve-home") options.reserveHome = String(rawArgs[++i] || "auto");
    else if (arg === "--target") options.target = String(rawArgs[++i] || "");
  }

  if (options.prepRamMin > options.prepRamMax) {
    const previousMin = options.prepRamMin;
    options.prepRamMin = options.prepRamMax;
    options.prepRamMax = previousMin;
  }

  return options;
}

/** Converts a value to a whole number of milliseconds, or returns the fallback. */
function parseMs(value, fallback, minValue) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minValue, Math.round(parsed));
}

/** Converts a value to a finite number constrained to the supplied range. */
function parseNumber(value, fallback, minValue, maxValue) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, minValue, maxValue);
}

/** Parses a decimal or percentage string and constrains it to a ratio range. */
function parseRatio(value, fallback, minValue, maxValue) {
  const raw = String(value || "").trim();
  if (!raw) return fallback;

  let parsed = Number(raw.endsWith("%") ? raw.slice(0, -1) : raw);
  if (!Number.isFinite(parsed)) return fallback;
  if (raw.endsWith("%") || parsed > 1) parsed /= 100;
  return clamp(parsed, minValue, maxValue);
}

/** Breadth-first scans the network from home and returns each discovered host once. */
function scanAllServers(ns) {
  const seen = new Set(["home"]);
  const queue = ["home"];

  for (let i = 0; i < queue.length; i += 1) {
    const host = queue[i];
    for (const next of ns.scan(host)) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }

  return queue;
}

/** Opens every available port on a server, nukes it when possible, and reports root access. */
function tryRoot(ns, server) {
  if (server === "home" || ns.hasRootAccess(server)) return true;

  let opened = 0;
  if (ns.fileExists("BruteSSH.exe", "home")) {
    opened += 1;
    try {
      ns.brutessh(server);
    } catch (_error) {}
  }
  if (ns.fileExists("FTPCrack.exe", "home")) {
    opened += 1;
    try {
      ns.ftpcrack(server);
    } catch (_error) {}
  }
  if (ns.fileExists("relaySMTP.exe", "home")) {
    opened += 1;
    try {
      ns.relaysmtp(server);
    } catch (_error) {}
  }
  if (ns.fileExists("HTTPWorm.exe", "home")) {
    opened += 1;
    try {
      ns.httpworm(server);
    } catch (_error) {}
  }
  if (ns.fileExists("SQLInject.exe", "home")) {
    opened += 1;
    try {
      ns.sqlinject(server);
    } catch (_error) {}
  }

  if (opened >= ns.getServerNumPortsRequired(server)) {
    try {
      ns.nuke(server);
    } catch (_error) {}
  }

  return ns.hasRootAccess(server);
}

/** Builds a RAM-sorted list of eligible execution hosts, excluding draining machines. */
function buildFleet(ns, rootedServers, homeReserve, drainingHosts) {
  const fleet = [];

  for (const host of rootedServers) {
    if (drainingHosts.has(host)) continue;
    const maxRam = ns.getServerMaxRam(host);
    if (maxRam <= 0) continue;

    const reserve = host === "home" ? homeReserve : 0;
    const freeRam = Math.max(0, maxRam - ns.getServerUsedRam(host) - reserve);
    if (freeRam > 0) {
      fleet.push({
        host,
        freeRam,
        maxRam,
      });
    }
  }

  fleet.sort((a, b) => {
    if (a.host === "home" && b.host !== "home") return 1;
    if (a.host !== "home" && b.host === "home") return -1;
    return b.freeRam - a.freeRam;
  });

  return fleet;
}

/** Reads cloud-host state and returns hosts that should receive no new work. */
function getDrainingHosts(ns) {
  try {
    const state = JSON.parse(ns.read(CLOUD_HOSTS_STATE_FILE));
    return state.drainingHost ? new Set([String(state.drainingHost)]) : new Set();
  } catch (_error) {
    return new Set();
  }
}

/** Returns the currently schedulable free RAM across the fleet. */
function sumFleetRam(fleet) {
  return fleet.reduce((total, host) => total + host.freeRam, 0);
}

/** Calculates the bounded portion of fleet RAM reserved for secondary preparation. */
function resolvePrepRamReserve(totalFreeRam, options) {
  if (totalFreeRam <= 0) return 0;

  const boundedReserve = clamp(totalFreeRam * options.prepRamPct, options.prepRamMin, options.prepRamMax);
  return Math.min(totalFreeRam, boundedReserve);
}

/** Detects Formulas.exe support and captures the player data needed by formula calls. */
function getFormulaContext(ns) {
  try {
    if (!ns.fileExists("Formulas.exe", "home")) return { enabled: false, player: null };
    if (!ns.formulas || !ns.formulas.hacking) return { enabled: false, player: null };
    return { enabled: true, player: ns.getPlayer() };
  } catch (_error) {
    return { enabled: false, player: null };
  }
}

/** Scores every eligible rooted server by its best expected batch income per second. */
function evaluateTargets(ns, rootedServers, availableRam, options, formulaContext) {
  const workerRam = getWorkerRam(ns);
  const hackingLevel = ns.getHackingLevel();
  const evaluations = [];

  if (workerRam.min <= 0) return evaluations;

  for (const server of rootedServers) {
    if (server === "home") continue;
    if (!canHackForMoney(ns, server, hackingLevel)) continue;

    const metrics = getTargetMetrics(ns, server, formulaContext);
    if (!metrics) continue;

    const batchPlan = chooseBestBatchPlan(ns, metrics, availableRam, options, workerRam, formulaContext);
    if (!batchPlan) continue;

    evaluations.push({
      server,
      batchPlan,
      expectedMoneyPerSecond: batchPlan.expectedMoneyPerSecond,
      formulas: metrics.method === "formulas",
      hackChance: metrics.hackChance,
      hackTimeMs: metrics.hackTime,
      growTimeMs: metrics.growTime,
      weakenTimeMs: metrics.weakenTime,
      maxMoney: metrics.maxMoney,
      minSecurity: metrics.minSecurity,
      prepped: isPrepped(ns, server, options),
      requiredHackingLevel: ns.getServerRequiredHackingLevel(server),
    });
  }

  evaluations.sort((a, b) => b.expectedMoneyPerSecond - a.expectedMoneyPerSecond);
  return evaluations;
}

/** Returns whether a server is rooted, valuable, and within the current hacking level. */
function canHackForMoney(ns, server, hackingLevel) {
  try {
    return ns.hasRootAccess(server)
      && ns.getServerMaxMoney(server) > 0
      && ns.getServerRequiredHackingLevel(server) <= hackingLevel;
  } catch (_error) {
    return false;
  }
}

/**
 * Gets ideal (max-money, minimum-security) target metrics.
 * Uses Formulas.exe when present, then safely falls back to standard Netscript
 * analysis APIs.
 */
function getTargetMetrics(ns, server, formulaContext) {
  const maxMoney = ns.getServerMaxMoney(server);
  const minSecurity = Math.max(1, ns.getServerMinSecurityLevel(server));
  if (maxMoney <= 0) return null;

  if (formulaContext.enabled) {
    try {
      const formulaServer = ns.getServer(server);
      formulaServer.moneyAvailable = maxMoney;
      formulaServer.moneyMax = maxMoney;
      formulaServer.hackDifficulty = minSecurity;
      formulaServer.minDifficulty = minSecurity;

      const hacking = ns.formulas.hacking;
      return {
        method: "formulas",
        formulaServer,
        maxMoney,
        minSecurity,
        server,
        hackChance: clamp(hacking.hackChance(formulaServer, formulaContext.player), 0, 1),
        hackPercent: Math.max(0, hacking.hackPercent(formulaServer, formulaContext.player)),
        hackTime: Math.max(1, hacking.hackTime(formulaServer, formulaContext.player)),
        growTime: Math.max(1, hacking.growTime(formulaServer, formulaContext.player)),
        weakenTime: Math.max(1, hacking.weakenTime(formulaServer, formulaContext.player)),
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
    hackTime: Math.max(1, ns.getHackTime(server)),
    growTime: Math.max(1, ns.getGrowTime(server)),
    weakenTime: Math.max(1, ns.getWeakenTime(server)),
  };
}

/** Searches practical hack thread counts and returns the highest-throughput HWGW plan. */
function chooseBestBatchPlan(ns, metrics, availableRam, options, workerRam, formulaContext) {
  const maxHackFraction = 1 - options.moneyBuffer;
  const hackPercent = metrics.hackPercent;
  if (availableRam <= 0 || maxHackFraction <= 0 || hackPercent <= 0 || metrics.hackChance <= 0) return null;

  const maxHackThreads = Math.floor(maxHackFraction / hackPercent);
  if (maxHackThreads < 1) return null;

  const weakenPerThread = getWeakenPerThread(ns, formulaContext);
  if (weakenPerThread <= 0) return null;

  const cycleMs = metrics.weakenTime + options.batchGapMs * 3;
  const spacingMs = options.batchGapMs * 4;
  const maxUsefulBatches = Math.max(1, Math.ceil(cycleMs / spacingMs));
  const candidates = buildHackThreadCandidates(maxHackThreads, hackPercent, maxHackFraction);
  const visited = new Set();
  let bestPlan = null;

  const evaluateHackThreads = (rawThreads) => {
    const hackThreads = Math.floor(rawThreads);
    if (hackThreads < 1 || hackThreads > maxHackThreads || visited.has(hackThreads)) return;
    visited.add(hackThreads);

    const hackedFraction = hackThreads * hackPercent;
    if (hackedFraction <= 0 || hackedFraction > maxHackFraction + 1e-9) return;

    const moneyAfterHack = Math.max(MIN_MONEY, metrics.maxMoney * (1 - hackedFraction));
    const growThreads = Math.max(1, getGrowThreadsForMoney(ns, metrics, moneyAfterHack, metrics.maxMoney, formulaContext));
    if (!Number.isFinite(growThreads)) return;

    const hackWeakenThreads = Math.ceil((hackThreads * HACK_SECURITY_PER_THREAD) / weakenPerThread);
    const growWeakenThreads = Math.ceil((growThreads * GROW_SECURITY_PER_THREAD) / weakenPerThread);
    const batchRam = hackThreads * workerRam.hack
      + growThreads * workerRam.grow
      + (hackWeakenThreads + growWeakenThreads) * workerRam.weaken;
    if (!Number.isFinite(batchRam) || batchRam <= 0) return;

    const batchCapacity = Math.floor(availableRam / batchRam);
    if (batchCapacity < 1) return;

    const concurrentBatches = Math.min(batchCapacity, maxUsefulBatches);
    const batchesPerSecond = Math.min(1000 / spacingMs, (concurrentBatches * 1000) / cycleMs);
    const expectedMoney = metrics.maxMoney * hackedFraction * metrics.hackChance;
    const expectedMoneyPerSecond = expectedMoney * batchesPerSecond;

    if (!bestPlan || expectedMoneyPerSecond > bestPlan.expectedMoneyPerSecond) {
      bestPlan = {
        batchesPerSecond,
        batchRam,
        concurrentBatches,
        cycleMs,
        expectedMoney,
        expectedMoneyPerSecond,
        growThreads,
        growWeakenThreads,
        hackedFraction,
        hackThreads,
        hackWeakenThreads,
        maxUsefulBatches,
        spacingMs,
        totalThreads: hackThreads + growThreads + hackWeakenThreads + growWeakenThreads,
      };
    }
  };

  for (const hackThreads of candidates) evaluateHackThreads(hackThreads);

  if (bestPlan) {
    const start = Math.max(1, bestPlan.hackThreads - 64);
    const end = Math.min(maxHackThreads, bestPlan.hackThreads + 64);
    for (let hackThreads = start; hackThreads <= end; hackThreads += 1) evaluateHackThreads(hackThreads);
  }

  return bestPlan;
}

/** Creates a compact, representative set of hack-thread counts for plan optimization. */
function buildHackThreadCandidates(maxHackThreads, hackPercent, maxHackFraction) {
  const candidates = new Set([1, maxHackThreads]);
  const exactLimit = Math.min(maxHackThreads, 128);

  for (let threads = 1; threads <= exactLimit; threads += 1) candidates.add(threads);
  for (let threads = 1; threads <= maxHackThreads; threads *= 2) candidates.add(threads);
  for (let fraction = 0.005; fraction <= maxHackFraction + 1e-9; fraction += 0.005) {
    candidates.add(Math.max(1, Math.floor(fraction / hackPercent)));
  }

  return Array.from(candidates)
    .filter((threads) => threads >= 1 && threads <= maxHackThreads)
    .sort((a, b) => a - b);
}

/** Calculates grow threads required to restore a server from startingMoney to targetMoney. */
function getGrowThreadsForMoney(ns, metrics, startingMoney, targetMoney, formulaContext) {
  if (targetMoney <= startingMoney) return 0;

  if (metrics.method === "formulas" && formulaContext.enabled) {
    try {
      const growServer = Object.assign({}, metrics.formulaServer);
      growServer.moneyAvailable = Math.max(MIN_MONEY, startingMoney);
      growServer.moneyMax = targetMoney;
      growServer.hackDifficulty = metrics.minSecurity;
      growServer.minDifficulty = metrics.minSecurity;
      return Math.ceil(ns.formulas.hacking.growThreads(growServer, formulaContext.player, targetMoney, 1));
    } catch (_error) {}
  }

  const multiplier = targetMoney / Math.max(MIN_MONEY, startingMoney);
  return Math.ceil(ns.growthAnalyze(metrics.server || "", Math.max(1, multiplier), 1));
}

/** Selects a valid forced target when possible; otherwise returns the highest-scoring target. */
function choosePrimaryEvaluation(evaluations, forcedTarget) {
  if (forcedTarget) {
    const forced = evaluations.find((evaluation) => evaluation.server === forcedTarget);
    if (forced) return forced;
  }

  return evaluations[0] || null;
}

/** Returns the best unprepped target other than the primary for background preparation. */
function chooseSecondaryPrepEvaluation(ns, evaluations, primary, options) {
  for (const evaluation of evaluations) {
    if (primary && evaluation.server === primary.server) continue;
    if (isPrepped(ns, evaluation.server, options)) continue;
    return evaluation;
  }

  return null;
}

/** Schedules complete, time-spaced HWGW batches for the primary prepped target. */
async function scheduleHackBatches(ns, fleet, evaluation, budgetRam, options) {
  const target = evaluation.server;
  const plan = evaluation.batchPlan;
  const requestedBatches = Math.min(plan.concurrentBatches, Math.floor(budgetRam / plan.batchRam));
  const budget = { remaining: budgetRam };
  const launched = {
    label: "primary",
    mode: "batch",
    target,
    requestedBatches,
    launchedBatches: 0,
    launchedProcesses: 0,
    launchedThreads: 0,
    ramUsedGb: 0,
  };

  for (let batchIndex = 0; batchIndex < requestedBatches; batchIndex += 1) {
    const batchId = `${Date.now()}-${batchIndex}-${target}`;
    const finishBase = plan.cycleMs - options.batchGapMs * 3 + batchIndex * plan.spacingMs;
    const tasks = [
      {
        worker: HACK_WORKER,
        threads: plan.hackThreads,
        additionalMsec: finishBase - evaluation.hackTimeMs,
      },
      {
        worker: WEAKEN_WORKER,
        threads: plan.hackWeakenThreads,
        additionalMsec: finishBase + options.batchGapMs - evaluation.weakenTimeMs,
      },
      {
        worker: GROW_WORKER,
        threads: plan.growThreads,
        additionalMsec: finishBase + options.batchGapMs * 2 - evaluation.growTimeMs,
      },
      {
        worker: WEAKEN_WORKER,
        threads: plan.growWeakenThreads,
        additionalMsec: finishBase + options.batchGapMs * 3 - evaluation.weakenTimeMs,
      },
    ];

    let completedBatch = true;
    for (const task of tasks) {
      const result = await deployTask(ns, fleet, task.worker, target, task.threads, batchId, task.additionalMsec, budget);
      launched.launchedProcesses += result.processes;
      launched.launchedThreads += result.threads;
      launched.ramUsedGb += result.ramUsed;
      if (result.threads < task.threads) {
        completedBatch = false;
        break;
      }
    }

    if (!completedBatch) break;
    launched.launchedBatches += 1;
  }

  launched.ramUsedGb = roundRam(launched.ramUsedGb);
  return launched;
}

/** Schedules a full or partial weaken/grow preparation cycle within a RAM budget. */
async function schedulePrep(ns, fleet, rootedServers, target, budgetRam, options, formulaContext, label) {
  const budget = { remaining: Math.max(0, budgetRam) };
  const plan = buildPrepPlan(ns, target, budget.remaining, options, formulaContext);
  const launched = {
    label,
    mode: "prep",
    target,
    requestedTasks: plan.tasks.length,
    launchedProcesses: 0,
    launchedThreads: 0,
    ramUsedGb: 0,
    status: plan.status,
  };

  if (plan.status === "full-cycle" && hasActiveFullPrepBatch(ns, rootedServers, target)) {
    launched.status = "waiting-for-full-cycle";
    return launched;
  }

  const batchType = plan.status === "full-cycle" ? "prep-full" : "prep-partial";
  const batchId = `${batchType}-${label}-${Date.now()}-${target}`;
  for (const task of plan.tasks) {
    const result = await deployTask(ns, fleet, task.worker, target, task.threads, batchId, task.additionalMsec, budget);
    launched.launchedProcesses += result.processes;
    launched.launchedThreads += result.threads;
    launched.ramUsedGb += result.ramUsed;
  }

  launched.ramUsedGb = roundRam(launched.ramUsedGb);
  return launched;
}

/** Detects an in-flight full preparation cycle so the daemon does not duplicate it. */
function hasActiveFullPrepBatch(ns, rootedServers, target) {
  for (const host of rootedServers) {
    for (const process of ns.ps(host)) {
      if (String(process.args[0] || "") !== target) continue;
      if (String(process.args[1] || "").startsWith("prep-full-")) return true;
    }
  }

  return false;
}

/**
 * Produces the most useful preparation tasks that fit the budget.
 * Priority is security reduction, followed by a grow plus its compensating
 * weaken; if neither paired operation fits, it falls back to grow alone.
 */
function buildPrepPlan(ns, target, budgetRam, options, formulaContext) {
  if (budgetRam <= 0) return { status: "no-ram", tasks: [] };

  const workerRam = getWorkerRam(ns);
  const metrics = getTargetMetrics(ns, target, formulaContext);
  if (!metrics) return { status: "not-hackable", tasks: [] };
  if (workerRam.min <= 0) return { status: "missing-workers", tasks: [] };

  const maxMoney = ns.getServerMaxMoney(target);
  const currentMoney = Math.max(0, ns.getServerMoneyAvailable(target));
  const minSecurity = ns.getServerMinSecurityLevel(target);
  const currentSecurity = ns.getServerSecurityLevel(target);
  const weakenPerThread = getWeakenPerThread(ns, formulaContext);
  if (weakenPerThread <= 0) return { status: "weaken-analysis-failed", tasks: [] };

  const securityToWeaken = Math.max(0, currentSecurity - minSecurity - options.prepSecurityBuffer);
  const desiredFirstWeakenThreads = Math.ceil(securityToWeaken / weakenPerThread);
  const needsGrow = maxMoney > 0 && currentMoney < maxMoney * options.prepMoneyRatio;
  const analyzedGrowThreads = needsGrow
    ? getGrowThreadsForMoney(ns, metrics, Math.max(MIN_MONEY, currentMoney), maxMoney, formulaContext)
    : 0;
  if (!Number.isFinite(analyzedGrowThreads)) return { status: "grow-analysis-failed", tasks: [] };

  const desiredGrowThreads = needsGrow
    ? Math.max(1, analyzedGrowThreads)
    : 0;
  const desiredSecondWeakenThreads = Math.ceil((desiredGrowThreads * GROW_SECURITY_PER_THREAD) / weakenPerThread);
  const fullRam = desiredFirstWeakenThreads * workerRam.weaken
    + desiredGrowThreads * workerRam.grow
    + desiredSecondWeakenThreads * workerRam.weaken;

  if (desiredFirstWeakenThreads === 0 && desiredGrowThreads === 0) {
    return { status: "already-prepped", tasks: [] };
  }

  if (fullRam <= budgetRam) {
    return {
      status: "full-cycle",
      tasks: buildPrepTasks(desiredFirstWeakenThreads, desiredGrowThreads, desiredSecondWeakenThreads, metrics, options),
    };
  }

  if (desiredFirstWeakenThreads > 0) {
    const weakenThreads = Math.min(desiredFirstWeakenThreads, Math.floor(budgetRam / workerRam.weaken));
    if (weakenThreads < 1) return { status: "insufficient-ram", tasks: [] };

    return {
      status: "partial-weaken",
      tasks: buildPrepTasks(weakenThreads, 0, 0, metrics, options),
    };
  }

  const growThreads = findGrowThreadsForBudget(desiredGrowThreads, budgetRam, workerRam, weakenPerThread);
  if (growThreads > 0) {
    const secondWeakenThreads = Math.ceil((growThreads * GROW_SECURITY_PER_THREAD) / weakenPerThread);
    return {
      status: growThreads === desiredGrowThreads ? "grow-cycle" : "partial-grow-cycle",
      tasks: buildPrepTasks(0, growThreads, secondWeakenThreads, metrics, options),
    };
  }

  const fallbackGrowThreads = Math.min(desiredGrowThreads, Math.floor(budgetRam / workerRam.grow));
  return {
    status: fallbackGrowThreads > 0 ? "grow-only" : "insufficient-ram",
    tasks: fallbackGrowThreads > 0 ? buildPrepTasks(0, fallbackGrowThreads, 0, metrics, options) : [],
  };
}

/** Builds ordered prep tasks whose delays make weaken, grow, then weaken finish in sequence. */
function buildPrepTasks(firstWeakenThreads, growThreads, secondWeakenThreads, metrics, options) {
  const tasks = [];
  const hasGrow = growThreads > 0;
  const hasFirstWeaken = firstWeakenThreads > 0;
  const baseFinish = hasFirstWeaken ? metrics.weakenTime : Math.max(metrics.weakenTime, metrics.growTime);

  if (hasFirstWeaken) {
    tasks.push({
      kind: "weaken-1",
      worker: WEAKEN_WORKER,
      threads: firstWeakenThreads,
      additionalMsec: 0,
    });
  }

  if (hasGrow) {
    tasks.push({
      kind: "grow",
      worker: GROW_WORKER,
      threads: growThreads,
      additionalMsec: baseFinish + (hasFirstWeaken ? options.batchGapMs : 0) - metrics.growTime,
    });
  }

  if (secondWeakenThreads > 0) {
    tasks.push({
      kind: "weaken-2",
      worker: WEAKEN_WORKER,
      threads: secondWeakenThreads,
      additionalMsec: baseFinish + (hasFirstWeaken ? options.batchGapMs * 2 : options.batchGapMs) - metrics.weakenTime,
    });
  }

  return tasks;
}

/** Uses binary search to find the largest grow-and-compensating-weaken pair within budget. */
function findGrowThreadsForBudget(desiredGrowThreads, budgetRam, workerRam, weakenPerThread) {
  let low = 0;
  let high = desiredGrowThreads;

  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const weakenThreads = Math.ceil((mid * GROW_SECURITY_PER_THREAD) / weakenPerThread);
    const ram = mid * workerRam.grow + weakenThreads * workerRam.weaken;
    if (ram <= budgetRam) low = mid;
    else high = mid - 1;
  }

  return low;
}

/**
 * Distributes one worker task across the free fleet RAM, copying worker scripts
 * as needed. Mutates both fleet free RAM and the shared scheduling budget.
 */
async function deployTask(ns, fleet, worker, target, requestedThreads, batchId, additionalMsec, budget) {
  const workerRam = ns.getScriptRam(worker, "home");
  const result = {
    processes: 0,
    ramUsed: 0,
    threads: 0,
  };

  if (workerRam <= 0 || requestedThreads < 1 || budget.remaining < workerRam) return result;

  let remainingThreads = requestedThreads;
  for (const host of fleet) {
    if (remainingThreads <= 0 || budget.remaining < workerRam) break;

    const spendableRam = Math.min(host.freeRam, budget.remaining);
    const threads = Math.min(remainingThreads, Math.floor(spendableRam / workerRam));
    if (threads < 1) continue;

    if (host.host !== "home") {
      const copied = await ns.scp(WORKERS, host.host, "home");
      if (!copied) continue;
    }

    const pid = ns.exec(worker, host.host, threads, target, batchId, Math.max(0, Math.round(additionalMsec)));
    if (pid === 0) continue;

    const usedRam = threads * workerRam;
    host.freeRam = Math.max(0, host.freeRam - usedRam);
    budget.remaining = Math.max(0, budget.remaining - usedRam);
    remainingThreads -= threads;
    result.processes += 1;
    result.ramUsed += usedRam;
    result.threads += threads;
  }

  return result;
}

/** Reads RAM costs for the three worker scripts and exposes their minimum as a readiness check. */
function getWorkerRam(ns) {
  const hack = ns.getScriptRam(HACK_WORKER, "home");
  const grow = ns.getScriptRam(GROW_WORKER, "home");
  const weaken = ns.getScriptRam(WEAKEN_WORKER, "home");

  return {
    grow,
    hack,
    weaken,
    min: Math.min(hack, grow, weaken),
  };
}

/** Returns security reduction for one weaken thread, preferring formula precision. */
function getWeakenPerThread(ns, formulaContext) {
  if (formulaContext.enabled) {
    try {
      return ns.formulas.hacking.weakenEffect(1, 1);
    } catch (_error) {}
  }

  return ns.weakenAnalyze(1, 1);
}

/** Returns whether a target meets the configured money and security preparation thresholds. */
function isPrepped(ns, server, options) {
  try {
    const maxMoney = ns.getServerMaxMoney(server);
    const money = ns.getServerMoneyAvailable(server);
    const minSecurity = ns.getServerMinSecurityLevel(server);
    const security = ns.getServerSecurityLevel(server);

    return maxMoney > 0
      && money >= maxMoney * options.prepMoneyRatio
      && security <= minSecurity + options.prepSecurityBuffer;
  } catch (_error) {
    return false;
  }
}

/** Resolves explicit home RAM reserve or chooses a conservative reserve by home size. */
function resolveHomeReserve(ns, reserveHome) {
  if (reserveHome !== "auto") {
    const value = Number(reserveHome);
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  const homeRam = ns.getServerMaxRam("home");
  if (homeRam <= 8) return 0;
  if (homeRam <= 32) return 4;
  if (homeRam <= 128) return 16;
  return 32;
}

/** Formats the concise status line printed when the daemon state changes. */
function buildStatus(rooted, servers, freeRam, prepReserveRam, formulaContext, primary, secondary, primaryLaunch, secondaryLaunch) {
  const target = primary ? primary.server : "none";
  const secondaryTarget = secondary ? secondary.server : "none";
  const mps = primary ? formatMoney(primary.expectedMoneyPerSecond) : "$0";

  return [
    `primary=${target}`,
    `mps=${mps}/s`,
    `mode=${primaryLaunch.mode}`,
    `batches=${primaryLaunch.launchedBatches || 0}/${primaryLaunch.requestedBatches || 0}`,
    `secondary=${secondaryTarget}`,
    `prepThreads=${secondaryLaunch.launchedThreads || 0}`,
    `ram=${roundRam(freeRam)}GB`,
    `prepReserve=${roundRam(prepReserveRam)}GB`,
    `rooted=${rooted.length}/${servers.length}`,
    `formulas=${formulaContext.enabled ? "yes" : "no"}`,
  ].join(" ");
}

/** Creates a no-work launch summary with the same shape as scheduler results. */
function emptyLaunch(label) {
  return {
    label,
    mode: "idle",
    target: "",
    launchedProcesses: 0,
    launchedThreads: 0,
    ramUsedGb: 0,
  };
}

/** Reduces a target evaluation to stable, human-readable state-file fields. */
function summarizeEvaluation(evaluation) {
  if (!evaluation) return null;

  return {
    server: evaluation.server,
    expectedMoneyPerSecond: Math.round(evaluation.expectedMoneyPerSecond),
    prepped: evaluation.prepped,
    hackChance: roundRatio(evaluation.hackChance),
    hackPercent: roundRatio(evaluation.batchPlan.hackedFraction),
    hackThreads: evaluation.batchPlan.hackThreads,
    growThreads: evaluation.batchPlan.growThreads,
    hackWeakenThreads: evaluation.batchPlan.hackWeakenThreads,
    growWeakenThreads: evaluation.batchPlan.growWeakenThreads,
    concurrentBatches: evaluation.batchPlan.concurrentBatches,
    batchRamGb: roundRam(evaluation.batchPlan.batchRam),
    maxMoney: Math.round(evaluation.maxMoney),
    minSecurity: roundRatio(evaluation.minSecurity),
    requiredHackingLevel: evaluation.requiredHackingLevel,
  };
}

/** Selects the effective scheduling options persisted in the state file. */
function summarizeOptions(options) {
  return {
    batchGapMs: options.batchGapMs,
    loopDelayMs: options.loopDelayMs,
    moneyBuffer: options.moneyBuffer,
    prepMoneyRatio: options.prepMoneyRatio,
    prepRamMax: options.prepRamMax,
    prepRamMin: options.prepRamMin,
    prepRamPct: options.prepRamPct,
    prepSecurityBuffer: options.prepSecurityBuffer,
    reserveHome: options.reserveHome,
    target: options.target,
  };
}

/** Formats a numeric currency value using compact game-friendly units. */
function formatMoney(value) {
  if (!Number.isFinite(value)) return "$0";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `$${(value / 1e12).toFixed(2)}t`;
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}b`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(2)}m`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(2)}k`;
  return `$${value.toFixed(0)}`;
}

/** Rounds RAM values to two decimal places for output. */
function roundRam(value) {
  return Math.round(value * 100) / 100;
}

/** Rounds ratios and security values to four decimal places for output. */
function roundRatio(value) {
  return Math.round(value * 10000) / 10000;
}

/** Restricts a numeric value to an inclusive range. */
function clamp(value, minValue, maxValue) {
  return Math.min(maxValue, Math.max(minValue, value));
}

/** Prints actionable reminders about missing port crackers and unreached hosts. */
function printManualHints(ns, rootedCount, knownCount) {
  const missingPrograms = [];
  if (!ns.fileExists("BruteSSH.exe", "home")) missingPrograms.push("BruteSSH.exe");
  if (!ns.fileExists("FTPCrack.exe", "home")) missingPrograms.push("FTPCrack.exe");
  if (!ns.fileExists("relaySMTP.exe", "home")) missingPrograms.push("relaySMTP.exe");
  if (!ns.fileExists("HTTPWorm.exe", "home")) missingPrograms.push("HTTPWorm.exe");
  if (!ns.fileExists("SQLInject.exe", "home")) missingPrograms.push("SQLInject.exe");

  if (missingPrograms.length > 0) {
    ns.print(`[bb:hack] Manual unlocks still useful: ${missingPrograms.join(", ")}`);
  }

  if (rootedCount < knownCount) {
    ns.print(`[bb:hack] Rooted ${rootedCount}/${knownCount}; buying or creating port programs expands the fleet.`);
  }
}

/** Replaces the daemon's JSON state snapshot for other scripts and dashboards. */
function writeState(ns, state) {
  ns.write(STATE_FILE, JSON.stringify(state, null, 2), "w");
}
