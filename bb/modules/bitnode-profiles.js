const HACK_DEFAULTS = ["--reserve-home", "auto", "--prep-ram-pct", "0.1"];
const HACKING_FACTIONS = ["CyberSec", "NiteSec", "The Black Hand", "BitRunners", "Daedalus"];
const CORPORATE_FACTIONS = ["MegaCorp", "Bachman & Associates", "NWO", "Clarke Incorporated", "OmniTek Incorporated", "Four Sigma", "KuaiGong International"];
const COMBAT_FACTIONS = ["The Syndicate", "Speakers for the Dead", "The Dark Army", "The Covenant", "Daedalus"];

/** Per-BitNode defaults. User-supplied daemon arguments override these values. */
export const BITNODE_PROFILES = {
  1: profile(1, "Source Genesis", HACK_DEFAULTS, cloud(32, 1e9), factionArgs([...HACKING_FACTIONS, "Sector-12"], "hacking")),
  2: profile(2, "Rise of the Underworld", [...HACK_DEFAULTS, "--prep-ram-pct", "0.15"], cloud(32, 1e9), factionArgs([...HACKING_FACTIONS, "Slum Snakes"], "hacking,strength,defense,dexterity,agility")),
  3: profile(3, "Corporatocracy", HACK_DEFAULTS, cloud(64, 5e9), factionArgs(CORPORATE_FACTIONS, "company,hacking")),
  4: profile(4, "The Singularity", [...HACK_DEFAULTS, "--reserve-home", "8"], cloud(32, 1e9), factionArgs([...HACKING_FACTIONS, "Sector-12"], "hacking")),
  5: profile(5, "Artificial Intelligence", HACK_DEFAULTS, cloud(32, 1e9), factionArgs(HACKING_FACTIONS, "hacking")),
  6: profile(6, "Bladeburners", [...HACK_DEFAULTS, "--reserve-home", "8"], cloud(64, 5e9), factionArgs(COMBAT_FACTIONS, "strength,defense,dexterity,agility,hacking")),
  7: profile(7, "Bladeburners 2079", [...HACK_DEFAULTS, "--reserve-home", "8"], cloud(64, 5e9), factionArgs(COMBAT_FACTIONS, "strength,defense,dexterity,agility,hacking")),
  8: profile(8, "Ghost of Wall Street", null, null, null),
  9: profile(9, "Hacktocracy", [...HACK_DEFAULTS, "--reserve-home", "16"], null, factionArgs(HACKING_FACTIONS, "hacking")),
  10: profile(10, "Digital Carbon", [...HACK_DEFAULTS, "--prep-ram-pct", "0.2"], cloud(64, 1e10), factionArgs(HACKING_FACTIONS, "hacking")),
  11: profile(11, "The Big Crash", HACK_DEFAULTS, cloud(64, 1e10), factionArgs(CORPORATE_FACTIONS, "company,hacking")),
  12: profile(12, "The Recursion", HACK_DEFAULTS, cloud(64, 1e10), factionArgs(HACKING_FACTIONS, "hacking")),
  13: profile(13, "Church of the Machine God", [...HACK_DEFAULTS, "--reserve-home", "16"], cloud(64, 1e10), factionArgs(["Church of the Machine God", ...HACKING_FACTIONS], "hacking")),
  14: profile(14, "IPvGO Subnet Takeover", HACK_DEFAULTS, cloud(64, 5e9), factionArgs(HACKING_FACTIONS, "hacking")),
  15: profile(15, "Digital Aether", [...HACK_DEFAULTS, "--reserve-home", "8"], cloud(64, 5e9), factionArgs(HACKING_FACTIONS, "hacking")),
};

function cloud(minSizeGb, moneyBuffer) {
  return ["--cloud-min-size", String(minSizeGb), "--cloud-money-buffer", String(moneyBuffer)];
}

function factionArgs(factions, focus) {
  return ["--factions", factions.join(","), "--augmentation-focus", focus];
}

function profile(bitNode, name, hacking, cloudHosts, factions) {
  return { bitNode, cloudHosts, factions, hacking, name };
}
