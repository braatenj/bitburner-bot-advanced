const DEFAULT_MANIFEST_TARGET = "/bb/manifest.json";
const DEFAULT_MANIFEST_URL = "https://raw.githubusercontent.com/braatenj/bitburner-bot-advanced/main/manifest.json";

export async function main(ns) {
  const args = Array.from(ns.args);
  const manifestUrl = getManifestUrl(args);
  const bootstrapOptions = parseBootstrapOptions(args);

  if (ns.getHostname() !== "home") {
    ns.tprint("[bb] Run this bootstrapper from home so downloaded scripts and spawn handoff use the expected host.");
    return;
  }

  ns.tprint(`[bb] Downloading manifest: ${manifestUrl}`);
  const manifestOk = await ns.wget(manifestUrl, DEFAULT_MANIFEST_TARGET, "home");
  if (!manifestOk) {
    ns.tprint("[bb] Failed to download manifest.");
    return;
  }

  const manifest = readManifest(ns, DEFAULT_MANIFEST_TARGET);
  if (!manifest) return;

  const baseUrl = resolveBaseUrl(manifestUrl, manifest.baseUrl);
  const files = normalizeFiles(manifest.files);
  if (files.length === 0) {
    ns.tprint("[bb] Manifest did not contain any files.");
    return;
  }

  let failures = 0;
  for (const file of files) {
    const sourceUrl = resolveUrl(baseUrl, file.source);
    const ok = await ns.wget(sourceUrl, file.path, "home");
    if (ok) {
      ns.print(`[bb] downloaded ${file.path}`);
    } else {
      failures += 1;
      ns.tprint(`[bb] failed: ${sourceUrl} -> ${file.path}`);
    }
  }

  if (failures > 0) {
    ns.tprint(`[bb] Download stopped with ${failures} failed file(s).`);
    return;
  }

  ns.tprint(`[bb] Installed ${files.length} file(s) from manifest ${manifest.name || ""} ${manifest.version || ""}`.trim());

  if (bootstrapOptions.noLaunch) {
    ns.tprint("[bb] Launch skipped because --no-launch was provided.");
    return;
  }

  const entry = String(manifest.entry || "/bb/daemon/supervisor.js");
  ns.tprint(`[bb] Spawning ${entry}.`);
  ns.spawn(entry, { threads: 1, spawnDelay: 0 }, ...bootstrapOptions.forwardedArgs);
}

function getManifestUrl(args) {
  const firstArg = String(args[0] || "");
  if (/^https?:\/\//i.test(firstArg)) return String(args.shift());
  return DEFAULT_MANIFEST_URL;
}

function parseBootstrapOptions(args) {
  const options = {
    noLaunch: false,
    forwardedArgs: [],
  };

  for (const arg of args) {
    if (String(arg) === "--no-launch") {
      options.noLaunch = true;
    } else {
      options.forwardedArgs.push(arg);
    }
  }

  return options;
}

function readManifest(ns, path) {
  const content = ns.read(path);
  try {
    return JSON.parse(content);
  } catch (error) {
    ns.tprint(`[bb] Manifest is not valid JSON: ${String(error)}`);
    return null;
  }
}

function normalizeFiles(rawFiles) {
  if (!Array.isArray(rawFiles)) return [];

  const files = [];
  for (const entry of rawFiles) {
    if (typeof entry === "string") {
      files.push({
        path: ensureAbsolutePath(entry),
        source: trimLeadingSlash(entry),
      });
    } else if (entry && typeof entry === "object") {
      const path = ensureAbsolutePath(String(entry.path || ""));
      const source = String(entry.source || trimLeadingSlash(path));
      if (path !== "/") files.push({ path, source });
    }
  }

  return files;
}

function resolveBaseUrl(manifestUrl, manifestBaseUrl) {
  const manifestDir = manifestUrl.slice(0, manifestUrl.lastIndexOf("/") + 1);
  if (!manifestBaseUrl || manifestBaseUrl === "." || manifestBaseUrl === "./") return manifestDir;
  return resolveUrl(manifestDir, String(manifestBaseUrl));
}

function resolveUrl(baseUrl, path) {
  const value = String(path || "");
  if (/^https?:\/\//i.test(value)) return value;

  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return base + trimLeadingSlash(value);
}

function ensureAbsolutePath(path) {
  const value = String(path || "").trim();
  if (!value) return "/";
  return value.startsWith("/") ? value : `/${value}`;
}

function trimLeadingSlash(path) {
  return String(path || "").replace(/^\/+/, "");
}
