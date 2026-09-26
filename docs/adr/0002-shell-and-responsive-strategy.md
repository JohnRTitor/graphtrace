# ADR 0002 — The shadcn-svelte shell and its responsive strategy

- **Status:** Accepted
- **Date:** 2026-09-26
- **Relates to:** [ADR 0001](0001-problem-families-and-trace-events.md),
  [`design-tokens.md`](../design-tokens.md)

## Context

The chrome had grown one control at a time and none of it shared a layout model. Four
things were true at once, and none of them was visible in review:

1. **The top bar was 621px wide on a phone.** The wordmark, a four-item family
   switcher with labels, five icon buttons and a search field. The root clipped it, so
   the search button, the details toggle, the shortcuts button *and the theme toggle*
   were off-screen and unreachable at 390px — and still clipped at 1024px.
2. **Both side panels docked at `md` (768px).** Two 288px columns leave the canvas 128px
   wide, which is about two pixels per maze cell. The visualisation is the product; the
   breakpoint was chosen by asking "is this a phone" instead of "does the canvas have
   room".
3. **The transport floated over the canvas.** Every graph had its bottom third hidden
   behind the dock, and four separate canvas overlays each carried a magic number
   (`bottom-20`, `pb-44`, `sm:pb-40`) guessing at how tall the dock was.
4. **Equivalent interactions were built four different ways.** A native `<select>` for
   the environment, a hand-rolled string class replicated from the `Input` primitive for
   eight number fields, a `role="group"` of five buttons whose `variant` encoded the
   selection for the cost presets, and a raw `accent-primary` checkbox in the tree
   inspector.

Underneath, every mobile affordance that mattered was missing. `contextmenu` is never
synthesised for a canvas on a touch device, so set start, set goal, add edge, rename,
delete and cost editing were all unreachable on a phone. There was no pinch-to-zoom. The
Konva `ResizeObserver` resized the stage but never re-fitted, so a rotation or a
browser-chrome change left the maze off-centre and cropped, with the only recovery
(the Fit button) itself under the dock.

## Decision

### 1. One shell, built on `Sidebar` and `Sheet`

`SidebarProvider` owns the shell. Below the docking width the problem builder is a
`Sheet`; at or above it, the same component is a docked column with a ⌘B toggle, an
offcanvas collapse, a focus trap, escape handling and body scroll lock. Nothing about
the mobile and desktop builders can disagree, because they are one component.

The previous hand-rolled drawer — a fixed `<aside>`, a toggled `hidden` class and a
full-screen `<button>` as a scrim — is gone. The scrim button was also an
accessibility defect: an empty button with a 1×1 accessible box, in the tab order,
before the panel it was dismissing.

### 2. Two docking lines, and they are numbers

`src/lib/hooks/is-mobile.svelte.ts` exports `BUILDER_BREAKPOINT = 1024` and
`DETAILS_BREAKPOINT = 1280`, and the sidebar's `md:` utilities became `lg:` so the CSS
branch and the DOM branch agree. A responsive test asserts both, and that no `md:`
survives in the sidebar.

They are two numbers rather than one because the shell is three columns and the canvas
is the product. Docking the builder costs 288px and leaves a 736px canvas at 1024, which
frames a 30x40 maze at about 18px per cell. Docking the details panel as well costs
another 352px and leaves 448px — about 10px per cell, too small to paint a wall or to
tell two similar frontiers apart. So the builder docks as soon as there is room for it,
and the details panel only joins it when the canvas can afford the space. At 1024 the
details panel is a sheet, one tap from the top bar.

`src/lib/components/ui/sidebar/constants.ts` is where the panel widths live; they are
denser than the shadcn default (18rem) because this is a form panel, not a navigation
rail.

### 3. The top bar is budgeted, not composed

At 320px the row has room for about five 44px controls, and the family switcher already
spends four. Family stays visible at every width because switching family is the one
action that must never be two taps away. Everything below that priority order gives:
from `sm` the wordmark and the theme toggle return, at `xl` the family labels appear,
and what is left is in the overflow menu. The family switcher is a `ToggleGroup` with
`sr-only` names, so its labels are in the accessibility tree at every width even when
they are not on screen.

`--tap` carries the density inversion: 44px on a coarse pointer, 36px on a mouse,
because a phone has no cursor to aim with and a 44px row on every control visibly
loosens a desktop grid.

### 4. The transport is in normal flow

This is the decision that most changed how the app looks. The dock was an absolute
overlay; it is now a `shrink-0` sibling of a `flex-1` canvas inside one flex column.

The original argument for floating it was canvas height. It does not survive contact
with the arithmetic: a 182px dock over a 450px canvas leaves 268px of *visible* canvas,
while the same dock in flow leaves 269px of canvas and nothing underneath it. Floating
it bought nothing and cost every canvas overlay a magic number. So `--dock-h` — the
measured-height custom property the overlay arrangement needed — was deleted rather
than kept, along with the four offsets that read it.

Only the event-kind jump strip sits behind a `Collapsible`, and it starts closed at every
width. It is one horizontally scrolling row rather than a wrapping grid, so it costs
about 40px however many kinds a trace carries — but it is a secondary control, and the
speed slider and the transport beside it are not, so a closed-by-default dock is the
same height everywhere. That is what lets the canvas be a function of the screen rather
than of how many event kinds happen to be in the loaded trace.

### 5. Interactive primitives come from shadcn-svelte; the visualisation does not

Adopted, replacing hand-rolled equivalents: `Select` (the native environment `<select>`),
`Input` (four separate input-chrome replicas), `InputGroup` (the seed field and its
randomise button), `ToggleGroup` (the family switcher, cost presets, comparison layout,
node kind), `Switch` (the tree's raw checkbox), `Command` (the algorithm palette),
`Alert` (four hand-rolled notice surfaces), `Table`, `Empty`, `Kbd`, `ButtonGroup`,
`DropdownMenu`, `Sheet`, `Sidebar`, `Collapsible`.

`Command` is used with `shouldFilter={false}`. bits-ui's filter is a case-insensitive
`includes`; `palette-search.ts` is a unit-tested subsequence matcher that ranks a prefix
match above a scattered one, and the palette renders the matched characters in a
`<mark>`. Trading that for the built-in filter would be a regression in result quality
in exchange for nothing. What `Command` does buy is the part that was hand-rolled
badly: roving focus, `aria-activedescendant` navigation, an input that announces the
list it controls, and one listbox rather than one per family.

**Not** migrated, deliberately:

- **Konva and SvelteFlow rendering.** A graph node, a bezier edge, a game-tree MAX/MIN
  shape and the trace density map are visualisation primitives. Wrapping them in a
  `Card` would be a category error. What they *do* get is the app's chrome where they
  had their own: `.svelte-flow__controls` is restyled once in `layout.css` for both
  xyflow surfaces, because it shipped as white-on-white 26px squares.
- **`ContextMenu` for canvas actions.** Right-click is the right interaction for a
  pointer. It was *additive* that touch needed a long press, not a replacement.
- **`FloatingPanel`.** Drag-to-position with a persisted position is not a popover, and
  no primitive here does it. It was widened and its `touch-action` moved to the handle
  so its content can be scrolled.
- **`SelectValue`'s label.** bits-ui derives it from the *mounted* items, and the only
  way to keep those mounted is `forceMount` on the content — which renders the listbox
  inside the builder sheet's stacking context, where the sheet's own content paints
  over it and the options stop being clickable on a phone. The label is read from
  `environmentState` instead, which is the source of truth anyway.

### 6. Touch is a first-class input, not a fallback

- **Long press** opens the node, edge and pane menus. 500ms, 10px of slop, cancelled on
  every exit from the press — and it consumes the `click` that follows, so long-pressing
  a node to rename it no longer also deletes it.
- **Pinch to zoom** on the Konva grid, about the pinch midpoint. Konva hands over
  `PointerEvent`s, which have no `touches` list, so the active touch points are tracked
  by pointer id. A second finger cancels an in-progress wall stroke rather than
  committing it.
- **A "Cell actions" button** opens the same controlled cell menu for the current
  selection, for the same reason: `contextmenu` is never synthesised for a canvas.
- **The Konva viewport re-fits on resize** until the user pans, wheel-zooms or pinches,
  after which it leaves their framing alone. A zero-sized stage is no longer fitted at
  all: it used to clamp to the 0.1 minimum scale with a negative offset, which looked
  broken and stayed broken.

## Known issue, not introduced here

**Comparison mode with more than one pane is unreachable**, and was before this work.
`executionStore.mount` puts the first run of a session into pane 0 and clears
`_isComparing`; every later run needs `_activeId` to be non-null *and* compare to be on,
but a run is only reachable from the play button and the `N`/`Space` shortcuts, both of
which require that no trace is loaded. Choosing a different algorithm calls
`invalidatePlayback`, which clears the executions and turns compare off. Verified
identical on `HEAD` before the migration.

The comparison view's empty state now says what is true — run an algorithm to fill a
pane, the transport drives every open pane — rather than promising a flow the state
layer does not currently support. Fixing it is a change to `execution-store.svelte.ts`
and the run flow, which is application logic rather than UI, and is deliberately out of
scope here.

Two smaller pre-existing quirks, verified identical on `HEAD` and left alone for the
same reason: pressing `N` with no trace loaded re-runs the algorithm rather than
stepping, and the maze letterboxes vertically in a portrait viewport because a 30x40
grid is landscape.

## Alternatives rejected
**`Drawer` for the transport.** It is a bottom sheet with a drag handle, which is a
better fit for a control you open in bursts. The transport is not that: it is used
continuously while watching a trace, and putting it behind a handle would make the
primary control of the app a thing you have to summon. It also scales the page
background by default, which is wrong for a full-viewport canvas, and it adds
`vaul-svelte` for a gesture the app does not want. A permanent bar in flow is both
simpler and better here.

**Resizable panels.** Genuinely tempting for a three-column instrument, and it would
let a user trade a panel for canvas. It adds `paneforge` and, more importantly, makes
the canvas width a function of a drag rather than a fact, which is the wrong direction
for an app whose panels are the thing you want to get out of the way.

**A `Combobox` for the algorithm picker.** Tempting for 15–20 algorithms. Rejected
because the picker is already a searchable dialog reached with ⌘K, the results are
grouped by family, and a combobox anchored to a button in a sidebar would hide the
grouping that makes the list scannable. `Command` is the right shape for a modal
search; a `Combobox` is for inline filtering.

**`Checkbox`, `RadioGroup`, `Accordion`, `Field`, `Skeleton`, `HoverCard`.** Each has
a case in the abstract and not in this app. Every boolean setting here is a `Switch`,
which is the idiom the panels already used consistently; `Accordion` and `Field` would
add a third level of nesting to a panel that is already tabs, and `Skeleton` would
describe a loading state that lasts a few milliseconds.

**Keeping the "Environment" and "Parameters" tabs separate.** They rendered the same
component, so every control existed twice in the DOM: duplicate `id`s, so a
`<label for>` pointed at whichever copy the browser found first, and duplicate options
in the environment select. They are one tab now.

## Consequences

- The canvas is never covered by chrome. That is the whole point, and it is why the
  dock moved into flow.
- There is no horizontal page scroll at any width from 320px up, and nothing is clipped
  by an ancestor. Both are asserted in `responsive-shell.test.ts` and were checked in a
  real browser at 320/360/375/390/414/430/768/1024/1280/1440/1920.
- The shortcut guard in `+layout.svelte` was narrowed from
  `document.querySelector('[data-state="open"]')` to dialogs, menus and listboxes. The
  blanket query also matched the dock's new `Collapsible`, which silently disabled
  Space, N, B, R and E across the whole app. A test asserts the selector's shape, and
  asserts that a `Collapsible` still exists, so the guard cannot be satisfied by
  deleting the disclosure instead of fixing the query.
- `onselect` is banned in first-party components. It is a React-ism that Svelte's
  attribute typing accepts and bits-ui v2 never dispatches; it spread onto the element
  as an inert DOM listener, so a menu item wired to it type-checked, rendered, and did
  nothing. That is how the mobile Compare action ended up with a working menu item that
  never toggled comparison mode. `responsive-shell.test.ts` fails on it.
- Two test files guard decisions that are invisible in review: the shell invariants
  above, and four `MazeViewport` cases for the zero-size and pinch paths.
- Two tabs became one and the primary `Button` in the toolbar became `outline`: saving
  a workspace is a document action, and the app's primary action is running an
  algorithm, which lives in the dock.
