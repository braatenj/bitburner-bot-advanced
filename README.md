# bitburner-bot-advanced

Plain JavaScript Bitburner automation scripts. The first milestone is a bootstrapper, a manifest-driven daemon launcher, BitNode/source-file detection, and early-game hacking automation that can start from an 8GB home server.

## Install in Bitburner

```text
wget https://raw.githubusercontent.com/braatenj/bitburner-bot-advanced/main/bootstrap.js /bootstrap.js
run /bootstrap.js
```

The bootstrapper downloads `manifest.json`, installs every manifest file to `/bb/...`, and launches `/bb/daemon/supervisor.js`.

## Useful Launch Options

```text
run /bootstrap.js --target n00dles
run /bootstrap.js --reserve-home 4
run /bb/daemon/supervisor.js --watch
```

- `--target <server>` forces the early hacking daemon to use a specific money server when it is rootable and hackable.
- `--reserve-home <gb>` keeps home RAM free. The default `auto` reserve uses `0GB` on an 8GB home server.
- `--watch` keeps the supervisor alive to restart the early hacking daemon if it exits. The default supervisor mode records context, spawns the daemon, and exits so early-game RAM stays available.

## Current Scope

- Detects the current BitNode and active Source-File levels via `ns.getResetInfo()`.
- Writes runtime context to `/bb/data/context.json`.
- Starts `/bb/daemon/early-hack.js`.
- Scans the network, opens ports using available programs, nukes eligible servers, copies worker scripts, and runs weaken/grow/hack workers across rooted RAM.
- Writes `/bb/data/early-hack-state.json` each cycle.

## Next Iteration

Iteration 2 should add BitNode 2 handling as a dedicated daemon. The intended extension point is `/bb/daemon/supervisor.js`: add a BN2 daemon to the manifest, detect `context.bitNode === 2` or `context.capabilities.gang`, then launch the gang-specific daemon alongside the baseline hacking daemon.
