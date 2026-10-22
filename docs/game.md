# Roll Masters — Game Reference

This document describes the mechanics implemented in the current source, including
balance values and implementation quirks. It is a reference for maintaining and
developing the game, rather than a list of planned features. Gold is called
`energy` or `score` in parts of the code.

## Core loop

1. Start with 10 gold and an empty 16 × 16 board.
2. Buy dice, then tap or click them to roll for gold. A newly placed die rolls once
   automatically.
3. Add pawns and bishops to automate rolls, and knights and rooks to boost payouts.
4. Spend gold on research to improve income and unlock buildings.
5. Earn at least 1,000,000 gold during a run to prestige for permanent upgrades.
6. Rebuild with retained prestige upgrades and a larger starting gold balance.

There is no implemented victory condition. Progress consists of increasing income,
developing the board, buying upgrades, and completing further prestige runs.

## Board and controls

- Each cell holds at most one building. Building prices are fixed; owning more
  copies does not increase their price.
- Select a building tool, then tap or click empty cells to place copies. Placement
  requires enough gold and an unlocked building.
- Choose Done to return to Roll mode. In Roll mode, tapping a die rolls it and
  tapping a pawn activates its connected group.
- Tapping an occupied cell with a purchase tool also triggers its building.
- Remove deletes a building without a refund.
- Drag to pan; pinch or scroll to zoom. Menu → Board view provides centring and
  zoom controls. Escape clears the selected tool, or opens the menu in Roll mode.
- Neighbouring cells mean the four orthogonal cells: above, below, left, and right.
  Diagonal cells count only for the bishop's separate diagonal effect.

The board starts at 256 cells. Grid Size prestige upgrades increase both dimensions
by one per level, up to 32 × 32 (1,024 cells).

## Gold and dice rolls

Dice have six faces. A die cannot start another roll while already rolling;
additional manual or automated roll requests during that time are ignored.

The payout when a roll finishes is:

```text
gold = floor(face × multiplier) + Dice Boosters level
```

For example, rolling a 5 with a ×1.3 multiplier and Dice Boosters level 2 awards
`floor(5 × 1.3) + 2 = 8` gold.

Gold is credited when the roll finishes, independently of the floating gold
animation. Dice Boosters adds a flat bonus after multiplication.

### Multipliers

- Dice begin with a ×1 multiplier.
- Knight and rook effects add to this multiplier, rather than multiplying it.
- Stored multipliers are rounded to one decimal place and have no gameplay cap.
- The multiplier resets to ×1 after each payout; it is a bonus for one roll.
- Knights boost only dice that are not rolling when their arrival effect applies.
  Rooks can boost rolling dice before their payout.

### Roll duration and weight

Advanced graphics rolls take approximately 900–1,000 ms at the default roll speed
of 1. Basic graphics uses a separate delayed completion path; see the current
implementation notes below.

Dice Weight adds extra possible results above six and clamps those results to six:

```text
face = min(random.integer(1, 6 + Dice Weight level), 6)
```

Higher weight therefore makes sixes more common. The random helper currently
rounds a continuous random value; its integer outcomes are not uniformly
distributed. See the implementation notes for the effect on the displayed bonus.

## Buildings

All purchase costs below are gold. Research costs are separate from building costs.

| Building | Cost | Unlock | Effect |
| --- | ---: | --- | --- |
| Dice | 10 | Available from the start | Rolls for gold when placed or triggered. |
| Pawn | 100 | Place a die | Rolls orthogonally adjacent dice and activates connected pawns. |
| Wandering Knight | 1,000 | Buy Wandering Knight research level 1 | Moves to an empty orthogonal neighbour and boosts dice beside its destination. |
| Bishop | 10,000 | Buy Bishop research level 1 | Scans outward along its four diagonals, triggering dice at the current distance. |
| Rook | 125,000 | Buy Rook research level 1 | Travels in a random cardinal direction to the first empty cell, boosting dice passed. |

### Pawn

Pawns share an automation cycle of approximately 10 seconds. Each cycle queues
all pawns in random order, then processes one queued pawn per 100 ms. Large boards
can spread the work across multiple seconds.

Activating a pawn propagates through its orthogonally connected pawn group and
rolls dice bordering that group. Each visited pawn and die is handled once per
activation. Separate queued activations can revisit the same group. Pawns can
also be activated manually; manual activation does not require waiting for the
automation cycle.

### Wandering Knight

Despite its name, the knight moves one cell orthogonally rather than in a chess
knight's L shape. It chooses randomly among empty neighbours, normally moving
every 450–550 ms. A blocked knight stays in place until a move becomes possible.

On arrival, each eligible orthogonally adjacent die receives:

```text
multiplier increase = Wandering Knight research level / 10
```

Level 1 adds 0.1, level 5 adds 0.5, and so on. It strengthens dice but does not
roll them.

### Bishop

The bishop remains stationary. Its first tick occurs after approximately
500–1,000 ms. Each tick examines four diagonal cells at the current distance,
starting at distance 1, then increases the distance by one. It wraps back to
distance 1 after passing the board's largest dimension.

Only dice are triggered. Other buildings do not block the scan, and the bishop
does not roll every die along every diagonal simultaneously.

After the first tick, the interval is controlled by Bishop research:

```text
interval in milliseconds = min(1,000, 1,050 - 50 × research level)
```

Level 1 gives 1,000 ms per distance step; level 20 gives 50 ms.

### Rook

The rook chooses a random orthogonal direction and searches through occupied
cells for the first empty cell. If it finds one, it moves there and adds its
research level to each crossed die's multiplier. Other buildings can be crossed
but receive no bonus. A rook does not roll dice.

It cannot move if the chosen direction offers no valid empty destination.
After a successful move, the implementation schedules a 900–1,100 ms delay in
addition to its 450–550 ms tick interval, so successful moves are typically
about 1.35–1.65 seconds apart.

## Research upgrades

Research spends gold and applies to the current run. Unless a limit is listed,
an upgrade has no configured maximum level.

In the following table, `L` is the current level before purchasing the next level.
Costs are rounded down. A level-zero upgrade charges its base cost for the first
purchase; later costs follow the listed formula.

| Research | Availability | Starting level | First purchase cost | Later next-level cost | Effect | Maximum level |
| --- | --- | ---: | ---: | --- | --- | ---: |
| Passive Gold | Available from the start | 1 on a fresh player | 200 to reach level 2 | `100 × 2^L` | Base passive amount is `L²` per second, scaled by Passive Gold Boost. | 20 |
| Dice Boosters | Available from the start | 0 | 100 | `100 × (L + 1)²` | Adds `L` gold to every completed dice roll; level 5 unlocks Wandering Knight research. | Unlimited |
| Wandering Knight | Dice Boosters level 5 | 0 | 10,000 | `floor(10,000 × log2(L + 2))` | Unlocks knights at level 1; each arrival adds `L / 10` to eligible dice multipliers. Level 5 unlocks Bishop and Rook research. | Unlimited |
| Bishop | Wandering Knight level 5; also unlocked by Rook level 5 | 0 | 100,000 | `100,000 × (L + 1)` | Unlocks bishops at level 1 and reduces their interval by 50 ms per additional level. | 20 |
| Rook | Wandering Knight level 5 | 0 | 250,000 | `floor(250,000 × log2(L + 2))` | Unlocks rooks at level 1; each crossed die gains `L` multiplier. Level 5 also unlocks Bishop research. | Unlimited |

The usual unlock chain is:

```text
Place a die → Pawn construction
Dice Boosters level 5 → Wandering Knight research
Wandering Knight level 1 → Knight construction
Wandering Knight level 5 → Bishop and Rook research
Bishop level 1 → Bishop construction
Rook level 1 → Rook construction
```

### Passive gold calculation

The passive timer runs once per second:

```text
passive amount = Passive Gold level² × (Passive Gold Boost value / 100)
Passive Gold Boost value = 100 × Passive Gold Boost level
```

At Passive Gold level 3 and Passive Gold Boost level 2, the timer awards
`9 × 2 = 18` gold each second. The current level-zero boost behaviour is described
below; it prevents passive income on a fresh game until a boost is purchased.

## Prestige

Prestige points depend on total positive income recorded during the current run,
not the gold currently available to spend:

```text
points awarded = floor(gold earned this run / 1,000,000)
```

Spending gold does not reduce this progress. At 2,400,000 earned gold, prestiging
awards 2 points. The remaining 400,000 progress is discarded when the run resets.
Starting gold is assigned directly and does not count as earned income.

Open Ascend → Prestige to view progress, confirm a prestige, or buy permanent
upgrades. Prestige is unavailable until at least one point can be awarded.
Permanent upgrades can also be bought during a run if points are available.

| Reset on prestige | Retained on prestige |
| --- | --- |
| All buildings and board contents | All prestige upgrade levels |
| All research levels, including Passive Gold | Unspent prestige points, plus newly awarded points |
| Research and building unlocks | Total prestige count |
| Current run's earned-gold progress | Lifetime earned-gold statistic |
| Current gold balance, replaced with the new starting balance | Settings |

After each prestige, starting gold is `10 + 100 × total prestiges`: 110 after
the first, 210 after the second, and so on. Passive Gold resets to level 0;
unlike a fresh player's free level 1, it must be purchased again for 100 gold.

### Permanent upgrades

All costs below are prestige points. `L` is the current level before purchase.

| Upgrade | First cost | Later next-level cost | Effect | Maximum level |
| --- | ---: | --- | --- | ---: |
| Grid Size | 1 | `L + 1` | Board dimensions become `(16 + level) × (16 + level)`. Resizes the current board immediately. | 16 |
| Dice Weight | 2 | `2 × (L + 1)²` | Adds one weight per level, increasing the frequency of sixes. Updates existing dice as well as future dice. | 15 |
| Passive Gold Boost | 1 | `L + 1` | Value is `100 × level` percent, used as the full passive-income multiplier: level 1 is ×1, level 2 is ×2. | Unlimited |

## Saving and returning

- Progress is saved locally in the browser under the `save` localStorage key.
- The active game autosaves every 30 seconds and saves after board interactions
  and tool changes. Prestige explicitly saves the reset state.
- Saves include the board, player gold, research and prestige levels, unlocks,
  prestige points, and tracked player data.
- Settings are stored separately under `environment`.
- There is no implemented offline-income calculation or cloud synchronisation.
- Temporary dice multipliers are not serialized and return to ×1 after loading.

## Current implementation notes

These details describe existing behaviour, not additional design rules:

- **Passive income at boost level zero:** Passive Gold Boost has value 0 at level
  0. The passive formula multiplies by that zero, so fresh players currently earn
  no passive gold despite Passive Gold starting at level 1. The displayed
  percentage is used as the total multiplier, rather than a bonus added to 100%.
- **First research prices:** Dice Boosters, Wandering Knight, and Rook contain
  level-zero `_nextCost` overrides of 2,500, 2,500, and 500,000 respectively.
  However, the shared `nextCost` getter returns `baseCost` at level zero, so the
  effective first prices are 100, 10,000, and 250,000 as listed above.
- **Weighted-roll percentages:** Dice Weight's description calculates an expected
  improvement assuming uniformly distributed integers. The actual rounded random
  helper gives the endpoints less probability, so those displayed percentages
  do not precisely describe actual outcomes.
- **Basic graphics timing:** Basic mode sets both a future `lastTick` and a tick
  interval of 740–1,000 ms. Effective completion takes approximately twice that
  delay (1.48–2 seconds), plus frame scheduling. This path does not apply roll
  speed in the same way as advanced graphics.
- **Development mode economy:** Vite development mode bypasses gold and prestige
  spending checks and deductions. Production builds use the normal economy.

## Source map

Update this reference when changing the corresponding implementation:

| Area | Source |
| --- | --- |
| Building costs and tools | [Player actions](../src/player-systems/player-actions.ts) |
| Placement, controls, passive timer, player data | [Player base](../src/player-systems/player-base.ts) |
| Dice, pawns, knights, bishops, rooks | [Buildings](../src/buildings/) |
| Upgrade registry and shared purchase rules | [Registry](../src/components/player-upgrades-component.ts), [Upgrade](../src/components/upgrade-component.ts) |
| Research balance | [Research upgrades](../src/upgrades/research/) |
| Permanent upgrade balance | [Prestige upgrades](../src/upgrades/prestige/) |
| Cost and value growth functions | [Growth calculations](../src/utility/big-o-calculations.ts) |
| Gold credit and income tracking | [Score component](../src/components/score-component.ts) |
| Starting state, grid size, prestige reset, autosave | [Game scene](../src/scenes/game.scene.ts) |
| Prestige threshold and in-game instructions | [Game presentation](../src/ui/game-presentation.ts) |
| Save format and storage | [Player](../src/player-systems/player.ts), [Dice save system](../src/dice-save-system.ts) |
| Random outcomes | [Random helper](../src/utility/random.ts) |
