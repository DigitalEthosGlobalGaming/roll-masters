# UI lifecycle and authoring

The UI uses retained Excalibur actors. `Panel` owns a cached child registry,
measurement, invalidation, and graphics; base widgets have no player lookup.
Game-specific presenters supply state and callbacks. Named children are reused,
and a conflicting constructor for an existing child name throws an error.

## Hooks

| Hook | Responsibility | Avoid |
| --- | --- | --- |
| `onSetup()` | Create children and bind callbacks once per widget instance. | Viewport-dependent sizing before attachment. |
| `onRefresh()` | Derive complete properties from application state; reconcile dynamic collections by stable keys. | Assuming a previously disabled/hidden state will reset itself. |
| `measure()` | Return local desired bounds using child sizes and padding. | Parent measurement, child creation, or graphics allocation. |
| `onLayout()` | Position children and assign their final explicit sizes. | Alternating a child's size between two values each pass. |
| `onRender()` | Update retained text, tint, sprite offsets, and other graphics. | Subscriptions, widget creation, application commands, or unconditional track/background creation. |
| `onViewportChanged()` | Invalidate or update the viewport root's dimensions. | Per-frame viewport polling. |
| `onResize(old, next)` | React to a measured size change. | Directly recursing into ancestor measurement. |

`render()` resolves refresh/layout changes in at most 12 passes before painting
once, so parent-assigned dimensions reach nested content before it appears.
Unresolved work at the cap, and changes raised during paint, continue next frame.
Layout and
paint are separate flags. A clean root returns immediately, and clean subtrees
are skipped. The Excalibur engine still updates/draws its actors; these guarantees
describe UI rebuild work, not the entire engine's frame cost.

Use `invalidate()` when application state needs refresh, `invalidateLayout()`
when geometry changes, and `invalidatePaint()` for visual state only. Widget
setters already choose the appropriate invalidation. `dirty = true` remains a
compatibility alias for refresh; `allDirty = true` is for rare whole-tree refreshes
such as a newly loaded font. Prefer updating the specific view that changed.

`metrics` exposes setup, refresh, layout, and paint counts. `graphicCount` exposes
retained graphics. For an unchanged settled tree, 1,000 calls to `render()` must
leave all counts unchanged. A hover-color change should not measure or arrange.

## Geometry

Explicit `size` is a border box, including padding. Auto panels use the union of
child bounds plus padding. They retain the children's coordinate origin; their
local bounds can therefore be off-center. `List`, `Label`, and `Button` measure
centered boxes. Use `localBounds`, `bounds` (parent coordinates), and `globalBounds`
deliberately. Hit testing transforms the pointer into the widget's local space.

`visible = false` hides and disables interaction while retaining geometry.
`collapsed = true` additionally removes the child from stack measurement and gaps.
`List` inserts spacing only between non-collapsed children. Empty label text
measures zero content without overriding explicit visibility.

Position helpers such as `topLeft`, `bottomCenter`, `xPos`, and `yPos` invalidate
ancestor layout. Direct `pos` mutations inside arrangement code are useful when
the container's measurement is independent of child placement. If application
code directly moves a child of an auto-size free-form panel, call the parent's
`invalidateLayout()` afterward. Return to auto sizing with `useContentSize()`.

Use `ScreenPanel` for viewport-sized menus, `List` for vertical stacks, and
`ScrollPanel` for bounded paged content. The latter provides touch/keyboard usable
Previous/More controls and excludes off-page rows from rendering and input.
Rows larger than the viewport are scaled to fit; prefer wrapping their labels
first to keep text readable. The action toolbar wraps into rows on narrow screens.

## Input and ownership

Decorative panels do not accept input. Buttons and sliders opt in to the primary
button. The scene input manager chooses one target by z-order, tree depth, and
stable entity ID, rather than activating every overlapping actor. Each pointer
retains its press owner through release or cancellation; a six-pixel movement
threshold distinguishes clicking from dragging.

Use `Button.onClick` or `activate()` for commands. `onPointerPressed` is the shared
valid press/release activation hook for other controls, including grid placement.
Do not override `onPointerUp` to execute commands. Up/cancel are cleanup hooks and
may arrive outside the original target. State wrappers are fresh per dispatch;
they never change an engine event's prototype or retain another manager's targets.

Modals register an input scope, block board input across the viewport, close on
Escape or their Close button, and restore focus. Tab and Shift+Tab navigate
eligible controls; Enter/Space activate buttons; arrows/Home/End adjust sliders.
Button/range DOM companions expose names and values to assistive technology.
They are hidden for inactive scenes, hidden widgets, and background modal content.
This semantic integration has unit coverage but still requires an explicitly
requested assistive-technology usability check before claiming accessibility
conformance.

Put subscriptions in the widget's owned `subscriptions` collection. Kill widgets
through `removePanel()`/`removeAllPanels()` so children, input registration,
semantic controls, and listeners are disposed together. Instance-owned subscriptions survive a live
widget being detached; root viewport/font subscriptions close on removal and
rebind on attachment. Setup does not repeat
when a live widget is reattached. Keep attachment-scoped engine subscriptions in
`onAdd`/`onRemove`, and call superclass hooks.

## Verification

For nested background graphics, preserve the parent's supplied drawing offset:
use the default `GraphicsGroup` anchoring. The outer actor-local `Panel` group
uses `useAnchor: false` intentionally; copying that setting into nested groups
discards their offsets. Run the real-engine transform regressions in
`tests/graphics-rendering.test.mjs` with `npm test` when changing graphics composition.

Run `npm run test:ui`, `npm run lint`, and `npm run build`. The test suite loads
the actual widget/input TypeScript modules through Node's type stripping hook,
substituting small engine/DOM doubles. It adds no test dependencies and does not
launch a browser, load assets, access saves, or make network requests. Node may
print an experimental warning for its type-stripping API.

The suite covers idle work, sibling isolation, unions/removal, padding/gaps,
text fitting/visibility, pointer capture and cancellation, multiple touch IDs,
slider validation, modal isolation, semantic guards, row reconciliation,
prestige confirmation, resize settling, and disposal. It cannot establish actual
font metrics, canvas appearance, real device input, or GPU/frame performance.

Do not use a browser for implementation or verification unless the user explicitly
requests it, as required by the repository's `AGENTS.md`.
