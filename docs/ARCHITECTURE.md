# Architecture

> Stage 2 — the **Universal Battle Engine**.

## Layers

```
screens/        compose the UI for one page
components/     reusable UI (ui / layout / hero / battle)
hooks/          timing only (the battle clock, animation beats)
state/          Zustand stores: player, navigation, battle runtime
assets/         manifest, resolver, fallbacks, ANIMATION CONTROLLER
game/           the bot, the only "random" actor
engine/         UNIVERSAL BATTLE ENGINE - pure, deterministic, asset-free
data/           tunables (balance.ts) and hero DATA
```

Dependencies only ever point **downward**.

| Rule | Why | Enforced by |
| --- | --- | --- |
| `engine/` imports nothing from `assets/`, `state/`, `components/`, `screens/` | gameplay stays asset-free and testable | `asset-check.ts` reads the engine sources |
| `engine/` performs no I/O and uses no `Math.random` | deterministic, replayable | `asset-check.ts` |
| The engine never names a hero or a file extension | a new hero needs no engine change | `asset-check.ts` |
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

`hooks/useBattleFlow.ts` owns the timers and nothing else. It asks the read
model what is happening and asks `presentation/audioEvents.ts` what that should
sound like; it never names a sound file and never reads a rule. The store holds
no timers, so the engine stays inspectable and replayable.

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

## Debug

`engine/debug.ts` is on in development and off in production, and can be
toggled at runtime from **Settings → Engine debug**. It logs a full round
snapshot:

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

`npm run verify` bundles three TypeScript suites with esbuild and runs them on
Node against the **real** modules — no mocks, no reimplementation of the rules.

| Suite | Checks | Covers |
| --- | --- | --- |
| `engine-check.ts` | 194 | the five worked examples from the spec, every acceptance combination, the state machine, hit/block across all 16 target pairs, KO, win, lose, draw, round history, determinism, PvP/bot parity |
| `flow-check.ts` | 58 | the real store: phase wiring, per-round bot lock, timers, countdown, execution order, timeouts, rematch |
| `asset-check.ts` | 178 | every event resolves to a registered asset, the documented mappings, hero-agnostic controller, engine purity, fallbacks |

```
All 194 battle rule checks passed.
All  58 battle flow checks passed.
All 178 animation controller checks passed.
```

`flow-check.ts` is what caught a bot that only locked its choice in round 1,
which left every battle stuck after the first round.

---

## Extension points

| Next stage | Where it plugs in |
| --- | --- |
| Reward economy | `playerStore.addGold`; award from `BattleResultOverlay` |
| Quests / achievements | `battle.roundHistory` is already archived for it |
| Leaderboard | needs a backend — nothing faked yet |
| Real PvP | `BattleEngine` is mode-agnostic; only a transport is missing |
| Hero skills | `Hero.skills` exists in the data model, the engine ignores it |
| New HP / stats | `CombatantSeed.hp` only — no constant is hardcoded |
| Battle replay | `RoundRecord.events` is stored and ordered |
