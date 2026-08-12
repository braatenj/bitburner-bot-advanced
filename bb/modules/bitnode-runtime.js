const HACKING_MODULE = "/bb/modules/hacking-manager.js";
const CLOUD_HOSTS_MODULE = "/bb/modules/server-manager.js";
const FACTION_MODULE = "/bb/modules/faction-manager.js";

/**
 * Starts the reusable services selected by one BitNode daemon.
 * Profile arguments are placed before user arguments, so explicit launch flags
 * remain the final authority for a particular run.
 */
export async function runBitNodeDaemon(ns, profile) {
  ns.disableLog("ALL");

  const options = parseRuntimeOptions(ns.args);
  const services = buildServices(profile, ns.args, options);
  if (services.length === 0) {
    ns.tprint(`[bb:bn${profile.bitNode}] No modules enabled.`);
    return;
  }

  if (!options.quiet) {
    ns.tprint(`[bb:bn${profile.bitNode}] ${profile.name}; modules: ${services.map((service) => service.label).join(", ")}.`);
  }

  if (options.watch) {
    await watchServices(ns, services, options.pollMs);
    return;
  }

  startServices(ns, services);
}

function parseRuntimeOptions(rawArgs) {
  const options = { context: "/bb/data/context.json", noCloudHosts: false, noEarlyHack: false, noFactions: false, pollMs: 60000, quiet: false, watch: false };
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = String(rawArgs[index]);
    if (arg === "--context") options.context = String(rawArgs[++index] || options.context);
    else if (arg === "--no-cloud-hosts") options.noCloudHosts = true;
    else if (arg === "--no-early-hack") options.noEarlyHack = true;
    else if (arg === "--no-factions") options.noFactions = true;
    else if (arg === "--poll") options.pollMs = parsePollMs(rawArgs[++index], options.pollMs);
    else if (arg === "--quiet") options.quiet = true;
    else if (arg === "--watch") options.watch = true;
  }
  return options;
}

function parsePollMs(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1000, Math.round(parsed)) : fallback;
}

function buildServices(profile, rawArgs, options) {
  const services = [];
  if (profile.hacking && !options.noEarlyHack) {
    services.push({
      args: [...profile.hacking, ...rawArgs],
      label: "hacking",
      script: HACKING_MODULE,
    });
  }
  if (profile.cloudHosts && !options.noCloudHosts) {
    services.push({
      args: [...profile.cloudHosts, ...rawArgs],
      label: "cloud hosts",
      script: CLOUD_HOSTS_MODULE,
    });
  }
  if (profile.factions && !options.noFactions && contextHasSingularity(ns, options.context)) {
    services.push({
      args: [...profile.factions, ...rawArgs],
      label: "factions",
      script: FACTION_MODULE,
    });
  }
  return services;
}

function contextHasSingularity(ns, contextPath) {
  try {
    return Boolean(JSON.parse(ns.read(contextPath)).capabilities?.singularity);
  } catch (_error) {
    return false;
  }
}

function startServices(ns, services) {
  const pending = services.filter((service) => !ns.scriptRunning(service.script, "home"));
  if (pending.length === 0) {
    ns.tprint("[bb] All enabled modules are already running.");
    return;
  }

  const finalService = pending.pop();
  for (const service of pending) startService(ns, service);
  ns.tprint(`[bb] Spawning ${finalService.script}.`);
  ns.spawn(finalService.script, { threads: 1, spawnDelay: 0 }, ...finalService.args);
}

async function watchServices(ns, services, pollMs) {
  while (true) {
    for (const service of services) {
      if (!ns.scriptRunning(service.script, "home")) startService(ns, service);
    }
    await ns.sleep(pollMs);
  }
}

function startService(ns, service) {
  const pid = ns.exec(service.script, "home", 1, ...service.args);
  if (pid === 0) ns.print(`[bb] Failed to start ${service.script}; waiting for RAM.`);
  else ns.tprint(`[bb] Started ${service.script} with pid ${pid}.`);
}
