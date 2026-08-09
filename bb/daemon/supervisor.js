const CONTEXT_FILE = "/bb/data/context.json";
const EARLY_HACK_DAEMON = "/bb/daemon/early-hack.js";

export async function main(ns) {
  ns.disableLog("ALL");

  const options = parseArgs(ns.args);
  const context = buildContext(ns);
  ns.write(options.context, JSON.stringify(context, null, 2), "w");

  if (!options.quiet) {
    ns.tprint(`[bb] BitNode ${context.bitNode}; source files: ${formatSourceFiles(context.sourceFiles) || "none active"}`);
  }

  if (options.noEarlyHack) {
    ns.tprint("[bb] Early hacking daemon disabled by --no-early-hack.");
    return;
  }

  const daemonArgs = buildEarlyHackArgs(options);
  if (!options.watch) {
    if (ns.scriptRunning(EARLY_HACK_DAEMON, "home")) {
      ns.tprint(`[bb] ${EARLY_HACK_DAEMON} is already running.`);
      return;
    }

    ns.tprint(`[bb] Spawning ${EARLY_HACK_DAEMON}.`);
    ns.spawn(EARLY_HACK_DAEMON, { threads: 1, spawnDelay: 0 }, ...daemonArgs);
  }

  while (true) {
    if (!ns.scriptRunning(EARLY_HACK_DAEMON, "home")) {
      const pid = ns.exec(EARLY_HACK_DAEMON, "home", 1, ...daemonArgs);
      if (pid === 0) {
        ns.print(`[bb] Failed to start ${EARLY_HACK_DAEMON}; waiting for RAM.`);
      } else {
        ns.tprint(`[bb] Started ${EARLY_HACK_DAEMON} with pid ${pid}.`);
      }
    }

    const updatedContext = buildContext(ns);
    ns.write(options.context, JSON.stringify(updatedContext, null, 2), "w");
    await ns.sleep(options.pollMs);
  }
}

function parseArgs(rawArgs) {
  const options = {
    context: CONTEXT_FILE,
    noEarlyHack: false,
    pollMs: 60000,
    quiet: false,
    reserveHome: "auto",
    target: "",
    watch: false,
  };

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = String(rawArgs[i]);
    if (arg === "--context") options.context = String(rawArgs[++i] || CONTEXT_FILE);
    else if (arg === "--no-early-hack") options.noEarlyHack = true;
    else if (arg === "--poll") options.pollMs = parsePollMs(rawArgs[++i], options.pollMs);
    else if (arg === "--quiet") options.quiet = true;
    else if (arg === "--reserve-home") options.reserveHome = String(rawArgs[++i] || "auto");
    else if (arg === "--target") options.target = String(rawArgs[++i] || "");
    else if (arg === "--watch") options.watch = true;
  }

  return options;
}

function buildEarlyHackArgs(options) {
  const args = ["--context", options.context, "--reserve-home", String(options.reserveHome)];
  if (options.target) args.push("--target", options.target);
  if (options.quiet) args.push("--quiet");
  return args;
}

function parsePollMs(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1000, parsed);
}

function buildContext(ns) {
  const resetInfo = readResetInfo(ns);
  const sourceFiles = normalizeOwnedSourceFiles(resetInfo.ownedSF);
  const sourceFileLevels = {};

  for (const sourceFile of sourceFiles) {
    sourceFileLevels[String(sourceFile.n)] = sourceFile.lvl;
  }

  return {
    version: 1,
    createdAt: Date.now(),
    bitNode: resetInfo.currentNode || 1,
    sourceFiles,
    sourceFileLevels,
    capabilities: {
      bitNodeMultipliers: Boolean(sourceFileLevels["5"] || resetInfo.currentNode === 5),
      corporation: Boolean(sourceFileLevels["3"] || resetInfo.currentNode === 3),
      gang: Boolean(sourceFileLevels["2"] || resetInfo.currentNode === 2),
      singularity: Boolean(sourceFileLevels["4"] || resetInfo.currentNode === 4),
      sleeves: Boolean(sourceFileLevels["10"] || resetInfo.currentNode === 10),
    },
  };
}

function readResetInfo(ns) {
  try {
    return ns.getResetInfo();
  } catch (error) {
    ns.tprint(`[bb] Could not read reset info, assuming BitNode 1 with no Source-Files: ${String(error)}`);
    return {
      currentNode: 1,
      ownedSF: new Map(),
    };
  }
}

function normalizeOwnedSourceFiles(ownedSF) {
  const entries = [];

  if (ownedSF instanceof Map) {
    for (const entry of ownedSF.entries()) entries.push(entry);
  } else if (Array.isArray(ownedSF)) {
    for (const value of ownedSF) {
      if (Array.isArray(value)) entries.push(value);
      else if (value && typeof value === "object") entries.push([value.n, value.lvl]);
    }
  } else if (ownedSF && typeof ownedSF === "object") {
    for (const key of Object.keys(ownedSF)) entries.push([key, ownedSF[key]]);
  }

  return entries
    .map(([n, lvl]) => ({ n: Number(n), lvl: Number(lvl) }))
    .filter((sourceFile) => Number.isFinite(sourceFile.n) && Number.isFinite(sourceFile.lvl) && sourceFile.lvl > 0)
    .sort((a, b) => a.n - b.n);
}

function formatSourceFiles(sourceFiles) {
  return sourceFiles.map((sourceFile) => `${sourceFile.n}.${sourceFile.lvl}`).join(", ");
}
