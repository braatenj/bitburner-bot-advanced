const HACK_DEFAULTS = ["--reserve-home", "auto", "--prep-ram-pct", "0.1"];

/** Per-BitNode defaults. User-supplied daemon arguments override these values. */
export const BITNODE_PROFILES = {
  1: profile(1, "Source Genesis", HACK_DEFAULTS, cloud(32, 1e9)),
  2: profile(2, "Rise of the Underworld", [...HACK_DEFAULTS, "--prep-ram-pct", "0.15"], cloud(32, 1e9)),
  3: profile(3, "Corporatocracy", HACK_DEFAULTS, cloud(64, 5e9)),
  4: profile(4, "The Singularity", [...HACK_DEFAULTS, "--reserve-home", "8"], cloud(32, 1e9)),
  5: profile(5, "Artificial Intelligence", HACK_DEFAULTS, cloud(32, 1e9)),
  6: profile(6, "Bladeburners", [...HACK_DEFAULTS, "--reserve-home", "8"], cloud(64, 5e9)),
  7: profile(7, "Bladeburners 2079", [...HACK_DEFAULTS, "--reserve-home", "8"], cloud(64, 5e9)),
  8: profile(8, "Ghost of Wall Street", null, null),
  9: profile(9, "Hacktocracy", [...HACK_DEFAULTS, "--reserve-home", "16"], null),
  10: profile(10, "Digital Carbon", [...HACK_DEFAULTS, "--prep-ram-pct", "0.2"], cloud(64, 1e10)),
  11: profile(11, "The Big Crash", HACK_DEFAULTS, cloud(64, 1e10)),
  12: profile(12, "The Recursion", HACK_DEFAULTS, cloud(64, 1e10)),
  13: profile(13, "Church of the Machine God", [...HACK_DEFAULTS, "--reserve-home", "16"], cloud(64, 1e10)),
  14: profile(14, "IPvGO Subnet Takeover", HACK_DEFAULTS, cloud(64, 5e9)),
  15: profile(15, "Digital Aether", [...HACK_DEFAULTS, "--reserve-home", "8"], cloud(64, 5e9)),
};

function cloud(minSizeGb, moneyBuffer) {
  return ["--cloud-min-size", String(minSizeGb), "--cloud-money-buffer", String(moneyBuffer)];
}

function profile(bitNode, name, hacking, cloudHosts) {
  return { bitNode, cloudHosts, hacking, name };
}
