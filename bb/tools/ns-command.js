/**
 * Runs a Netscript API command and prints its return value to the terminal.
 *
 * Usage:
 *   run /bb/tools/ns-command.js COMMAND [ARG ...]
 *
 * COMMAND may be a top-level Netscript function (for example,
 * `getHackingLevel` or `ns.getHackingLevel`) or a dotted namespace path (for example,
 * `singularity.getCurrentWork`). Arguments are passed through as supplied.
 * Prefix an argument with `json:` to pass an object or array, such as
 * `json:{"threads":4}`. The result or any invocation error is printed with
 * `tprint`, so it appears directly in the Bitburner terminal.
 */

const BASE_SCRIPT_RAM = 1.6;

/** Resolves, invokes, and terminal-prints the command requested by the user. */
export async function main(ns) {
  const [rawCommand, ...rawArgs] = ns.args;
  const command = normalizeCommand(rawCommand);
  if (!command) {
    printUsage(ns);
    return;
  }

  try {
    const resolved = resolveCommand(ns, command);
    if (!resolved) {
      ns.tprint(`[bb:ns] Unknown or unsafe Netscript command: ${command}`);
      return;
    }

    reserveCommandRam(ns, command);
    const args = rawArgs.map(parseArgument);
    const result = await resolved.fn.apply(resolved.receiver, args);
    ns.tprint(`[bb:ns] ${command} => ${formatResult(result)}`);
  } catch (error) {
    ns.tprint(`[bb:ns] ${command} failed: ${formatError(error)}`);
  }
}

/** Removes an optional `ns.` prefix so terminal commands match normal Netscript notation. */
function normalizeCommand(rawCommand) {
  return String(rawCommand || "").trim().replace(/^ns\./, "");
}

/**
 * Allocates enough static RAM for a dynamically selected API function.
 * Bitburner cannot infer a computed property call at compile time, so its
 * dynamic RAM check needs this explicit reservation before invocation.
 */
function reserveCommandRam(ns, command) {
  const commandRam = ns.getFunctionRamCost(command);
  ns.ramOverride(Math.max(BASE_SCRIPT_RAM, BASE_SCRIPT_RAM + commandRam));
}

/**
 * Resolves a dotted API path while keeping its owning namespace as `this`.
 * Prototype paths are excluded so a terminal argument cannot traverse outside
 * the Netscript API object.
 */
function resolveCommand(ns, command) {
  const parts = command.split(".");
  if (parts.length === 0 || parts.some(isUnsafePathPart)) return null;

  let receiver = ns;
  for (let index = 0; index < parts.length - 1; index += 1) {
    receiver = receiver[parts[index]];
    if (!receiver || (typeof receiver !== "object" && typeof receiver !== "function")) return null;
  }

  const fn = receiver[parts[parts.length - 1]];
  return typeof fn === "function" ? { fn, receiver } : null;
}

/** Returns whether a command-path component could access JavaScript prototypes. */
function isUnsafePathPart(part) {
  return !part || part === "__proto__" || part === "constructor" || part === "prototype";
}

/** Parses an explicit JSON argument while preserving ordinary Netscript argument values. */
function parseArgument(value) {
  if (typeof value !== "string" || !value.startsWith("json:")) return value;

  const json = value.slice("json:".length);
  try {
    return JSON.parse(json);
  } catch (error) {
    throw new Error(`invalid JSON argument ${JSON.stringify(json)}: ${formatError(error)}`);
  }
}

/** Converts API results into terminal-safe, readable text. */
function formatResult(value) {
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "bigint") return `${value}n`;

  try {
    const serialized = JSON.stringify(value, createJsonReplacer(), 2);
    return serialized === undefined ? String(value) : serialized;
  } catch (_error) {
    return String(value);
  }
}

/** Replaces values JSON cannot serialize and labels circular references. */
function createJsonReplacer() {
  const seen = new WeakSet();
  return (_key, value) => {
    if (typeof value === "bigint") return `${value}n`;
    if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`;
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
    }
    return value;
  };
}

/** Normalizes caught errors that may not be Error instances. */
function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

/** Prints examples that demonstrate top-level, namespaced, and object arguments. */
function printUsage(ns) {
  ns.tprint("[bb:ns] Usage: run /bb/tools/ns-command.js COMMAND [ARG ...]");
  ns.tprint("[bb:ns] Examples: getHackingLevel | getServerMoneyAvailable n00dles | singularity.getCurrentWork");
  ns.tprint("[bb:ns] Pass objects or arrays as json:{...} or json:[...].");
}
