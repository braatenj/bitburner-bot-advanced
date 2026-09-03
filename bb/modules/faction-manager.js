/**
 * Singularity faction and augmentation controller.
 *
 * The module joins invitations for its configured faction route, buys
 * relevant augmentations once their reputation and price requirements are
 * met. When faction favor permits donations and the available cash can close
 * the largest remaining reputation gap, it stops faction work and donates
 * exactly enough reputation. Otherwise it performs Hacking Contracts. After
 * enough augmentations are queued it installs them and restarts the bot
 * through /bootstrap.js.
 *
 * Options:
 * --factions NAME[,NAME]      Restrict the route to these factions.
 * --augmentation-focus TAGS   Comma-separated stat priorities.
 * --min-augmentations N       Exit after this many queued augs (default 10).
 * --augmentation-money-buffer MONEY  Cash never spent on augmentations.
 * --poll MS                   Evaluation interval (default 60000).
 * The manager travels to join Tian Di Hui when it is in the route, reserves
 * the required cash until then, and purchases its non-NeuroFlux augmentations
 * before considering the rest of the route.
 * --no-backdoors              Disable faction-server backdoor automation.
 * --no-install                Join, work, and purchase without resetting.
 * --quiet                     Suppress terminal status messages.
 */
const STATE_FILE = "/bb/data/faction-manager-state.json";
const CLOUD_HOSTS_STATE_FILE = "/bb/data/cloud-hosts-state.json";
const RESTART_SCRIPT = "/bootstrap.js";
const DAEDALUS = "Daedalus";
const NEUROFLUX_GOVERNOR = "NeuroFlux Governor";
const TIAN_DI_HUI = "Tian Di Hui";
const TIAN_DI_HUI_CITIES = new Set(["Chongqing", "New Tokyo", "Ishima"]);
const TIAN_DI_HUI_MINIMUM_CASH = 1_000_000;
const CITY_TRAVEL_COST = 200_000;
const FACTION_BACKDOOR_SERVERS = {
  BitRunners: "run4theh111z",
  CyberSec: "CSEC",
  NiteSec: "avmnite-02h",
  "The Black Hand": "I.I.I.I",
};

export async function main(ns) {
  ns.disableLog("ALL");
  const options = parseArgs(ns.args);

  if (options.factions.length === 0) {
    ns.tprintf("%s", "[bb:factions] No faction route configured; stopping.");
    return;
  }

  while (true) {
    let player = ns.getPlayer();
    const tianDiHui = pursueTianDiHui(ns, options, player);
    player = ns.getPlayer();
    const backdoor = await installFactionBackdoor(ns, options, player.factions);
    const joined = joinInvitations(ns, options, player.factions);
    player = ns.getPlayer();
    const members = player.factions.filter((faction) => options.factions.includes(faction));
    tianDiHui.joined = members.includes(TIAN_DI_HUI);
    if (tianDiHui.joined) {
      tianDiHui.active = false;
      tianDiHui.moneyReserve = 0;
    }
    const queued = queuedAugmentations(ns);
    const tianCandidates = members.includes(TIAN_DI_HUI)
      ? collectCandidates(ns, [TIAN_DI_HUI], queued, [])
      : [];
    const candidates = tianCandidates.length > 0
      ? tianCandidates
      : collectCandidates(ns, members, queued, options.focus);
    const waitingForTianDiHui = tianDiHui.active && tianDiHui.moneyReserve > 0;
    const availableMoney = player.money - options.moneyBuffer - tianDiHui.moneyReserve;
    const affordable = candidates.filter((candidate) => candidate.price <= availableMoney);
    const donation = waitingForTianDiHui ? null : donateForHighestRep(ns, candidates, player, options);
    const bought = donation ? null : buyBestAugmentation(ns, affordable, options);

    if (bought) {
      report(ns, options, `Bought ${bought.augmentation} from ${bought.faction}.`);
    } else if (donation) {
      report(ns, options, `Donated $${ns.format.number(donation.amount)} to ${donation.faction} for ${ns.format.number(donation.rep)} reputation.`);
    } else if (!options.noInstall && !waitingForTianDiHui && tianCandidates.length === 0 && queued.length >= options.minAugmentations) {
      const neuroFlux = buyNeuroFluxGovernor(ns, members, options.moneyBuffer);
      if (neuroFlux.count > 0) {
        const donated = neuroFlux.donated > 0 ? ` after donating $${ns.format.number(neuroFlux.donated)} for Daedalus reputation` : "";
        report(ns, options, `Bought ${neuroFlux.count} NeuroFlux Governor level(s) from ${neuroFlux.faction}${donated} before installing.`);
      }
      installQueuedAugmentations(ns);
      return;
    } else if (candidates.length === 0) {
      const neuroFlux = waitingForTianDiHui
        ? { count: 0, faction: "" }
        : buyNeuroFluxGovernor(ns, members, options.moneyBuffer);
      if (neuroFlux.count > 0) {
        const donated = neuroFlux.donated > 0 ? ` after donating $${ns.format.number(neuroFlux.donated)} for Daedalus reputation` : "";
        report(ns, options, `Bought ${neuroFlux.count} NeuroFlux Governor level(s) from ${neuroFlux.faction}${donated}; no other augmentations remain.`);
      } else if (!options.quiet) {
        const status = waitingForTianDiHui
          ? `Reserving $${ns.format.number(tianDiHui.moneyReserve)} to join Tian Di Hui.`
          : "No other augmentations remain; waiting for enough money or faction reputation for NeuroFlux Governor.";
        ns.print(`[bb:factions] ${status}`);
      }
    } else {
      const target = candidates[0];
      const working = startHackingContracts(ns, target, options);
      if (!working && !options.quiet) {
        const status = target
          ? `Waiting for $${ns.format.number(target.price)} or ${ns.format.number(Math.max(0, target.repRequired - target.rep))} rep for ${target.augmentation}.`
          : "Waiting for invitations or augmentations from the configured factions.";
        ns.print(`[bb:factions] ${status}`);
      }
    }

    writeState(ns, { affordable, backdoor, candidates, joined, members, options, queued, tianDiHui });
    await ns.sleep(options.pollMs);
  }
}

/** Restarts through the bootstrapper after accounting for all queued purchases. */
function installQueuedAugmentations(ns) {
  const count = queuedAugmentations(ns).length;
  ns.rm(CLOUD_HOSTS_STATE_FILE);
  ns.tprintf("%s", `[bb:factions] Installing ${count} queued augmentation(s); restarting ${RESTART_SCRIPT}.`);
  ns.singularity.installAugmentations(RESTART_SCRIPT);
}

/** Travels to an eligible city and protects the cash needed to join Tian Di Hui. */
function pursueTianDiHui(ns, options, player) {
  const state = { active: false, joined: false, moneyReserve: 0, traveled: false };
  if (!options.factions.includes(TIAN_DI_HUI) || player.factions.includes(TIAN_DI_HUI) || hasJoinedEnemy(ns, TIAN_DI_HUI, player.factions)) return state;

  state.active = true;
  const hacking = ns.getHackingLevel();
  const inEligibleCity = TIAN_DI_HUI_CITIES.has(player.city);
  const requiredCash = TIAN_DI_HUI_MINIMUM_CASH + (inEligibleCity ? 0 : CITY_TRAVEL_COST);
  if (hacking >= 50) state.moneyReserve = requiredCash;
  if (hacking < 50 || player.money < requiredCash) return state;

  if (!inEligibleCity) {
    try {
      state.traveled = ns.singularity.travelToCity("Chongqing");
      if (state.traveled) report(ns, options, "Traveled to Chongqing to join Tian Di Hui.");
    } catch (_error) {}
  }
  return state;
}

function parseArgs(rawArgs) {
  const options = {
    factions: [],
    focus: ["hacking"],
    minAugmentations: 10,
    moneyBuffer: 0,
    noBackdoors: false,
    noInstall: false,
    pollMs: 60000,
    quiet: false,
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = String(rawArgs[index]);
    if (arg === "--factions") options.factions = splitList(rawArgs[++index]);
    else if (arg === "--augmentation-focus") options.focus = splitList(rawArgs[++index]).map((value) => value.toLowerCase());
    else if (arg === "--min-augmentations") options.minAugmentations = parseInteger(rawArgs[++index], options.minAugmentations, 1);
    else if (arg === "--augmentation-money-buffer") options.moneyBuffer = parseNumber(rawArgs[++index], options.moneyBuffer, 0);
    else if (arg === "--no-backdoors") options.noBackdoors = true;
    else if (arg === "--no-install") options.noInstall = true;
    else if (arg === "--poll") options.pollMs = parseInteger(rawArgs[++index], options.pollMs, 1000);
    else if (arg === "--quiet") options.quiet = true;
  }
  return options;
}

/** Installs one needed faction-server backdoor per pass without touching inaccessible targets. */
async function installFactionBackdoor(ns, options, memberships) {
  const state = { attempted: false, installed: false, server: "" };
  if (options.noBackdoors) return state;

  const target = findBackdoorTarget(ns, options.factions, memberships);
  if (!target) return state;

  state.server = target;
  const route = findRoute(ns, target);
  if (!route || ns.getHackingLevel() < ns.getServerRequiredHackingLevel(target) || !tryRoot(ns, target)) return state;

  try {
    ns.singularity.stopAction();
    state.attempted = true;
    for (const host of route.slice(1)) {
      if (!ns.singularity.connect(host)) return state;
    }
    await ns.singularity.installBackdoor();
    state.installed = Boolean(ns.getServer(target).backdoorInstalled);
    if (state.installed) report(ns, options, `Installed faction backdoor on ${target}.`);
  } catch (_error) {
    // The target may require more hacking level or may already be in progress.
  } finally {
    try {
      for (const host of [...route].reverse().slice(1)) ns.singularity.connect(host);
    } catch (_error) {}
  }
  return state;
}

function findBackdoorTarget(ns, factions, memberships) {
  for (const faction of factions) {
    if (memberships.includes(faction) || hasJoinedEnemy(ns, faction, memberships)) continue;
    const server = FACTION_BACKDOOR_SERVERS[faction];
    if (server && ns.serverExists(server) && !ns.getServer(server).backdoorInstalled) return server;
  }
  return "";
}

/** Finds a connection path from home to a discovered server. */
function findRoute(ns, target) {
  const parents = new Map([["home", null]]);
  const queue = ["home"];
  for (let index = 0; index < queue.length; index += 1) {
    const host = queue[index];
    if (host === target) break;
    for (const neighbor of ns.scan(host)) {
      if (!parents.has(neighbor)) {
        parents.set(neighbor, host);
        queue.push(neighbor);
      }
    }
  }
  if (!parents.has(target)) return null;

  const route = [];
  for (let host = target; host !== null; host = parents.get(host)) route.unshift(host);
  return route;
}

/** Opens every available port and gains root when the player meets the requirement. */
function tryRoot(ns, server) {
  if (ns.hasRootAccess(server)) return true;

  let openedPorts = 0;
  if (ns.fileExists("BruteSSH.exe", "home")) { try { ns.brutessh(server); openedPorts += 1; } catch (_error) {} }
  if (ns.fileExists("FTPCrack.exe", "home")) { try { ns.ftpcrack(server); openedPorts += 1; } catch (_error) {} }
  if (ns.fileExists("relaySMTP.exe", "home")) { try { ns.relaysmtp(server); openedPorts += 1; } catch (_error) {} }
  if (ns.fileExists("HTTPWorm.exe", "home")) { try { ns.httpworm(server); openedPorts += 1; } catch (_error) {} }
  if (ns.fileExists("SQLInject.exe", "home")) { try { ns.sqlinject(server); openedPorts += 1; } catch (_error) {} }

  if (openedPorts >= ns.getServerNumPortsRequired(server)) {
    try {
      ns.nuke(server);
    } catch (_error) {}
  }
  return ns.hasRootAccess(server);
}

function splitList(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function parseInteger(value, fallback, minimum) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.round(parsed)) : fallback;
}

function parseNumber(value, fallback, minimum) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, parsed) : fallback;
}

function joinInvitations(ns, options, memberships) {
  const joined = [];
  for (const faction of ns.singularity.checkFactionInvitations()) {
    if (!options.factions.includes(faction) || memberships.includes(faction)) continue;
    if (hasJoinedEnemy(ns, faction, memberships)) continue;
    if (ns.singularity.joinFaction(faction)) {
      joined.push(faction);
      report(ns, options, `Joined ${faction}.`);
    }
  }
  return joined;
}

function hasJoinedEnemy(ns, faction, memberships) {
  try {
    return ns.singularity.getFactionEnemies(faction).some((enemy) => memberships.includes(enemy));
  } catch (_error) {
    return false;
  }
}

function queuedAugmentations(ns) {
  const installed = new Set(ns.singularity.getOwnedAugmentations(false));
  return ns.singularity.getOwnedAugmentations(true).filter((augmentation) => !installed.has(augmentation));
}

function collectCandidates(ns, factions, queued, focus) {
  const owned = new Set([...ns.singularity.getOwnedAugmentations(false), ...queued]);
  const byAugmentation = new Map();

  for (const faction of factions) {
    const rep = ns.singularity.getFactionRep(faction);
    for (const augmentation of ns.singularity.getAugmentationsFromFaction(faction)) {
      if (augmentation === NEUROFLUX_GOVERNOR || owned.has(augmentation)) continue;
      const prerequisites = ns.singularity.getAugmentationPrereq(augmentation);
      if (!prerequisites.every((prerequisite) => owned.has(prerequisite))) continue;

      const candidate = {
        augmentation,
        faction,
        price: ns.singularity.getAugmentationPrice(augmentation),
        rep,
        repRequired: ns.singularity.getAugmentationRepReq(augmentation),
        relevance: augmentationRelevance(ns.singularity.getAugmentationStats(augmentation), focus),
      };
      const existing = byAugmentation.get(augmentation);
      if (!existing || candidate.rep > existing.rep) byAugmentation.set(augmentation, candidate);
    }
  }

  return [...byAugmentation.values()].sort((left, right) => {
    if (right.relevance !== left.relevance) return right.relevance - left.relevance;
    const leftMissingRep = Math.max(0, left.repRequired - left.rep);
    const rightMissingRep = Math.max(0, right.repRequired - right.rep);
    if (leftMissingRep !== rightMissingRep) return leftMissingRep - rightMissingRep;
    return right.price - left.price;
  });
}

function augmentationRelevance(stats, focus) {
  const keys = Object.keys(stats || {}).map((key) => key.toLowerCase());
  return focus.reduce((score, tag) => score + keys.filter((key) => key.includes(tag)).length, 0);
}

function buyBestAugmentation(ns, affordable, options) {
  const purchasable = affordable
    .filter((candidate) => candidate.rep >= candidate.repRequired)
    .sort((left, right) => right.price - left.price);
  for (const candidate of purchasable) {
    if (ns.singularity.purchaseAugmentation(candidate.faction, candidate.augmentation)) return candidate;
  }
  return null;
}

/** Buys repeatable NeuroFlux levels once no normal augmentation purchase is pending. */
function buyNeuroFluxGovernor(ns, factions, moneyBuffer) {
  const sellers = factions
    .filter((faction) => ns.singularity.getAugmentationsFromFaction(faction).includes(NEUROFLUX_GOVERNOR))
    .sort((left, right) => ns.singularity.getFactionRep(right) - ns.singularity.getFactionRep(left));
  // Daedalus can sell every NeuroFlux level and is the faction whose favor
  // makes repeated donation-backed purchases most valuable late in a run.
  const result = { count: 0, donated: 0, faction: sellers.includes(DAEDALUS) ? DAEDALUS : sellers[0] || "" };

  while (result.faction) {
    const price = ns.singularity.getAugmentationPrice(NEUROFLUX_GOVERNOR);
    const repRequired = ns.singularity.getAugmentationRepReq(NEUROFLUX_GOVERNOR);
    const availableMoney = ns.getServerMoneyAvailable("home") - moneyBuffer;
    const missingRep = Math.max(0, repRequired - ns.singularity.getFactionRep(result.faction));
    if (price > availableMoney) break;
    if (missingRep > 0) {
      if (result.faction !== DAEDALUS || !canDonateToFaction(ns, DAEDALUS)) break;

      const donation = Math.ceil(donationAmountForRep(ns, missingRep, ns.getPlayer()));
      // Keep enough cash for the level whose reputation this donation unlocks.
      if (!Number.isFinite(donation) || donation + price > availableMoney) break;
      ns.singularity.stopAction();
      if (!ns.singularity.donateToFaction(DAEDALUS, donation)) break;
      result.donated += donation;
    }
    if (!ns.singularity.purchaseAugmentation(result.faction, NEUROFLUX_GOVERNOR)) break;
    result.count += 1;
  }

  return result;
}

function donateForHighestRep(ns, candidates, player, options) {
  const donationTarget = candidates
    .filter((candidate) => candidate.rep < candidate.repRequired)
    .sort((left, right) => right.repRequired - left.repRequired)[0];
  if (!donationTarget || !canDonateToFaction(ns, donationTarget.faction)) return null;

  const missingRep = donationTarget.repRequired - donationTarget.rep;
  const amount = Math.ceil(donationAmountForRep(ns, missingRep, player));
  if (!Number.isFinite(amount) || amount > player.money - options.moneyBuffer) return null;

  ns.singularity.stopAction();
  if (!ns.singularity.donateToFaction(donationTarget.faction, amount)) return null;
  return { amount, faction: donationTarget.faction, rep: missingRep };
}

function canDonateToFaction(ns, faction) {
  try {
    return ns.singularity.getFactionFavor(faction) >= ns.getFavorToDonate();
  } catch (_error) {
    return false;
  }
}

function donationAmountForRep(ns, reputation, player) {
  try {
    return ns.formulas.reputation.donationForRep(reputation, player);
  } catch (_error) {
    return Number.NaN;
  }
}

function startHackingContracts(ns, candidate, options) {
  if (!candidate || candidate.rep >= candidate.repRequired) return false;
  const workTypes = ns.singularity.getFactionWorkTypes(candidate.faction);
  if (!workTypes.includes("hacking")) return false;

  const current = ns.singularity.getCurrentWork();
  if (current?.type === "FACTION" && current.factionName === candidate.faction && current.factionWorkType === "hacking") return true;

  const started = ns.singularity.workForFaction(candidate.faction, "hacking", false);
  if (started) report(ns, options, `Working Hacking Contracts for ${candidate.faction}.`);
  return started;
}

function report(ns, options, message) {
  if (!options.quiet) ns.tprintf("%s", `[bb:factions] ${message}`);
}

function writeState(ns, { affordable, backdoor, candidates, joined, members, options, queued, tianDiHui }) {
  const next = candidates[0];
  ns.write(STATE_FILE, JSON.stringify({
    affordable: affordable.length,
    backdoor,
    configuredFactions: options.factions,
    joinedThisPass: joined,
    members,
    next: next && {
      augmentation: next.augmentation,
      faction: next.faction,
      price: next.price,
      rep: next.rep,
      repRequired: next.repRequired,
    },
    queued,
    tianDiHui,
    updatedAt: Date.now(),
  }, null, 2), "w");
}
