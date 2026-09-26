# Asset System

> **GAMEPLAY CODE ≠ ASSET CODE.**
> The Battle Engine never imports an asset. Assets are presentation only.
> Replace every visual and every sound in the game without touching a single
> line of gameplay logic.

---

## 1. Where assets live

All replaceable files are in `public/assets/`. Nothing else contains a path.

```
public/assets/
  heroes/<hero_id>/
    character.svg      full body, used in menus and the hero screen
    idle.svg           neutral battle stance
    attack_head.svg    attack pose aimed at HEAD
    attack_body.svg    attack pose aimed at BODY
    attack_arm.svg     attack pose aimed at ARM
    attack_leg.svg     attack pose aimed at LEG
    defense.svg        blocking / taking a hit
    hit.svg            reacting to damage
    victory.svg        winner pose
    defeat.svg         loser pose
  backgrounds/
    battle_arena.svg   battle stage
    home.svg           home screen backdrop
    menu.svg           app backdrop (desktop, behind the phone column)
  ui/
    panel.svg
    divider.svg
    button_glow.svg
  icons/               one file per icon (see list below)
  effects/
    hit_spark.svg      impact flash
    block_shield.svg   block flash
    damage_number.svg
  sounds/
    ui_select.wav  ui_confirm.wav  countdown_tick.wav
    attack_whoosh.wav  hit.wav  block.wav  victory.wav  defeat.wav
  music/
    battle_theme.wav
```

---

## 2. The global asset configuration

**`src/assets/manifest.ts` is the only file in the codebase that contains an
asset path.** Everything else refers to assets by *id*.

```ts
export const heroAssetIds = registerHeroAssets('durov');   // -> ids, not paths
export const backgroundIds = { battleArena: ..., home: ... };
export const iconIds = { home: ..., heart: ..., };
export const soundIds  = { hit: ..., block: ... };
```

At runtime:

```ts
getAssetUrl(iconIds.heart)      // -> "/assets/icons/heart.svg"
getFallbackChain(iconIds.heart) // -> [file, ...fallbacks, inline artwork]
```

---

## 3. Replacing an asset

### Same format (fastest)

Drop a file with the **exact same name and extension** into the same folder.
Nothing else changes.

```
public/assets/heroes/durov/attack_head.png   <-- your new file, same name
```

### Different format (PNG instead of SVG, sprite sheet instead of image)

Edit **one line** in `src/assets/manifest.ts`:

```ts
export const heroFiles: Record<HeroAssetKey, string> = {
  character: 'character.png',   // was character.svg
  idle: 'idle.webp',
  attackHead: 'attack_head.png',
  // ...
};
```

The id stays the same, so the hero data, the battle engine and the UI are
untouched.

### Swapping the whole game skin

Replace the contents of `public/assets/` and, if you also renamed files, update
`heroFiles` in the manifest. That is the entire job.

---

## 3b. The Animation Controller

`src/assets/animationController.ts` is the only place where a battle event
becomes a picture. The Battle Engine emits **what happened**:

```
ATTACK_HEAD  ATTACK_BODY  ATTACK_ARM  ATTACK_LEG
BLOCK_HEAD   BLOCK_BODY   BLOCK_ARM   BLOCK_LEG
HIT  BLOCK  NO_ACTION  DEFEAT  VICTORY  DRAW
```

and the controller decides **what it looks like**, always through hero data:

```ts
resolveCue(hero, event) -> { visual, asset, effect, label, motion }
```

| Event | Hero asset used |
| --- | --- |
| `ATTACK_HEAD` / `_BODY` / `_ARM` / `_LEG` | `attackHead` / `attackBody` / `attackArm` / `attackLeg` |
| `BLOCK_*` | `defense` |
| `HIT` | `hit` |
| `DEFEAT` / `VICTORY` | `defeat` / `victory` |
| `NO_ACTION`, `DRAW`, round-level events | `idle` |

Consequences for you as the project owner:

- **To restyle one animation**, swap the file behind that asset id. Nothing else.
- **To give a new hero different art for the same events**, just point its
  asset ids at different files. The mapping code never changes.
- **The controller contains no hero names.** `npm run verify` fails if a hero id
  or a file extension ever appears in it or anywhere in `src/engine/`.

If you later want a hero whose "block" pose differs per body part, extend
`eventToAsset` with a `BLOCK_*` branch that reads `hero.assets.defense*`. The
engine is unaffected either way.

---

## 4. Fallback behaviour

Every hero asset resolves through a fallback chain:

```
durov/attack_head.svg        real file
        ↓ (missing)          heroes.__placeholder_pose  (inline artwork)
        ↓ (still nothing)    data-URI SVG, always generated in code
```

- A missing file **never** crashes the app and **never** leaves a blank box.
- `<AssetImg>` walks the chain on `onError` and re-renders automatically.
- Audio is even safer: a missing `.wav` simply plays nothing.
- Entries registered with an empty `file` are inline-only and never issue a
  request (used for the hero fallbacks).

Check what is on disk at any time:

```bash
npm run assets:check
```

```
Registered assets : 54
  on disk         : 52
  using fallback  : 0
  inline only     : 2 (no file by design)
```

---

## 5. Adding a new hero

The Battle Engine stays exactly the same. Three steps:

**1 — Art**

```
public/assets/heroes/<hero_id>/
  character.svg  idle.svg  attack_head.svg  attack_body.svg
  attack_arm.svg attack_leg.svg defense.svg  hit.svg
  victory.svg defeat.svg
```

Missing files are fine — they fall back.

**2 — Register the assets** (`src/assets/manifest.ts`)

```ts
export const heroAssetIds = registerHeroAssets('durov');
export const newHeroAssetIds = registerHeroAssets('novak');   // add this
```

**3 — Add the data** (`src/data/heroes/novak.ts`)

```ts
export const NOVAK: Hero = {
  id: 'novak',
  name: 'NOVAK',
  title: 'The Iron Heir',
  bio: '...',
  hp: 1000,               // any HP - the engine is not hardcoded to 1000
  rarity: 'rare',
  free: false,
  priceInGold: 2500,
  skills: [],             // no skills this stage
  assets: newHeroAssetIds,
};
```

Then list it in the registry:

```ts
// src/data/heroes/index.ts
export const HEROES: readonly Hero[] = [DUROV, NOVAK];
```

To make it obtainable, grant it from the reward system (Stage 2) or temporarily
via `usePlayerStore.getState().grantHero('novak')`. Free heroes are auto-granted
to new players via `HEROES.filter(h => h.free)`.

**No engine change. No UI change. No `if (hero.id === ...)` anywhere.**

---

## 6. Recommended formats and sizes

| Asset | Format | Size | Notes |
| --- | --- | --- | --- |
| Hero character / poses | PNG or WebP | 512 × 768, transparent | 2:3 aspect, feet near the bottom |
| Battle sprite | PNG or WebP | 512 × 768, transparent | keep the same silhouette across all 10 poses |
| Backgrounds | JPG or WebP | 1920 × 1080 | 16:9, they are cropped with `cover` |
| Icons | SVG | 24 × 24 | `stroke="currentColor"`, inherits colour and animates |
| UI panels | SVG | any | stretch to fill |
| Effects | SVG or WebP | 128 × 128 | transparent |
| Sounds | WAV or OGG | ≤ 1 s | short SFX, 22 kHz mono is fine |
| Music | OGG or WAV | looping | keep under ~1 MB |

### Hero animation

Currently each pose is a **static image**. To use animated sprites:

1. Export a spritesheet or a GIF/WebP with the same file name.
2. Or register an animated WebP at the same path — `<img>` plays it automatically.

If you later want frame-by-frame control, change only `src/assets/AssetImg.tsx`
to render a canvas; no gameplay file references an image element.

### Responsive behaviour

Layouts are fluid (`clamp()`, grid, `dvh`) and every sprite is
`object-fit: contain`, so the same assets work on mobile portrait, tablet and
desktop. Backgrounds use `background-size: cover`. Nothing is positioned for a
single resolution.

---

## 7. Regenerating the bundled placeholders

The files currently in `public/assets/` are generated SVG/WAV placeholders so
the game looks alive on day one. They are **normal files** — overwrite them and
they are gone.

```bash
npm run assets:placeholder
```

Editing `scripts/generate-placeholder-assets.mjs` changes the generator, not the
game. Once you have real art you can simply delete the placeholder script.

---

## 8. Icon list

`home` `quest` `inventory` `hero` `settings` `trophy` `swords` `heart`
`shield` `target` `lock` `clock` `coin` `gold` `bwar` `star` `back` `bolt`
`robot` `user` `part_head` `part_body` `part_arm` `part_leg`

Add a new one: drop the file in `public/assets/icons/` and add a line to
`iconIds` in the manifest. Icons are `currentColor`, so they pick up whatever
colour the surrounding CSS applies.
