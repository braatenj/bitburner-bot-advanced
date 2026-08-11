# Interleaved BitNode Completion Playbook

> **Spoilers:** this is a full progression and completion guide. It names every major system, the endgame route, and the permanent rewards.

This is a general, automation-first critical path to **SF1–SF11 and SF13–SF15 at level 3**. It intentionally leaves the uncapped SF12 for after that objective. “Quickest” here means reducing later bottlenecks at the point a permanent unlock starts paying back—not minimizing the number of different BitNodes visited. It takes Singularity immediately after the first BN1 clear so future BitNodes can use automation sooner. It is not a save-specific speedrun.

The game’s own comprehensive guide correctly notes that no universal perfect order exists. This route chooses one reproducible order for a bot developer: early global multipliers, then cheap Singularity automation, then the systems that make hard nodes tractable. Mechanics and Source-File effects below follow the current official [BitNodes documentation](https://github.com/bitburner-official/bitburner-src/blob/stable/src/Documentation/doc/en/advanced/bitnodes.md), [comprehensive recommendation guide](https://github.com/bitburner-official/bitburner-src/blob/stable/src/Documentation/doc/en/advanced/bitnode_recommendation_comprehensive_guide.md), and [release notes](https://github.com/bitburner-official/bitburner-src/releases).

## Start here: tracker and completion rule

Before each entry, read `/bb/data/context.json` or run the supervisor: it records `sourceFileLevels`. Skip a row whose resulting `BNx.y` is already owned; do **not** repeat it just to preserve this numbering.

For ordinary nodes, the completion condition is: acquire The Red Pill, backdoor `w0r1d_d43m0n`, then use the terminal’s destroy action. BN6 and BN7 can instead be destroyed through the final Bladeburner Black Operation once its requirements are met. BN15 can obtain The Red Pill through its final dark-net lab (except BN8, where that route is unavailable). In every case, verify the BitVerse awards the stated Source-File level before entering the next row.

## Canonical clear-by-clear route

| # | Clear | Why now |
| ---: | --- | --- |
| 1 | BN1.1 | Establish the all-round permanent multiplier on the safest node. |
| 2 | BN4.1 | Unlock Singularity APIs outside BN4 before every future specialized node. |
| 3 | BN4.2 | Drop off-node Singularity RAM from 16x to 4x. |
| 4 | BN4.3 | Reach normal Singularity RAM cost; this is the automation breakpoint. |
| 5 | BN1.2 | Take the especially large second global boost after Singularity is available. |
| 6 | BN1.3 | Cap the baseline multiplier while BN1 is still the fastest script testbed. |
| 7 | BN5.1 | Unlock Intelligence, multiplier visibility, and permanent `Formulas.exe`. |
| 8 | BN5.2 | Increase core hacking multipliers before automation-heavy nodes. |
| 9 | BN5.3 | Cap the always-useful hacking bonus before its benefits compound across the route. |
| 10 | BN10.1 | Unlock Sleeve/Grafting APIs and the first permanent Sleeve. |
| 11 | BN10.2 | Add a second parallel worker before karma and Bladeburner grinds. |
| 12 | BN10.3 | Add a third permanent Sleeve; defer purchasable Sleeves to high-income runs. |
| 13 | BN2.1 | Unlock Gang outside BN2 and its crime/charisma boost. |
| 14 | BN2.2 | Improve reliable gang creation and crime income. |
| 15 | BN2.3 | Cap gang-adjacent crime/charisma value before hard-node preparation. |
| 16 | BN6.1 | Unlock the comparatively forgiving Bladeburner route and combat boost. |
| 17 | BN6.2 | Improve combat preparation for Bladeburner-backed hard nodes. |
| 18 | BN6.3 | Cap combat multipliers before BN7/BN9/BN13. |
| 19 | BN7.1 | Add permanent Bladeburner multipliers. |
| 20 | BN7.2 | Improve Bladeburner success/rank efficiency. |
| 21 | BN7.3 | Get The Blade’s Simulacrum for concurrent Bladeburner and other work. |
| 22 | BN3.1 | Unlock Corporation outside BN3 for players with a tested corp daemon. |
| 23 | BN3.2 | Improve charisma/company scaling while building that daemon. |
| 24 | BN3.3 | Permanently unlock the full Corporation API—the decisive automation breakpoint. |
| 25 | BN8.1 | Take permanent WSE/TIX access and a growth bonus for stock-based income. |
| 26 | BN8.2 | Add shorting once the pre-4S trader is proven. |
| 27 | BN8.3 | Add limit/stop orders and cap stock-related growth value. |
| 28 | BN14.1 | Strengthen IPvGO rewards after an IPvGO player/script exists. |
| 29 | BN14.2 | Unlock `ns.go.cheat` APIs for hard opponents. |
| 30 | BN14.3 | Cap IPvGO node-power and faction-favor benefits. |
| 31 | BN15.1 | Permanently unlock TOR, navigator, full dark web, and alternate Red Pill access. |
| 32 | BN15.2 | Improve charisma/authentication payoff after a darknet solver exists. |
| 33 | BN15.3 | Cap cache and faction-work rewards. |
| 34 | BN9.1 | Unlock Hacknet Servers after Bladeburner, Sleeves, and strong baseline income exist. |
| 35 | BN9.2 | Start future BitNodes with 128 GB home RAM. |
| 36 | BN9.3 | Start future BitNodes with a highly upgraded Hacknet Server. |
| 37 | BN13.1 | Unlock Stanek after hard-node support systems are ready. |
| 38 | BN13.2 | Enlarge the permanent Stanek benefit. |
| 39 | BN13.3 | Cap Stanek’s reusable grid benefit. |
| 40 | BN11.1 | Take the late, modest company/augmentation-price reward. |
| 41 | BN11.2 | Increase that late-game scaling. |
| 42 | BN11.3 | Cap every requested capped Source-File level. |

This is deliberately interleaved at the system level but not artificially between every repeat. `BN1.1 → BN4.1 → BN4.2 → BN4.3` prioritizes a fully usable automation API before the next general-purpose repeats; `BN1.2 → BN1.3` then finishes the broad baseline boost. The remaining repeats wait until the mechanic exists, and the hard nodes wait until Bladeburner/Sleeves and automation support them.

## Prerequisite map

| Later pressure | Unlocks that reduce it | What the bot still needs |
| --- | --- | --- |
| Any hacking/target choice | SF1, SF5 Formulas + Intelligence | formula-based batch planner |
| Karma and augmentations | SF2 Gang; SF10 Sleeves | gang manager; sleeve task manager |
| Faction/augmentation reset work | SF4 Singularity; SF10 Grafting/Sleeves | travel, work, purchase, install, graft planner |
| Long rank or hard-node finish | SF6/SF7 Bladeburner; SF7.3 Simulacrum; SF10 | Bladeburner safety/rank controller |
| High-income general route | SF3 Corporation; SF8 Stock | corporation state machine; pre-4S trader |
| BN9 and cross-node boosts | SF9 Hacknet Server | hash-spend and server-capacity controller |
| BN13 | SF13 Stanek plus Bladeburner | fragment layout/charging manager |
| IPvGO faction acceleration | SF14 IPvGO | move-selection and cheat-aware player |
| BN15 and alternate Red Pill | SF15 Darknet | discovery, puzzle, authentication, cache solver |

## Repository automation boundary

**Automated now:** this repository detects BitNode/Source-File state, launches baseline daemons, scans/roots servers, distributes weaken/grow/hack workers, reports targets, buys/upgrades purchased hosts, and offers generic Netscript invocation through `/bb/tools/ns-command.js`.

**Not automated here yet:** augmentations/Singularity workflows, Gang, Corporation, Stock, Bladeburner, Sleeves, Grafting, Hacknet Servers, Stanek, IPvGO, and Darknet. “Automation needed” below names the missing daemon before treating that node as hands-off. The player still owns irreversible choices and final verification.

## BN1 — Source Genesis

**Sequence:** #1 `BN1.1`, #5 `BN1.2`, #6 `BN1.3`. **Entry and victory:** no special prerequisite; use the standard Red Pill → `w0r1d_d43m0n` completion route.

- **Automated now:** run the supervisor, rooting, target selection, and baseline hack/grow/weaken loop.
- **Automation needed:** a true HWGW batch planner if the current early loop stops scaling.
- **Manual player action:** install productive augmentations, acquire The Red Pill, and destroy the node.
- **Manual verification:** confirm SF1 advances after each clear; do not leave BN1 before SF1.3.
- **Value / risk / return:** SF1 is the all-round multiplier and the official guide calls the 1.1→1.2 jump especially large. BN1 has no penalty modifiers, so fix scripts here. Return only for debugging, not for more capped levels.

## BN2 — Rise of the Underworld

**Sequence:** #13 `BN2.1`, #14 `BN2.2`, #15 `BN2.3`. **Entry and victory:** enter after SF10.3; form/operate a gang or use the normal Red Pill route, then destroy `w0r1d_d43m0n`.

- **Automated now:** income and rooted-server capacity from the baseline daemons.
- **Automation needed:** gang recruitment, task, equipment, ascension, and territory controller.
- **Manual player action:** choose the gang faction and set the first territory-clash policy.
- **Manual verification:** inspect wanted penalty, member task balance, and territory odds before enabling clashes.
- **Value / risk / return:** SF2 enables gangs outside BN2 and caps crime/money/charisma bonuses at 42%. Do not create a weak gang immediately or enable clashes too early; fall back to hacking and crime until income and combat strength are adequate. No later return is needed after #15.

## BN3 — Corporatocracy

**Sequence:** #22 `BN3.1`, #23 `BN3.2`, #24 `BN3.3`. **Entry and victory:** enter only with a tested corporation plan; build corporate income or use other income, then complete the standard route.

- **Automated now:** baseline hacking can finance the first corporation attempts.
- **Automation needed:** corporation cycle/state machine, purchases, staffing, research, products, and investment logic.
- **Manual player action:** choose whether to learn Corporation here and approve major investment/dividend decisions.
- **Manual verification:** check every corporation cycle, funds, morale, warehouse capacity, and investment offer.
- **Value / risk / return:** SF3.1 permits corporations elsewhere; SF3.3 permanently unlocks the full API, hence the immediate cap. A blind corp script is a trap—fallback to Gang/Bladeburner/hacking and return once the daemon is tested.

## BN4 — The Singularity

**Sequence:** #2 `BN4.1`, #3 `BN4.2`, #4 `BN4.3`. **Entry and victory:** have SF1.1; BN4 is harsher this early, so use manual actions until each Singularity workflow is tested, then use the standard completion route.

- **Automated now:** generic invocation can inspect singularity calls manually; it is not a workflow daemon.
- **Automation needed:** idempotent Singularity state machine for travel, faction/company work, backdoors, programs, augmentation purchase, and reset/install.
- **Manual player action:** approve augmentation/reset thresholds and any faction choice with permanent consequences.
- **Manual verification:** check current work, funds, faction reputation, and that every scripted connect/backdoor step succeeded.
- **Value / risk / return:** off-node Singularity RAM is 16x/4x/1x at SF4.1/.2/.3. Cap it now: SF4.3 is the difference between impractical and normal RAM costs. The node is harsher than BN1; fall back to manual terminal actions while the workflow daemon matures.

## BN5 — Artificial Intelligence

**Sequence:** #7 `BN5.1`, #8 `BN5.2`, #9 `BN5.3`. **Entry and victory:** finish BN1.3 and BN4.3 first; use hacking and the standard Red Pill route.

- **Automated now:** the existing scanner/rooter and workers can run unchanged.
- **Automation needed:** formula-informed prep and batch sizing that consumes permanent `Formulas.exe`.
- **Manual player action:** use multiplier visibility to choose realistic targets and augmentation goals.
- **Manual verification:** compare planned versus actual hack chance, grow, weaken, and RAM assumptions.
- **Value / risk / return:** SF5 gives permanent Intelligence, multiplier visibility, `getBitNodeMultipliers()`, `Formulas.exe`, and up to 14% hacking multipliers. Cap before BN4 so every later hacking decision benefits; return is unnecessary after #6.

## BN6 — Bladeburners

**Sequence:** #16 `BN6.1`, #17 `BN6.2`, #18 `BN6.3`. **Entry and victory:** have SF2.3/SF10.3; join Bladeburner after sufficient combat stats, finish the final Black Operation or use the normal route.

- **Automated now:** baseline hacking supplies supplemental money and RAM.
- **Automation needed:** Bladeburner action selector with success thresholds, stamina, chaos, population, and rank management.
- **Manual player action:** join the division and decide safe minimum success probability.
- **Manual verification:** monitor chaos, Synthoid population, stamina, and Black Operation success before each attempt.
- **Value / risk / return:** SF6 unlocks Bladeburner elsewhere and caps combat level/experience bonuses at 14%; BN6 has no Bladeburner penalty modifiers. If contracts are exhausted, use Sleeve tasks, training, and hacking while they regenerate. Finish all three before the harsher BN7/BN9/BN13.

## BN7 — Bladeburners 2079

**Sequence:** #19 `BN7.1`, #20 `BN7.2`, #21 `BN7.3`. **Entry and victory:** start with SF6.3 and SF10.3; complete the final Black Operation when safe, or use the normal route.

- **Automated now:** baseline hacking remains useful between Bladeburner actions.
- **Automation needed:** the same Bladeburner controller, extended for BN7 modifiers and simultaneous-work logic.
- **Manual player action:** accept Bladeburner membership and preserve the Stanek-before-membership ordering if later using SF7.3.
- **Manual verification:** confirm the Simulacrum appears immediately after joining once SF7.3 is earned.
- **Value / risk / return:** SF7 caps Bladeburner multipliers at 14%; SF7.3 grants The Blade’s Simulacrum. Do not burn rank on low-probability Black Ops; lower chaos/train/farm contracts first. This completion is the prerequisite platform for hard nodes.

## BN8 — Ghost of Wall Street

**Sequence:** #25 `BN8.1`, #26 `BN8.2`, #27 `BN8.3`. **Entry and victory:** require a tested pre-4S stock strategy; earn through stocks and destroy via the usual route (BN15’s alternate Red Pill route does not apply here).

- **Automated now:** server manipulation can support a stock model, but it does not trade.
- **Automation needed:** pre-4S forecast/inference trader, position/risk ledger, and optional hack/grow stock manipulation.
- **Manual player action:** set risk limits and approve the first capital deployment.
- **Manual verification:** audit cash, long/short exposure, commissions, forecast confidence, and liquidation conditions.
- **Value / risk / return:** SF8.1 grants WSE/TIX, .2 shorting, .3 limit/stop orders, and up to 21% hacking-growth multipliers. BN8 disables normal money paths: without a proven trader, do not force it—build/test the daemon in another node and return. Complete all levels while the stock system is active.

## BN9 — Hacktocracy

**Sequence:** #34 `BN9.1`, #35 `BN9.2`, #36 `BN9.3`. **Entry and victory:** enter only after Bladeburner, Sleeves, and a hash plan are ready; use hashes/Bladeburner and finish normally.

- **Automated now:** existing worker deployment can use ordinary rooted RAM, not hash economics.
- **Automation needed:** Hacknet Server upgrader that models production, capacity, spending priorities, and the RAM-versus-hash trade-off.
- **Manual player action:** choose hash-spend priorities when the economy changes.
- **Manual verification:** confirm hash production/capacity, spend effects, home RAM, and that no private-server assumption remains.
- **Value / risk / return:** SF9.1 enables Hacknet Servers, .2 starts future nodes with 128 GB home RAM, and .3 adds a highly upgraded server on new BitNode entry only. BN9 disables purchased servers and heavily nerfs hacking; fall back to Bladeburner and hashes, not an oversized server fleet. The #36 entry bonus will benefit every remaining target node.

## BN10 — Digital Carbon

**Sequence:** #10 `BN10.1`, #11 `BN10.2`, #12 `BN10.3`. **Entry and victory:** use the baseline income route, then complete normally after setting productive Sleeve and graft tasks.

- **Automated now:** hacking funds early training and grafting, but cannot operate Sleeves.
- **Automation needed:** Sleeve task/recovery/augmentation manager plus graft selection and travel scheduler.
- **Manual player action:** buy optional Sleeves and memory upgrades here; choose grafts after weighing their temporary debuff.
- **Manual verification:** inspect shock/synchronization, task conflicts, costs, and graft completion before changing strategy.
- **Value / risk / return:** each SF10 level grants a permanent Sleeve and API access exists from level 1. Cap now because parallel crime and Bladeburner work shortens BN2 and hard nodes. Purchasable Sleeves are expensive; if the run stalls, use a corp or batcher, buy them in BN10, then continue.

## BN11 — The Big Crash

**Sequence:** #40 `BN11.1`, #41 `BN11.2`, #42 `BN11.3`. **Entry and victory:** enter last, with every broadly useful system active; use the safest available income/finish route.

- **Automated now:** baseline hacking, rooting, reporting, and generic invocation remain available.
- **Automation needed:** no new mechanic; use the applicable existing Gang/Corp/Bladeburner/Singularity daemons.
- **Manual player action:** select the finish strategy based on the visible multipliers.
- **Manual verification:** review company favor, augmentation purchase order, and recovery plan after each reset.
- **Value / risk / return:** SF11 improves company salary/reputation, makes company favor increase both, and reduces augmentation price growth (up to 7%). Its rewards are modest for its harsh multipliers, so defer it. #42 completes the stated capped objective; do not detour into BN12 beforehand.

## BN12 — The Recursion (deferred)

**Sequence:** not a target. **Entry and victory:** only begin after #42; each clear uses the normal route and increases SF12 without a cap.

- **Automated now:** baseline hacking only.
- **Automation needed:** adaptive strategy selection across increasingly harsh multiplier sets.
- **Manual player action:** decide a practical stopping level and alter strategy as difficulty rises.
- **Manual verification:** check the next-node multipliers and free NFG level after every clear.
- **Value / risk / return:** SF12 grants free NFG levels equal to its level, but both node difficulty and reward scale forever. It is intentionally outside this playbook’s 42-clear validation target.

## BN13 — Church of the Machine God

**Sequence:** #37 `BN13.1`, #38 `BN13.2`, #39 `BN13.3`. **Entry and victory:** require the hard-node platform (especially Bladeburner, Sleeves, and SF9.3); accept Stanek’s Gift, use its fragments, and finish normally.

- **Automated now:** hacking/Bladeburner support only; no fragment control exists.
- **Automation needed:** fragment-layout optimizer and charging scheduler that preserves RAM/work priorities.
- **Manual player action:** accept Stanek’s Gift before buying augmentations (NFG excepted), and before joining Bladeburner if SF7.3 is active.
- **Manual verification:** inspect grid placement, charge, fragment effects, and the Gift’s multiplier penalty.
- **Value / risk / return:** Stanek is versatile but BN13 is extremely harsh. Use a focused fragment layout and Bladeburner fallback; Church augmentations can reduce the penalty. Cap it only after the supporting systems are ready.

## BN14 — IPvGO Subnet Takeover

**Sequence:** #28 `BN14.1`, #29 `BN14.2`, #30 `BN14.3`. **Entry and victory:** practice IPvGO first (it is available before BN14); use a reliable player/script and finish normally.

- **Automated now:** `ns-command` can invoke APIs, but it does not choose moves.
- **Automation needed:** board reader, legal-move strategy, opponent policy, and cheat-aware controller.
- **Manual player action:** practice the tutorial/manual game and choose acceptable use of cheat APIs.
- **Manual verification:** review win streaks, Node Power, faction favor, and every cheated move’s result.
- **Value / risk / return:** SF14 increases IPvGO node-power rewards, unlocks `ns.go.cheat` at level 2, and caps faction-favor benefit at level 3. If the bot loses consistently, fall back to the documented/tutorial strategy and test it outside the node before returning.

## BN15 — Digital Aether

**Sequence:** #31 `BN15.1`, #32 `BN15.2`, #33 `BN15.3`. **Entry and victory:** experiment with basic Darknet puzzles first; traverse/authenticate the net, obtain The Red Pill from the final lab or by the regular route, and destroy the node.

- **Automated now:** scanner/rooter is useful background infrastructure, but it does not traverse the Darknet.
- **Automation needed:** Darknet map/discovery, authentication puzzle solvers, cache collector, self-copy, phishing, and stock-promotion controller.
- **Manual player action:** solve unfamiliar puzzle types and decide how much Darknet depth to automate before committing.
- **Manual verification:** check authentication success, copied-script reach, cache rewards, and final-lab Red Pill state.
- **Value / risk / return:** SF15.1 permanently grants TOR, `DarkscapeNavigator.exe`, full dark web, and broad alternate Red Pill access; later levels improve charisma/authentication and cache/faction-work rewards. A basic solver can finish slowly; expand puzzle coverage rather than brute-forcing a stalled route.

## Validation checklist

- [ ] The table contains exactly 42 target entries: three each for BN1–BN11 and BN13–BN15.
- [ ] Every target is present exactly once as `BNx.1`, `BNx.2`, and `BNx.3`; BN12 is absent from the target table.
- [ ] Every BN1–BN15 section states an entry/victory condition and includes explicit automation/player ownership markers.
- [ ] All reference links render, and `README.md` links to this playbook.
