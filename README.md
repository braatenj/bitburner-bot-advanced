# bitburner-bot-advanced

Plain JavaScript Bitburner automation scripts. The bootstrapper detects the active BitNode, launches its dedicated daemon, and starts the reusable modules that node needs. The current reusable modules provide early-game hacking and purchased-server management from an 8GB home server.

For the spoiler-inclusive, automation-aware Source-File progression route, see the [Interleaved BitNode Completion Playbook](BITNODE_PLAYBOOK.md).

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
run /bootstrap.js --cloud-min-size 32 --cloud-money-buffer 1000000000
run /bb/daemon/supervisor.js --watch
run /bb/tools/server-report.js
run /bb/tools/ns-command.js getServerMoneyAvailable n00dles
run /bb/tools/ns-command.js singularity.getCurrentWork
```

`--cloud-min-size` sets the smallest purchased-server tier in GB. `--cloud-money-buffer` reserves that amount of cash before the cloud-host daemon purchases or upgrades servers. Purchases never drop below the largest tier it has already purchased.

`/bb/tools/server-report.js` is a manual report. It lists every discovered server and scores each rooted, hackable money target by expected money per second using the total installed rooted RAM as the batch capacity. Its target scores assume a fully prepped server.

`/bb/tools/ns-command.js` invokes a Netscript API function and prints its result to the terminal. It supports top-level commands, an optional `ns.` prefix, and dotted API paths, so `ns.getHackingLevel` and `singularity.getCurrentWork` both work. Supply arguments after the command; use a `json:` prefix for object or array arguments, for example `json:{"threads":4}`. The tool reserves the called API's RAM cost, so home needs enough free RAM for the selected command.

- `--target <server>` forces the early hacking daemon to use a specific money server when it is rootable and hackable.
- `--reserve-home <gb>` keeps home RAM free. The default `auto` reserve uses `0GB` on an 8GB home server.
- `--watch` keeps the supervisor alive to restart the hacking and cloud-host daemons if either exits. The default supervisor mode starts both daemons and exits so early-game RAM stays available.

## Current Scope

- Detects the current BitNode and active Source-File levels via `ns.getResetInfo()`.
- Writes runtime context to `/bb/data/context.json`.
- Hands off to `/bb/daemon/bn1.js` through `/bb/daemon/bn15.js`; each daemon applies its node-specific module profile.
- Starts `/bb/modules/hacking-manager.js` and/or `/bb/modules/server-manager.js` when its profile permits them. BN8 starts neither because normal hacking and purchased-server income do not apply; BN9 omits purchased servers.
- Scans the network, opens ports using available programs, nukes eligible servers, copies worker scripts, and runs weaken/grow/hack workers across rooted RAM.
- Writes `/bb/data/early-hack-state.json` each cycle.

## Module Naming Convention

Reusable BitNode services belong in `/bb/modules/` and must be named `[TASK]-manager.js` (for example, `/bb/modules/hacking-manager.js` or `/bb/modules/server-manager.js`). Keep manually run information utilities in `/bb/tools/` and low-level hack/grow/weaken workers in `/bb/workers/`.

## Next Iteration

Add specialized modules (Gang, Corporation, Singularity, Bladeburner, Stock, Hacknet, Sleeves, Stanek, IPvGO, and Darknet) and enable them in the matching profile in `/bb/modules/bitnode-profiles.js`. Keep manual reporting/information utilities in `/bb/tools/` and low-level hack/grow/weaken scripts in `/bb/workers/`.
