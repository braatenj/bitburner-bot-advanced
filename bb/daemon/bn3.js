import { BITNODE_PROFILES } from "/bb/modules/bitnode-profiles.js";
import { runBitNodeDaemon } from "/bb/modules/bitnode-runtime.js";

export async function main(ns) { await runBitNodeDaemon(ns, BITNODE_PROFILES[3]); }
