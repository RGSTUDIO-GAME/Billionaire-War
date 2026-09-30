# Architecture

> The **Universal Battle Engine** and the **data layer** that surrounds it.

## Layers

```
screens/        compose the UI for one page
components/     reusable UI (ui / layout / hero / battle)
hooks/          timing only (the battle clock, animation beats)
state/          Zustand stores: player, navigation, battle runtime, THE WIRING
assets/         manifest, resolver, fallbacks, ANIMATION CONTROLLER
game/           the bot, the only "random" actor
engine/         UNIVERSAL BATTLE ENGINE - pure, deterministic, asset-free
rewards/        what a finished battle is worth, and nothing else
services/       the rules over stored data: gold, battle identity, rewards
repositories/   one per persisted record, each validating what it reads
storage/        the ONLY code that knows a device has storage at all
data/           tunables (balance.ts) and hero DATA
```

Dependencies only ever point **downward**.

| Rule | Why | Enforced by |
| --- | --- | --- |
| `engine/` imports nothing from `assets/`, `state/`, `components/`, `screens/` | gameplay stays asset-free and testable | `asset-check.ts` reads the engine sources |
| `engine/` performs no I/O and uses no `Math.random` | deterministic, replayable | `asset-check.ts` |
| The engine never names a hero or a file extension | a new hero needs no engine change | `asset-check.ts` |
| Only `storage/` mentions `localStorage` | the database is replaceable behind one interface | `data-check.ts` |
| A repository imports nothing above it | a record knows nothing about stores or UI | `data-check.ts` |
| A service imports nothing above it | $GOLD rules do not depend on a screen | `data-check.ts` |
| Only `GoldService` computes a balance | the ledger describes every coin that moved | `data-check.ts` |
| The engine knows nothing about storage, a profile or a ledger | a battle cannot pay for itself | `data-check.ts` |
| `state/runtime.ts` is the only place the data layer is built | swapping it is a one-file change | `data-check.ts` |
| Only `assets/manifest.ts` holds asset paths | one place to retheme the game | — |
| No `if (hero.id === 'durov')` anywhere | heroes are data | `asset-check.ts` |

---

## The Universal Battle Engine

One engine, every hero, both modes. There is no `DurovBattleEngine` and no
per-hero special case: DUROV is simply the first `CombatantSeed` loaded into it.

```
engine/
  types.ts      BATTLE_STATUS, BattleState, CombatantState, RoundRecord, events
  damage.ts     getRoundDamage / evaluateOutcome / computeDamage
  round.ts      effectiveChoice, planRound, buildRoundRecord
  battle.ts     BattleEngine - every transition
  events.ts     the animation event vocabulary
  random.ts     seeded PRNG, used only by the bot
  debug.ts      toggleable logging
  index.ts      public API
```

`BattleEngine` is a frozen façade over pure functions, so transitions are
individually testable and the whole machine can be driven from Node.

### State machine

Exactly one status is active at a time. No boolean soup.

```
BATTLE_START
   -> ROUND_START        targets and confirmations cleared, 30s clock reset
   -> SELECTION          targets can be chosen
   -> WAITING_FOR_CONFIRM  one combatant locked in, waiting for the other
   -> COUNTDOWN          3 -> 2 -> 1 -> FIGHT
   -> EXECUTION_PLAYER_A A's attack lands
   -> EXECUTION_PLAYER_B B's attack lands  (always runs, even after a KO)
   -> ROUND_RESULT       both attacks resolved, HP final for the round
        -> NEXT_ROUND -> ROUND_START (round 2 or 3)
        -> BATTLE_RESULT  (terminal)
```

Illegal transitions return the state unchanged instead of throwing: a confirmed
combatant cannot change targets, B cannot attack before A, a third attack in a
round is ignored, and a confirm without both targets is rejected.

### Why `effectiveChoice` exists

```ts
effectiveChoice(combatant) ->
  combatant.confirmed && attackTarget && defenseTarget
    ? { attackTarget, defenseTarget }
    : { attackTarget: null, defenseTarget: null }
```

The timeout rule, the unconfirmed rule and the incomplete-pick rule all collapse
into this one function, so there is no special case anywhere else in the engine.

### Simultaneous decisions, sequential execution

`planRound(state)` resolves **both** attacks up front, from the simultaneous
choices, and stores them in `state.currentPlans`. Execution then applies them one
at a time so they can be watched:

```
applyAttack(state, 'A') -> EXECUTION_PLAYER_B   (A's damage applied)
applyAttack(state, 'B') -> ROUND_RESULT         (B's damage applied)
```

`applyAttack(B)` is **not** skipped when A's attack already reduced B to 0 HP.
The round only closes in `settleRound`, after both actions. Order is visual
only: there is no speed, initiative or first-strike mechanic.

Gameplay is fully decided before the first animation frame — the animation
plays `currentPlans`, it never recomputes anything.

### Winner rules

```ts
decideWinner(state)
  both at 0 HP  -> DRAW
  one at 0 HP   -> the other wins
  round 3 done  -> higher HP wins, equal HP is a DRAW
  otherwise     -> null, the battle continues
```

No sudden death, no random winner, no round 4.

---

## Battle data

```ts
BattleState = {
  battleId, mode, seed, status, currentRound,
  playerA: { heroId, name, maxHp, currentHp, attackTarget, defenseTarget, confirmed, defeated },
  playerB: { ... },
  secondsRemaining, countdown,
  currentPlans,        // both attacks, resolved when execution starts
  hpAtRoundStart,
  currentRoundRecord,
  lastEvents,          // events from the most recent transition
  roundHistory: [...], // every finished round
  winner, result,
}
```

HP is a **single pool** per hero. HEAD / BODY / ARM / LEG are only attack and
defense targets and never carry HP of their own.

### Round history

Every finished round is archived with both combatants' own targets, HP before
and after, damage dealt and taken, both resolved attacks, the ordered event
list, and whether the battle ended there. Replaying the archive alone
reproduces the live HP exactly — `engine-check.ts` asserts this.

The archive is the input for future replay, statistics, quests, achievements and
analytics. No replay UI is built at this stage.

---

## Animation events

The engine emits **what happened**; the Animation Controller decides **what it
looks like**.

```
ATTACK_HEAD  ATTACK_BODY  ATTACK_ARM  ATTACK_LEG
BLOCK_HEAD   BLOCK_BODY   BLOCK_ARM   BLOCK_LEG
HIT  BLOCK  NO_ACTION  DEFEAT  VICTORY  DRAW
ROUND_START  COUNTDOWN  FIGHT  ROUND_END  BATTLE_END
```

`eventsForAttack(plan)` is the single source of truth: the animation, the round
history and the SFX all read it, so they cannot disagree.

`assets/animationController.ts` maps an event to a hero visual, an asset id, an
effect and a label — always through `hero.assets`, never through a hero id.
A missing asset falls back through the registered chain and finally to inline
artwork, so it degrades instead of crashing.

---

## Battle runtime

`state/battleStore.ts` wraps the engine and owns nothing else. It never computes
damage; it only sequences transitions:

```
start              -> createBattle -> beginSelection -> bot locks in
selectAttack/selectDefense/confirmPlayer
tickSecond         -> 30 -> 0, expires unconfirmed choices, then COUNTDOWN
tickCountdown      -> 3 -> 2 -> 1 -> FIGHT -> EXECUTION_PLAYER_A
applyPlayerAAttack / applyPlayerBAttack
finishRound        -> settleRound -> BATTLE_RESULT, or the next round
```

The id for a new battle comes from `BattleService`, not from a counter in the
store: identity has to survive a reload without ever reissuing an id the
history already holds.

`hooks/useBattleFlow.ts` owns the timers and nothing else. It asks the read
model what is happening and asks `presentation/audioEvents.ts` what that should
sound like; it never names a sound file and never reads a rule. The store holds
no timers, so the engine stays inspectable and replayable.

---

## The data layer

```
UI -> store -> service -> repository -> StorageAdapter -> the device
```

Each arrow is the only way data moves. Nothing reaches past its neighbour, and
the bottom of the stack is a four-method interface.

### `storage/` — the device

`StorageAdapter` is `read / write / remove / keys`. `browserStorage()` probes
`localStorage` once and falls back to memory when it is unavailable (private
mode, a blocked third-party context, Node during a check). A write that throws
returns `false`; it is never rethrown, because losing a save must not end the
game. `keys.ts` holds one versioned key per record, which is what a future
migration hangs off.

### `repositories/` — the records

One repository per record, and **no read is ever trusted**. `parseProfile`,
`parseTransaction` and `parseBattleRecord` repair each field independently, so
one bad value cannot take a save down with it: a truncated write yields a
sanitised record or `null`, never an exception.

The ledger is the special one. It is append-only, each entry carries its own
before and after balances, and `rebuildBalance` reads the live figure back out
of it. That is what makes a damaged balance recoverable rather than lost — and
it is why the anti-duplicate keys are derived from the ledger instead of being
remembered in memory.

### `services/` — the rules

`GoldService` is the only place a `$GOLD` balance is computed or moved. It refuses a
debit larger than the balance outright rather than clamping it, because a
clamped debit looks like a purchase that cost less than it should. Every
movement writes through to storage before the caller sees the new profile.

`TradeService` owns local custom-price marketplace rules. Offers escrow a hero
or Gold balance, Delist returns an active asset, and Deliver credits the chosen
price while closing the listing. Delivered history can also be delisted. It
refuses a mining-stacked or final hero offer and performs no wallet or on-chain
transaction.

`BattleService` mints battle ids and owns the archive. The ids carry a
per-session token, so a battle started after a reload can never collide with one
already in the history — a collision would make a brand new battle look already
paid, and the player would silently never be paid for it.

`RewardService` is the bridge:

```
BATTLE_RESULT -> RewardEngine.settle -> amount from config
              -> GoldService.credit  -> ledger entry
              -> BattleService.archive -> battle record
```

It refuses anything that is not `BATTLE_RESULT`, and it derives what has
already been paid from the ledger, so calling it twice — or calling it again
after a reload — moves nothing and reports the payout that was really recorded.

### `state/` — the mirror

`state/runtime.ts` is the only file that builds a repository or resolves the
storage. A store is a write-through cache: every action persists **first** and
then mirrors the result, so the save and the screen can never disagree.

`playerStore` keeps its data and its actions separate, which is what lets
`resetProgress` wipe the save without replacing the store's own behaviour with
stubs. `applyReward` never pays — the service has already paid by then, and the
action only re-reads the save so the result card can only ever show a
transaction the ledger actually holds.

---

## Presentation layer

`presentation/battleView.ts` is a pure read model: `buildBattleView(state)`
turns engine state into the round label, the selection state, the per-fighter
event that is animating, the round log, the between-round banner and the end
summary. It computes no gameplay — no damage, no winner, no block, no HP, no
round, no timeout. The only derived numbers are display helpers.

`presentation/audioEvents.ts` is the only module that names a sound. An event
in, a cue out, silent when an asset is missing.

The screen consumes one view model and emits intent. Reading the opponent's
defense comes from the resolved plan aimed at that fighter, never from the live
combatant — which is why a pre-execution pick can never leak.

The bot locks in at the start of **every** round, through the same
`setAttackTarget` / `setDefenseTarget` / `confirm` calls a remote PvP opponent
would use, so both modes share one code path. It cannot see the player's pick:
decisions are simultaneous.

---

## Reward system

```
BATTLE ENGINE ──(BATTLE_RESULT)──> REWARD ENGINE ──> PLAYER STORE
```

`rewards/RewardEngine.ts` is pure and universal, exactly like the battle engine:
`mode + result + battleId + playerId + createdAt` in, a `GoldTransaction` out.
It reads `rewards/rewardConfig.ts` and touches no store, no balance and no
clock. The only way to price the game is to edit the config.

`rewards/settleBattleReward.ts` is the single bridge. It refuses to settle
anything that is not a finished battle, and it is safe to call repeatedly: the
engine resolves a second call to `ALREADY_SETTLED` and nothing is applied. The
player store repeats the guard, so the balance cannot be credited twice even if
something asks twice.

A battle can therefore never pay out, and a reward can never be invented — each
needs the other, and neither can do the other's job.

---

## BWAR Mining

```
HOME / BWAR BALANCE ──> MINING SELECT ──(Equip)──> MiningService ──> PLAYER PROFILE
                                                       │
                                                   24-hour timer
                                                       │
                                             Claim ──> local BWAR balance
```

`MiningService.start` snapshots the selected hero's hashrate and its exact
24-hour target into the single `profile.mining` session. The UI derives its
moving counter from `startedAt`; it never writes the balance. Once elapsed
reaches `MINING_DURATION_MS`, progress clamps at the target and the Claim button
becomes available.

`MiningService.claim` can run at any time: it credits the amount accrued so far,
persists the profile, and immediately starts the same hero's next cycle. At full,
progress clamps until that claim is made. Equipping another hero replaces the one
active session, so there is never more than one mining hero. The session and
balance both live in the player profile, which makes them survive reloads
without a new storage record.

---

## Debug

`engine/debug.ts` is on in development and off in production. It logs a full
round snapshot, and confirming a round opens the same state as an in-battle
inspector:

```
Round: 2
A Attack: HEAD   A Defense: LEG   confirmed=true
B Attack: BODY   B Defense: HEAD  confirmed=true
#1 A -> B : HEAD vs BODY = HIT (300)
#2 B -> A : BODY vs HEAD = BLOCK (0)
```

The in-battle debug panel reads live engine state, so it can never disagree with
the rules.

---

## Verification

`npm run verify` bundles eight TypeScript suites with esbuild and runs them on
Node against the **real** modules — no mocks, no reimplementation of the rules.

| Suite | Checks | Covers |
| --- | --- | --- |
| `engine-check.ts` | 198 | the five worked examples from the spec, every acceptance combination, the state machine, hit/block across all 16 target pairs, KO, win, lose, draw, round history, determinism, PvP/bot parity |
| `flow-check.ts` | 92 | the real store: phase wiring, per-round bot lock, timers, countdown, execution order, timeouts, rematch |
| `view-check.ts` | 103 | the read model the screen draws: labels, reveal timing, result events, damage totals |
| `reward-check.ts` | 158 | every mode and outcome pays, the amount comes from configuration, the ledger records it, and it is never paid twice |
| `data-check.ts` | 176 | reload survival, damaged-save recovery, the $GOLD rules, the battle archive, id uniqueness across sessions, and the layer boundaries |
| `asset-check.ts` | 183 | every event resolves to a registered asset, the documented mappings, hero-agnostic controller, engine purity, fallbacks |
| `render-check.tsx` | 66 | `BattleScreen` rendered for real at every phase of a battle |
| `mining-check.ts` | 19 | eligible heroes, 24-hour timing, anytime claim, pause at full, single active hero and reload persistence |

```
All 198 battle rule checks passed.
All  92 battle flow checks passed.
All 103 presentation layer checks passed.
All 158 reward system checks passed.
All 176 data layer checks passed.
All 183 animation controller checks passed.
All  66 battle screen render checks passed.
All  19 mining checks passed.
```

`flow-check.ts` is what caught a bot that only locked its choice in round 1,
which left every battle stuck after the first round. `data-check.ts` is what
caught a `resetProgress` that replaced the store's own actions with stubs, and a
settlement guard that compared battle ids against `battleId::playerId` keys and
therefore never matched — a bug that would have paid for the same battle twice
after a reload.

---

## Extension points

| Next stage | Where it plugs in |
| --- | --- |
| Quests / achievements | `battle.roundHistory` is archived, and `BattleRecord` is persisted |
| Leaderboard | needs a backend — nothing faked yet |
| Real PvP | `BattleEngine` is mode-agnostic; only a transport is missing |
| Hero skills | `Hero.skills` exists in the data model, the engine ignores it |
| New HP / stats | `CombatantSeed.hp` only — no constant is hardcoded |
| Battle replay | `RoundRecord.events` is stored and ordered |
| More heroes | a data file plus `public/assets/heroes/<id>/`; the engine does not change |
| A shop | `GoldService.debit` already refuses an overspend and records the spend |
| A server save | implement `StorageAdapter` and pass it to `createRuntime` — nothing above changes |
| A save migration | bump `STORAGE_VERSION` and add a `…:v2` loader beside the `…:v1` key |
