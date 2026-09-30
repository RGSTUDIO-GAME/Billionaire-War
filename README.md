# Billionaire War

Telegram Web App — **1 vs 1 auto battle**, maximum **3 rounds**.

This repository covers **Prompts 1 → 5**: the game shell and main UI, a
deterministic Universal Battle Engine, the full Battle Arena with its animation
layer, the **$GOLD battle reward** loop that closes the game, and the **data
layer** that makes the whole thing survive being closed. A battle is playable
end to end — pick, confirm, countdown, sequential execution, round transitions,
result, reward, and the player, their balance and their history are all still
there tomorrow. Anything that is not built yet says **COMING SOON** — nothing
is faked.

---

## Not in this stage (on purpose)

No blockchain, no wallet, no NFT, no smart contract, no token transaction, no
marketplace, no random damage, no critical hits, no second hero, no hero skills,
no shop, no matchmaking, no leaderboard, no server, no account, no cloud save.
$GOLD rewards and locally mined $BWAR are stored **on the device**; there is no
wallet, chain or token transfer.

---

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | TypeScript only |
| `npm run verify` | **995 assertions** — engine rules, store flow, presentation, rewards, data layer, animation, rendered screen, mining |
| `npm run assets:check` | Report which registered assets exist on disk |
| `npm run assets:placeholder` | Regenerate the bundled placeholder art/audio |
| `npm run lint` | oxlint |
| `npm run deploy` | Build and publish `dist/` to the `gh-pages` branch |

Deploy `dist/` to any static host. To run inside Telegram, point the BotFather
Web App URL at the deployed host; outside Telegram the app runs in a plain
browser with no Telegram dependency.

### Live build

**https://rgstudio-game.github.io/Billionaire-War/**

Source lives on `main`; the published site is the `gh-pages` branch, so the two
never interfere. Asset URLs are relative, which is why the same build works on
a project path, a custom domain, or a local server.

```bash
npm run deploy          # build + force-push dist/ to gh-pages
```

The script authenticates with whatever git already has — a `gh` credential
helper, an SSH remote, or `GH_TOKEN` in the environment. It stages the build in
a temporary directory, so a deployment never dirties the working tree or leaks a
build artefact into the source history.

---

## Project layout

```
src/
  data/
    balance.ts          All tunables: rounds, timer, damage table, currencies
    heroes/             Hero DATA (durov.ts) + the hero registry
  engine/               The Universal Battle Engine — pure, deterministic
    types.ts            Battle state machine + battle data model
    damage.ts           Hit / block / damage rules
    round.ts            Resolves both attacks of a round up front
    battle.ts           BattleEngine: every transition
    events.ts           Animation event vocabulary
    debug.ts            Toggleable battle logging
    random.ts           Seeded PRNG (used only by the bot, never by the engine)
  game/
    botStrategy.ts      Bot decisions, derived from the battle seed
  presentation/         The read model the screen draws, and the audio mapping
    battleView.ts       Engine state -> exactly what the arena shows
    audioEvents.ts      Engine event -> which sound plays
  rewards/              $GOLD only. No wallet, no chain, no token
    types.ts            Reward request / transaction / outcome
    rewardConfig.ts     THE amounts. A win is 1000 $GOLD; defeat/draw unpriced
    RewardEngine.ts     mode + result -> configured amount -> transaction
    settleBattleReward.ts  The only bridge from a finished battle to a balance
  storage/              The persistence layer — the only code that knows a device
    StorageAdapter.ts   read / write / remove / keys, degrading to memory
    keys.ts             Where each record lives, versioned for future migrations
    records.ts          The persisted shapes: profile, ledger entry, battle record
  repositories/         One repository per record, each validating what it reads
    playerRepository.ts   Identity, roster, equipped hero, balances
    goldRepository.ts     The append-only $GOLD ledger
    battleRepository.ts   The archive of finished battles
    heroRepository.ts     Ownership and equip rules, over a profile
  services/             Game rules over the data: gold, mining, trade, battle
    goldService.ts        The only place $GOLD ever moves
    battleService.ts      Battle ids and the battle archive
    rewardService.ts      BATTLE_RESULT -> $GOLD -> ledger -> history
    tradeService.ts       Local hero ownership and Gold <-> BWAR exchange
    telegram.ts           The Telegram bridge
  state/                Zustand stores: player, ui/navigation, battle runtime
    runtime.ts           The one place the data layer is wired together
  assets/               The asset layer — manifest, resolver, fallbacks
    animationController.ts   Battle event -> asset (the only visual mapping)
  components/           ui / layout / hero / battle components
  screens/              One file per screen
  audio/                SFX + music player built on the asset registry
  hooks/                Battle clock and animation timing
public/assets/          Every replaceable art and audio file
docs/                   ASSETS.md, ARCHITECTURE.md
scripts/                Asset generation, seven verification suites, asset report
```

---

## Battle rules (as implemented)

| Rule | Value |
| --- | --- |
| Battle | 1 vs 1, max 3 rounds, PvP and VS BOT on the same engine |
| Rounds | max 3 — there is no round 4 |
| Pick timer | 30 s per round, starts when the round starts |
| Pick | 1 attack target + 1 defense target, then CONFIRM |
| Targets | HEAD, BODY, ARM, LEG |
| Round 1 / 2 / 3 damage | 200 / 300 / 500 |
| Blocked | attack target === the target's defended part → 0 damage |
| Timer expires | that hero's targets become `null`: no attack **and** no defense |
| Choices | locked on CONFIRM; never randomised |
| Both confirmed | countdown starts immediately, the clock is not waited out |
| Countdown | 3 → 2 → 1 → FIGHT |
| Hidden | the opponent's choices stay unreadable until execution |
| Execution | A attacks first, then B — visual order only |
| Turn order | B is never skipped, even if A's attack already knocked B out |
| HP 0 | defeated, but only after both actions of the round resolve |
| Round 3 end | higher HP wins, equal HP is a DRAW |
| Draw | no sudden death, no random winner |

Damage is fixed per round. No critical hits, no random variance, no multiplier,
no elemental or armour modifier, no speed or initiative system. HP is a single
pool per hero — the body parts are only attack and defense targets.

`npm run verify` asserts all of the above against the real engine.

## Battle state machine

```
BATTLE_START → ROUND_START → SELECTION → WAITING_FOR_CONFIRM → COUNTDOWN
  → EXECUTION_PLAYER_A → EXECUTION_PLAYER_B → ROUND_RESULT
       → NEXT_ROUND (round 2 or 3)
       → BATTLE_RESULT
```

Exactly one status is active at a time. The engine is hero-agnostic
(`BattleEngine`, not `DurovBattleEngine`) and mode-agnostic: DUROV vs DUROV
drives the same transitions as a real PvP match.

## Battle Arena

The arena is one screen built for a thumb: fighter cards pinned top (name, HP
`current / max`, HP bar, the two targets), the two heroes facing each other in
the middle, a round log strip, and the selection panel along the bottom.

| Phase | What the player sees |
| --- | --- |
| Selection | `ROUND n / 3`, a 30s timer ring, ATTACK and DEFENSE pickers, CONFIRM disabled until both are set |
| Waiting | `Your choice is locked` + the opponent reported as `LOCKED` — never their targets |
| Before execution | `ATK ??? · DEF ???` on both fighters |
| Countdown | the pickers are replaced by `3 → 2 → 1 → FIGHT!` |
| Execution | the attacker lunges, the target takes `HIT -200` or `BLOCK 0`, HP drops smoothly, and the round log narrates |
| Round over | `ROUND n COMPLETE`, then `ROUND n+1 / 3` before the pickers return |
| Result | `VICTORY` / `DEFEAT` / `DRAW`, both final HP pools, rounds, damage dealt, damage received, and a reward placeholder |

A timeout is never randomised: the engine sets both targets to `null` and the
screen shows `NO ACTION` for that hero.

## Layers

```
BATTLE ENGINE  →  BATTLE EVENTS  →  PRESENTATION  →  BATTLE UI
```

- **Engine** (`src/engine/`) — every rule. Pure, deterministic, hero-agnostic.
- **Presentation** (`src/presentation/`) — a read model. `battleView.ts` turns
  engine state into exactly what to draw; `audioEvents.ts` turns an event into
  the sound that plays. Neither computes gameplay.
- **UI** (`src/screens/`, `src/components/`) — `DISPLAY → INPUT → EVENT`. The
  screen holds no rules: it does not know what `EXECUTION_PLAYER_A` means, and
  `npm run verify` fails if it ever starts to.

`useBattleFlow` owns timing only — the 30s clock, the countdown and the beat
between the two attacks. Deleting it would make the game slower, never
different.

## $GOLD rewards

A finished battle pays out exactly once:

```
BATTLE_RESULT → RewardService → amount from config → GoldService → ledger → result card
```

| Rule | How it is enforced |
| --- | --- |
| Priced per mode | `rewardConfig.vsBot` and `rewardConfig.pvp` are separate tables; one engine, two prices |
| Amounts live in config only | a win pays **1000 $GOLD**; losing and drawing are still unpriced `0` placeholders — change the number, change nothing else |
| Paid only after the battle | `settleBattleReward` returns `null` for all nine non-final engine states |
| Never twice | the settlement key is `battleId::playerId` and is derived from the persisted ledger, so a replay — **even after a reload** — resolves to `ALREADY_SETTLED` |
| Recorded | every payout appends a `GoldTransaction` with its before and after balances |
| Refused duplicates report the real payout | an `ALREADY_SETTLED` outcome is rewritten with the transaction the ledger already holds |
| BATTLE AGAIN is clean | each battle gets a fresh id, and the result card only shows the reward belonging to *its* battle |

The Battle Engine cannot move a balance — it knows nothing about rewards, and
`npm run verify` fails if any file under `src/engine/` so much as mentions one.
$BWAR wallets, chains and on-chain transfers are deliberately absent. Mining and
the local Trade menu only move balances saved on the device.

## The data layer

Everything the player earns is kept **on the device**, in a shape the game can
repair rather than trust:

```
UI → store → service → repository → StorageAdapter → localStorage
```

| Layer | Rule |
| --- | --- |
| `storage/` | the only code that knows `localStorage` exists; it degrades to memory when storage is blocked, and a failed write is reported rather than thrown |
| `repositories/` | one per record, and each one validates what it reads — junk, truncated JSON and hand-edited values are repaired or dropped, never fatal |
| `services/` | the game rules over that data; `GoldService` is the only place `$GOLD` is moved, while `TradeService` moves the local `$BWAR` balance and hero ownership |
| `state/` | mirrors the save so the UI can read it synchronously; a store action persists **before** the state changes |

What that buys, and what `data-check` asserts:

| Rule | How it is enforced |
| --- | --- |
| Survives a reload | identity, $GOLD, the roster, the equipped hero, the ledger and the battle history are read back from storage |
| A damaged save heals | each field is repaired on its own; a balance that cannot be read is rebuilt from the ledger, and an unrecoverable one starts the player over rather than at zero |
| A balance is never negative | a debit larger than the balance is refused outright — never clamped, because a clamped debit looks like a purchase that cost less than it should |
| $GOLD is auditable | every movement is a `GoldTransaction` carrying its before and after balances |
| A finished battle is history | archived once, newest first, and never for a battle that was abandoned |
| A reload cannot reissue an id | battle ids carry a per-session token, so a new battle after a reload can never look like one that was already paid |
| `Settings → Reset progress` really resets | the save is wiped and a new player minted — and the store still works afterwards |

There is no server, no account and no cloud save. `localStorage` is the whole
database, which is why every read is defensive and why the adapter is one small
interface: replacing it with a real backend is a change in one file.

## Animation events

The engine emits `ATTACK_HEAD`, `BLOCK_BODY`, `HIT`, `DEFEAT`, `VICTORY`, …
The **Animation Controller** (`src/assets/animationController.ts`) decides what
each one looks like, using hero data only. A new hero can therefore have
entirely different art without touching a single line of engine code.

## Debug

Confirming the round opens an in-battle inspector that shows the live engine
state, round by round. Engine logging defaults to on in development and off in
production builds.

## Screens

`HOME` · `QUEST` · `HERO` · `INVENTORY` · `TRADE` · `SETTINGS`, plus `LEADERBOARD` from
the trophy button in the top bar, `WAR` from the big button on Home, and
`MINING` from the BWAR Mining button.

- **Home** — equipped hero, base HP, currencies, the ⚔️ WAR button.
- **War** — VS BOT is playable. PvP shows **COMING SOON**: matchmaking is not
  implemented and no fake queue or fake opponent is simulated.
- **Hero** — DUROV with LOCKED / OWNED / EQUIPPED states and the equip button.
- **BWAR Mining** — choose one owned hero with positive hashrate, watch a local
  counter, and claim accrued $BWAR at any time. The counter reaches its full
  target after 24 hours and pauses until claimed.
- **Trade** — create custom-price Hero and Gold offers in `$GOLD` or local `$BWAR`,
  deliver completed sales, or delist an offer. Active assets stay in escrow and
  mining-stacked heroes must be unstacked first.
- **Quest**, **Inventory items**, **Leaderboard** — **COMING SOON** via the
  shared `ComingSoon` component.

`$GOLD` is internal game currency. `$BWAR` is earned locally through Mining —
there are no on-chain token transactions in this build.

---

## Adding a hero (30 seconds)

1. Drop art into `public/assets/heroes/<hero_id>/`.
2. `registerHeroAssets('<hero_id>')` in `src/assets/manifest.ts`.
3. Add a data file in `src/data/heroes/` and list it in `src/data/heroes/index.ts`.

The Battle Engine does not change. See [docs/ASSETS.md](docs/ASSETS.md).

---

## Docs

- [docs/ASSETS.md](docs/ASSETS.md) — where assets live, how to replace them,
  recommended sizes/formats, and the fallback behaviour.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — layer rules, data flow, and
  the extension points for the next stages.

## Verification

`npm run verify` bundles eight suites and runs them on Node — **995 assertions**:

| Suite | Covers |
| --- | --- |
| `engine-check` | the battle rules, including the specification's worked examples |
| `flow-check` | the store: phases, the bot's per-round lock, timers, result detection |
| `view-check` | the read model: labels, reveal timing, result events, damage totals |
| `reward-check` | the payout: every mode and outcome, config-driven amounts, the ledger, and never paying twice |
| `data-check` | the data layer: reload survival, damaged saves, the gold rules, the archive, and the layer boundaries |
| `asset-check` | the animation controller, hero-agnostic mapping, fallback chains |
| `render-check` | `BattleScreen` rendered for real at every phase of a battle |
| `mining-check` | eligible heroes, 24-hour timing, anytime claim, pause at full, one active session, and reload persistence |
