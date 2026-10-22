# Roll Masters UI

The game starts at the title screen. Continue loads the existing local save;
Start game enters the same load path when there is no save. No reset action is
exposed on the title screen.

## Ownership and flow

`PlayerUi` is a screen-plane scene actor owned and disposed by the player. It is
independent of the board camera. Input hit testing uses screen coordinates for
screen-plane panels and world coordinates for board actors.

Board tools and menus have separate state. Roll uses the existing `NONE` action
code; placement and removal retain their saved identifiers. Research and Prestige
open directly from the HUD. Closing a menu returns to Roll. The compact toolbar
shows Roll, Dice, Build and Remove; Build exposes every piece and its unlock
requirement. The desktop toolbar retains fixed slots for the existing pieces.

`GameMenu` uses a transient `NavigationStack` for Menu, Help, Settings and Build.
Each page retains its own paging position. Back/Escape returns to the caller and
restores its focused control; Close returns to play. Existing modal scopes own
input blocking, focus trapping and focus restoration. Production continues in
in-game menus. Returning to the title deactivates the game scene.

## Presentation

Currency and player-data changes emit `ui-state-changed`. The HUD derives its
display when invalidated; the score component no longer polls or creates labels.
Gold is committed immediately, independently of flying-gold feedback. Only
positive earnings contribute to run/lifetime earned gold. Existing save keys and
upgrade codes are unchanged; historical spending deducted by older versions
cannot be reconstructed.

Research and permanent upgrades use cards with visible descriptions, levels,
costs, affordability and a completed-items toggle. Prestige shows earned progress,
the live reward, and a separate confirmation with reset/retention consequences.
The command revalidates that at least one point is available. Its result screen
offers Spend points or Return to board.

Shared Help and Settings content is reused by title screens and in-game menus.
Back buttons on standalone reference pages remain outside paged content. Settings
include graphics, audio, larger text, reduced motion and flying gold. Reduced
motion also respects the system preference. New decorative art is not required.

## Responsive layout and validation

Roots reserve browser safe-area insets. Text wraps before paging; large text is
20% larger. The toolbar switches to compact mode below 900 viewport pixels.
Short wide upgrade screens put the summary beside the cards. First-run guidance
can be dismissed and is suppressed in short viewports to avoid obscuring controls.

Node tests cover history, focus, modal isolation, currency earning, the compact
toolbar, screen-space hit testing and retained-tree settling. These do not prove
canvas appearance, device usability or assistive-technology conformance. Browser
and physical-device checks require an explicit request under the repository rules.
Gamepad support, undoable removal and new illustrated help artwork are not part
of this implementation.

## Button theme

Shared `Button` widgets now use a procedural `ButtonSurface`, adapted from the
Integrated brackets variant of the supplied pixel-frame HTML reference. The
renderer draws green inset faces, gold bevels and connected corner brackets at
each control's actual dimensions. Corner details remain fixed as labels grow;
there is no sprite atlas or nine-slice dependency in the shared button renderer.
The old atlas utilities remain isolated for legacy graphics coverage.

Disabled, pressed, hover/focus and normal states have explicit palettes. Selection
has a persistent accent, while keyboard focus has a separate inset outline.
Text stays above the frame. Pointer, touch, keyboard and semantic button input
share the existing activation rules and click sound. A bounded 3px face/content
press eases over 100ms without changing layout or hit bounds. Reduced motion
uses immediate palette changes with stationary content. Animation settles fully,
including after cancellation and a long frame.

Node tests cover real Excalibur rectangle transforms, fixed brackets, tiny and
rectangular bounds, state priority, motion, keyboard/semantic activation and
unchanged layout/graphic counts. No browser or physical-device check was made.

## Settings layout

Title-menu and in-game settings share `SettingsRow` and `SettingsChoice`. Each
card contains a section label, left-aligned explanation, explicit choices and
any effective-state note. Selected choices use a check mark, green face and
brass underline; keyboard focus adds a light outline. Semantic buttons expose
`aria-pressed` and descriptive setting names.

Wide layouts place choices beside descriptions. Portrait layouts put choices
underneath; short landscape layouts use compact captions and a single header
line. Back and paging arrows share a persistent footer so paging does not consume
content height. Existing environment keys and values remain compatible. Changes
save immediately, audio changes apply immediately, and large text remeasures the
widget tree. A 100 ms confirmation wash respects reduced motion and system
preferences; it never changes hit bounds or delays input.

Node UI tests check geometry, paging reachability, touch target sizes, stable
layout, selection semantics and persistence in portrait, landscape, desktop and
large-text modes. These tests do not verify the canvas appearance, real audio or
physical touch interaction; no browser verification was performed.
