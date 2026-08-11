const CONTEXT_FILE = "/bb/data/context.json";
const BITNODE_DAEMON_PREFIX = "/bb/daemon/bn";

/**
 * Detects the current BitNode, writes shared runtime context, and hands off to
 * that BitNode's dedicated daemon. The selected daemon owns module startup and
 * receives every launch option unchanged.
 */
export async function main(ns) {
  ns.disableLog("ALL");

  const contextPath = readContextPath(ns.args);
  const context = buildContext(ns);
  ns.write(contextPath, JSON.stringify(context, null, 2), "w");

  const daemon = `${BITNODE_DAEMON_PREFIX}${context.bitNode}.js`;
  if (!ns.fileExists(daemon, "home")) {
    ns.tprint(`[bb] No daemon is installed for BitNode ${context.bitNode}: ${daemon}`);
    return;
  }

  ns.tprint(`[bb] BitNode ${context.bitNode}; source files: ${formatSourceFiles(context.sourceFiles) || "none active"}. Starting ${daemon}.`);
  ns.spawn(daemon, { threads: 1, spawnDelay: 0 }, ...ns.args);
}

function readContextPath(rawArgs) {
  for (let index = 0; index < rawArgs.length; index += 1) {
    if (String(rawArgs[index]) === "--context") return String(rawArgs[index + 1] || CONTEXT_FILE);
  }
  return CONTEXT_FILE;
}

function buildContext(ns) {
  const resetInfo = readResetInfo(ns);
  const sourceFiles = normalizeOwnedSourceFiles(resetInfo.ownedSF);
  const sourceFileLevels = {};
  for (const sourceFile of sourceFiles) sourceFileLevels[String(sourceFile.n)] = sourceFile.lvl;

  return {
    version: 2,
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
    return { currentNode: 1, ownedSF: new Map() };
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
