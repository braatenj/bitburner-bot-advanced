const HACK_WORKER = "/bb/workers/hack.js";
const GROW_WORKER = "/bb/workers/grow.js";
const WEAKEN_WORKER = "/bb/workers/weaken.js";
const WORKERS = [HACK_WORKER, GROW_WORKER, WEAKEN_WORKER];
const STATE_FILE = "/bb/data/early-hack-state.json";

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

    const target = chooseTarget(ns, rooted, options.target);
    const action = chooseAction(ns, target);
    const worker = workerForAction(action);
    const launched = deployWork(ns, rooted, worker, target, resolveHomeReserve(ns, options.reserveHome));

    const status = `${action}:${target}:rooted=${rooted.length}:threads=${launched}`;
    if (!options.quiet && status !== lastStatus) {
      ns.tprint(`[bb:hack] ${status}`);
      printManualHints(ns, rooted.length, servers.length);
      lastStatus = status;
    }

    writeState(ns, {
      updatedAt: Date.now(),
      target,
      action,
      knownServers: servers.length,
      rootedServers: rooted.length,
      launchedThreads: launched,
      homeRam: {
        max: ns.getServerMaxRam("home"),
        used: ns.getServerUsedRam("home"),
      },
    });

    await ns.sleep(5000);
  }
}

function parseArgs(rawArgs) {
  const options = {
    context: "/bb/data/context.json",
    quiet: false,
    reserveHome: "auto",
    target: "",
  };

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = String(rawArgs[i]);
    if (arg === "--context") options.context = String(rawArgs[++i] || options.context);
    else if (arg === "--quiet") options.quiet = true;
    else if (arg === "--reserve-home") options.reserveHome = String(rawArgs[++i] || "auto");
    else if (arg === "--target") options.target = String(rawArgs[++i] || "");
  }

  return options;
}

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

function chooseTarget(ns, rootedServers, forcedTarget) {
  if (forcedTarget && canHackForMoney(ns, forcedTarget)) return forcedTarget;

  let bestServer = "n00dles";
  let bestScore = 0;
  const hackingLevel = ns.getHackingLevel();

  for (const server of rootedServers) {
    if (server === "home") continue;
    const maxMoney = ns.getServerMaxMoney(server);
    if (maxMoney <= 0) continue;
    if (ns.getServerRequiredHackingLevel(server) > hackingLevel) continue;

    const minSecurity = Math.max(1, ns.getServerMinSecurityLevel(server));
    const hackTime = Math.max(1, ns.getHackTime(server));
    const score = maxMoney / minSecurity / hackTime;

    if (score > bestScore) {
      bestScore = score;
      bestServer = server;
    }
  }

  return bestServer;
}

function canHackForMoney(ns, server) {
  try {
    return ns.hasRootAccess(server)
      && ns.getServerMaxMoney(server) > 0
      && ns.getServerRequiredHackingLevel(server) <= ns.getHackingLevel();
  } catch (_error) {
    return false;
  }
}

function chooseAction(ns, target) {
  const minSecurity = ns.getServerMinSecurityLevel(target);
  const security = ns.getServerSecurityLevel(target);
  if (security > minSecurity + 5) return "weaken";

  const maxMoney = ns.getServerMaxMoney(target);
  const money = ns.getServerMoneyAvailable(target);
  if (maxMoney <= 0 || money < maxMoney * 0.75) return "grow";

  return "hack";
}

function workerForAction(action) {
  if (action === "hack") return HACK_WORKER;
  if (action === "grow") return GROW_WORKER;
  return WEAKEN_WORKER;
}

function deployWork(ns, rootedServers, worker, target, homeReserve) {
  let launchedThreads = 0;
  const batchId = Date.now();

  for (const host of rootedServers) {
    const maxRam = ns.getServerMaxRam(host);
    if (maxRam <= 0) continue;

    if (host !== "home") ns.scp(WORKERS, host, "home");

    const workerRam = ns.getScriptRam(worker, host);
    if (workerRam <= 0) continue;

    const reserve = host === "home" ? homeReserve : 0;
    const freeRam = Math.max(0, maxRam - ns.getServerUsedRam(host) - reserve);
    const threads = Math.floor(freeRam / workerRam);
    if (threads < 1) continue;

    const pid = ns.exec(worker, host, threads, target, batchId);
    if (pid !== 0) launchedThreads += threads;
  }

  return launchedThreads;
}

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

function printManualHints(ns, rootedCount, knownCount) {
  const missingPrograms = [];
  if (!ns.fileExists("BruteSSH.exe", "home")) missingPrograms.push("BruteSSH.exe");
  if (!ns.fileExists("FTPCrack.exe", "home")) missingPrograms.push("FTPCrack.exe");
  if (!ns.fileExists("relaySMTP.exe", "home")) missingPrograms.push("relaySMTP.exe");
  if (!ns.fileExists("HTTPWorm.exe", "home")) missingPrograms.push("HTTPWorm.exe");
  if (!ns.fileExists("SQLInject.exe", "home")) missingPrograms.push("SQLInject.exe");

  if (missingPrograms.length > 0) {
    ns.tprint(`[bb:hack] Manual unlocks still useful: ${missingPrograms.join(", ")}`);
  }

  if (rootedCount < knownCount) {
    ns.tprint(`[bb:hack] Rooted ${rootedCount}/${knownCount}; buying or creating port programs expands the fleet.`);
  }
}

function writeState(ns, state) {
  ns.write(STATE_FILE, JSON.stringify(state, null, 2), "w");
}
