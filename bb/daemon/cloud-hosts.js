const STATE_FILE = "/bb/data/cloud-hosts-state.json";
const SERVER_PREFIX = "bb-cloud-";
const MAX_SERVER_RAM = 2 ** 20;

export async function main(ns) {
  ns.disableLog("ALL");

  const options = parseArgs(ns.args);
  let lastStatus = "";

  while (true) {
    const result = manageCloudHosts(ns, options);
    writeState(ns, result, options);

    const status = buildStatus(result);
    if (!options.quiet && status !== lastStatus) {
      ns.tprint(`[bb:cloud] ${status}`);
      lastStatus = status;
    }

    await ns.sleep(options.pollMs);
  }
}

function parseArgs(rawArgs) {
  const options = {
    minSizeGb: 64,
    moneyBuffer: 10000000,
    pollMs: 60000,
    quiet: false,
  };

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = String(rawArgs[i]);
    if (arg === "--cloud-min-size") options.minSizeGb = normalizeRam(rawArgs[++i], options.minSizeGb);
    else if (arg === "--cloud-money-buffer") options.moneyBuffer = parseMoney(rawArgs[++i], options.moneyBuffer);
    else if (arg === "--cloud-poll") options.pollMs = parseMs(rawArgs[++i], options.pollMs);
    else if (arg === "--quiet") options.quiet = true;
  }

  return options;
}

function manageCloudHosts(ns, options) {
  const purchased = ns.getPurchasedServers();
  const sizes = purchased.map((host) => ({ host, ram: ns.getServerMaxRam(host) }));
  const priorState = readState(ns);
  const largestCurrentRam = sizes.reduce((largest, server) => Math.max(largest, server.ram), 0);
  const purchaseFloorGb = Math.max(options.minSizeGb, priorState.lastPurchasedRamGb || 0, largestCurrentRam);
  const availableMoney = Math.max(0, ns.getServerMoneyAvailable("home") - options.moneyBuffer);
  const limit = ns.getPurchasedServerLimit();
  const result = {
    action: "waiting",
    availableMoney,
    limit,
    moneyBuffer: options.moneyBuffer,
    purchased: sizes,
    purchaseFloorGb,
    lastPurchasedRamGb: priorState.lastPurchasedRamGb || largestCurrentRam,
    drainingHost: "",
  };

  if (purchased.length < limit) {
    const ram = largestAffordableRam(ns, purchaseFloorGb, availableMoney);
    if (ram <= 0) return result;

    const hostname = nextHostname(ns);
    const purchasedHost = ns.purchaseServer(hostname, ram);
    if (purchasedHost) {
      result.action = "purchased";
      result.host = purchasedHost;
      result.ramGb = ram;
      result.cost = ns.getPurchasedServerCost(ram);
      result.lastPurchasedRamGb = Math.max(result.lastPurchasedRamGb, ram);
      result.purchased.push({ host: purchasedHost, ram });
    }
    return result;
  }

  const smallest = selectUpgradeCandidate(ns, sizes, priorState.drainingHost);
  if (!smallest) return result;

  const upgradeFloorGb = Math.max(purchaseFloorGb, nextPowerOfTwo(smallest.ram * 2));
  const ram = largestAffordableRam(ns, upgradeFloorGb, availableMoney);
  if (ram <= smallest.ram) return result;

  if (ns.ps(smallest.host).length > 0) {
    result.action = "draining";
    result.drainingHost = smallest.host;
    return result;
  }

  const upgraded = ns.upgradePurchasedServer(smallest.host, ram);
  if (upgraded) {
    result.action = "upgraded";
    result.host = smallest.host;
    result.ramGb = ram;
    result.cost = ns.getPurchasedServerCost(ram);
    result.lastPurchasedRamGb = Math.max(result.lastPurchasedRamGb, ram);
    result.purchased = result.purchased.map((server) => server.host === smallest.host ? { ...server, ram } : server);
  }

  return result;
}

function selectUpgradeCandidate(ns, sizes, drainingHost) {
  if (drainingHost) {
    const draining = sizes.find((server) => server.host === drainingHost);
    if (draining) return draining;
  }

  return sizes
    .sort((a, b) => a.ram - b.ram || a.host.localeCompare(b.host))[0] || null;
}

function largestAffordableRam(ns, minimumRam, availableMoney) {
  const floor = nextPowerOfTwo(minimumRam);
  if (floor > MAX_SERVER_RAM || ns.getPurchasedServerCost(floor) > availableMoney) return 0;

  let affordableRam = floor;
  for (let ram = floor * 2; ram <= MAX_SERVER_RAM; ram *= 2) {
    if (ns.getPurchasedServerCost(ram) > availableMoney) break;
    affordableRam = ram;
  }

  return affordableRam;
}

function nextHostname(ns) {
  for (let index = 0; ; index += 1) {
    const hostname = `${SERVER_PREFIX}${index}`;
    if (!ns.serverExists(hostname)) return hostname;
  }
}

function readState(ns) {
  try {
    const parsed = JSON.parse(ns.read(STATE_FILE));
    const lastPurchasedRamGb = Number(parsed.lastPurchasedRamGb);
    return {
      lastPurchasedRamGb: Number.isFinite(lastPurchasedRamGb) ? lastPurchasedRamGb : 0,
      drainingHost: typeof parsed.drainingHost === "string" ? parsed.drainingHost : "",
    };
  } catch (_error) {
    return { lastPurchasedRamGb: 0, drainingHost: "" };
  }
}

function writeState(ns, result, options) {
  ns.write(STATE_FILE, JSON.stringify({
    updatedAt: Date.now(),
    ...result,
    options: {
      minSizeGb: options.minSizeGb,
      moneyBuffer: options.moneyBuffer,
      pollMs: options.pollMs,
    },
  }, null, 2), "w");
}

function normalizeRam(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return nextPowerOfTwo(parsed);
}

function nextPowerOfTwo(value) {
  let power = 1;
  while (power < value && power < MAX_SERVER_RAM) power *= 2;
  return power;
}

function parseMoney(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function parseMs(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1000, Math.round(parsed));
}

function buildStatus(result) {
  const action = result.action === "waiting"
    ? "waiting for an affordable purchase or upgrade"
    : result.action === "draining"
      ? `draining ${result.drainingHost} for upgrade`
    : `${result.action} ${result.host} (${result.ramGb}GB for ${formatMoney(result.cost)})`;
  return `${action}; servers=${result.purchased.length}/${result.limit}; floor=${result.purchaseFloorGb}GB; buffer=${formatMoney(result.moneyBuffer)}`;
}

function formatMoney(value) {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}t`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}b`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}m`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}k`;
  return `$${Math.floor(value)}`;
}
