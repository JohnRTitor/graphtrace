# Design tokens

GraphTrace is a technical tool: people keep it open for hours, reading numbers off a
canvas and stepping through traces. The visual direction follows from that, and this
document records the values that were chosen deliberately rather than inherited.

Everything here lives in two places, and they are kept in step by a test:

- `src/lib/theme/tokens.ts` - the TypeScript source of truth. Canvas renderers read
  from here, because Konva cannot read CSS custom properties.
- `src/routes/layout.css` - the CSS mirror, exposed to Tailwind via `@theme inline`.

`src/lib/theme/__tests__/design-tokens.test.ts` asserts the two agree, and that the
trace palette appears in no other file.

---

## 1. Three separate vocabularies

The most important decision in the theme is what is kept *apart*.

| Vocabulary | What it is | Where it may appear |
| --- | --- | --- |
| **Chrome** | Surfaces, text, borders, one accent hue | Buttons, badges, panels, focus rings |
| **Trace state** | Exactly five meanings, colourblind-safe | Canvas cells, tree nodes, timeline markers, legend |
| **Motion & shape** | Durations, easings, radii | Every transition and corner |

The trace-state palette is deliberately **not** available as ordinary Tailwind colour
classes, and it is never used for generic chrome. If a badge were the "path" green,
then green would stop meaning "the final answer", and the whole point of a fixed
vocabulary would be lost. The test that enforces this is the real guarantee; without
it this section is only a comment.

## 2. Trace states: the reserved five

These five meanings hold across every problem family, forever. Adding a sixth is a
redesign, not a feature.

| Token | Meaning | Pathfinding label | Adversarial label |
| --- | --- | --- | --- |
| `--trace-frontier` | Reached, queued, not yet expanded | Discovered | Pending |
| `--trace-visited` | Fully expanded | Expanded | Visited |
| `--trace-current` | Being processed right now | Current | Current |
| `--trace-path` | The final answer | Path | Principal variation |
| `--trace-pruned` | Deliberately skipped | *unused* | Pruned |

The *labels* differ per family and come from the family's `legend()` declaration; the
*colours* do not. A user moving from pathfinding to adversarial search sees "Discovered"
become "Pending" and keeps the same blue.

### Colours

Drawn from the Okabe-Ito colourblind-safe set, chosen so the five stay separable in
greyscale and under deuteranopia:

| Token | Dark | Light | Hue |
| --- | --- | --- | --- |
| frontier | `#56b4e9` | `#1b7fb8` | sky blue |
| visited | `#5b8def` | `#2a4fb8` | blue |
| current | `#f5d90a` | `#a37b00` | yellow |
| path | `#2fbf8f` | `#0f7a58` | bluish green |
| pruned | `#c77dbb` | `#9c4b8f` | reddish purple |

Light-mode values are the same hues darkened, not re-hued. A test asserts the hue
angle barely moves between themes, because if it did, "the blue one" would stop
meaning one thing when the user toggled the theme.

Colour is never the only signal where a state matters:

- MAX and MIN game nodes differ in **shape** (flat top vs. rounded) as well as hue.
- Pruned nodes are **dimmed** and their edges are **dashed**.
- The current node gets a **ring**, not just a fill change.

### Pruning is dimmed, never deleted

`PRUNED_OPACITY` is `0.32`. A pruned subtree stays on screen. In the adversarial family
the skipped work *is* the lesson, so removing it would remove the point.

## 3. Chrome

Dark-first, because this is a long-session tool.

- **Background** is near-black graphite (`oklch(0.16 0.008 265)`), not `#000`. Pure
  black causes halation against light text and makes the canvas the only thing with
  contrast; graphite keeps the canvas the brightest surface without the glare.
- **Accent** is one azure hue (`--primary` / `--ring`), used for every primary action
  and every focus state, so "interactive" always looks the same.
- Neutral surfaces are tinted very slightly toward the accent hue rather than being
  pure grey, which keeps them from looking dirty next to the canvas.
- The five shadcn `chart-*` slots that the default theme defined are **removed**: the
  app draws no charts, and leaving unused primary-adjacent tokens invites them being
  used for something that is not a chart.

Light theme ships and is designed, not merely inverted - every trace hue has its own
light value.

## 4. Type

- **Inter** for interface text. Unchanged from before.
- **JetBrains Mono** for every id, coordinate, cost, utility, alpha/beta pair and
  metric value, via `.gt-mono`. Applied with `font-variant-numeric: tabular-nums` so
  columns do not jitter horizontally as playback updates them.

The split is the point: at a glance you can tell data from chrome without reading it.
The algorithm palette, the inspector, the tree nodes and the timeline readout are all
mono; the labels around them are not.

## 5. Motion

Motion here communicates causality - *this node caused that update* - rather than
decorating. Every duration is in the 150-220ms band: long enough to read as a
consequence, short enough that stepping a 20,000-event trace never feels laggy.

| Token | Value | Used for |
| --- | --- | --- |
| `--motion-duration-feedback` | 150ms | Pressed states, hover |
| `--motion-duration-state` | 180ms | Node, edge and tree-branch state changes |
| `--motion-duration-canvas` | 200ms | Canvas pan and zoom |
| `--motion-duration-panel` | 220ms | Panel open and close (spring easing) |

Two easings: `--motion-ease-state` is a standard ease-out, and
`--motion-ease-spring` is a `linear()` spring curve used for panels so they settle
rather than slide.

Utility classes `gt-transition-state`, `gt-transition-panel` and `gt-transition-feedback`
wrap these, which keeps the timing system auditable in one place instead of scattered
`duration-200` utilities.

The signature motion is the **minimax backup**: a value chip is keyed on
`{value}:{backupTick}`, so a number arriving at a node always animates in from below
even when it repeats the previous one, and stepping backwards re-keys it too. The
motion says the value came *up* the tree.

### Reduced motion

`prefers-reduced-motion: reduce` collapses every duration token to `0ms` and adds a
blanket rule setting `animation-duration` and `transition-duration` to zero on every
element. A blanket rule rather than per-component opt-outs means a newly added animated
element is covered by default instead of needing to remember. Keyframes still resolve
to their final frame, so an animated element ends in the correct state rather than
freezing at its first. Opacity transitions are left alone - they convey state, not
movement.

## 6. Shape

Radii are tighter than the shadcn default (`0.625rem`), because this is a dense
three-column instrument panel: rounded chrome reads as friendly, sharp chrome reads as
a tool.

| Token | Value |
| --- | --- |
| `--radius-sm` | `0.25rem` |
| `--radius-md` | `0.375rem` |
| `--radius-lg` | `0.5rem` (the base) |
| `--radius-xl` | `0.75rem` |

Elevation has exactly two steps. More than that and a dense layout stops reading as
flat:

| Token | Value | Used for |
| --- | --- | --- |
| `--shadow-rest` | `0 1px 2px 0 rgb(0 0 0 / 0.28)` | Docked panels, cards |
| `--shadow-raised` | `0 8px 24px -6px rgb(0 0 0 / 0.45)` | Popped-out panels, the transport dock |
