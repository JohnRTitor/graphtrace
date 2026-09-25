# ADR 0001 — Problem Families and the Trace Event Envelope

- **Status:** Accepted
- **Date:** 2026-09-25
- **Supersedes:** the implicit "one start, one goal, one frontier" model in `Algorithm.run(graph, start, goal)`

## Context

GraphTrace v1 visualised BFS, DFS and A\* over grids and manual graphs. That model generalises
badly. `Algorithm.run` takes a single `(start, goal)` pair and returns a trace built from a
closed union of eight `AlgorithmEvent` variants. Adversarial search has no goal node and no
frontier; its meaningful events are *visit / evaluate / prune / backup / choose-move*, which
have no counterpart in the existing union. `Problem` is a two-variant union
(`grid | graph`) and a game position is neither. The comparison view hard-codes two panes.
The chrome assumes exactly one spatial paradigm (Konva grid vs. one SvelteFlow graph editor).

The mandate is architectural: the next algorithm family must be addable as a registry entry,
not a rewrite.

## Decision

### 1. A family registry above the algorithm registry

A `ProblemFamily` record (`src/lib/families/types.ts`) is the unit of extension. It owns the
family's environment types, its algorithm ids, its event vocabulary, its canvas renderer, its
inspector schema, and its metrics columns. The existing `src/lib/algorithms/index.ts` is kept
and demoted to the *per-algorithm* layer; a family references algorithms by id.

```ts
type ProblemFamily = {
  id: string;
  name: string;
  icon: IconComponent;
  environmentTypes: EnvironmentType[];
  algorithms: string[];
  eventKinds: string[];
  renderer: Component;
  inspectorSchema: InspectorField[];
  metricsColumns: MetricColumn[];
  status: 'ready' | 'planned';
  // --- additions beyond the prompt's shape, required to actually run a family ---
  matchProblem(problem: Problem): boolean;
  createTraceState(): TraceState;
  reduce(state: TraceState, event: TraceEvent): TraceState;
  toTraceEvents(trace: unknown[]): TraceEvent[];
};
```

The four trailing hooks are the honest cost of a registry that is not just metadata. Without
`matchProblem` nothing can route a problem to a family; without `createTraceState`/`reduce` the
trace player cannot be family-agnostic; without `toTraceEvents` the timeline cannot draw
event-kind markers. They are data, not control flow, so a new family still means *one file*.

**The registry holds no application components.** `renderer` is a *type-only*
`Component` reference; the runtime component map lives in
`src/lib/families/renderers.ts`. The registry does import the family's `icon`, so
this is a narrower claim than "pure TypeScript": icons are presentational leaf
components with no app imports of their own, whereas the canvas renderers pull in
Konva, `@xyflow/svelte` and `$app/environment`, and `environment.svelte.ts` is
imported by the test suite. Keeping the renderers behind `renderers.ts` means no
state test compiles a canvas.

One further invariant makes the resulting import cycle safe: `registry.ts` ->
family -> inspector schema -> `environment.svelte.ts` -> `registry.ts`. It holds
because nothing in the cycle is needed at module-evaluation time except the
`families` array itself, and every schema is a lazily-called function. A future
edit that calls into the environment at module scope would break this, so the
schemas must stay lazy.

### 2. `TraceEvent` is a transport envelope, not a rewrite of the payload

```ts
type TraceEvent<TPayload = unknown> = {
  step: number;
  kind: string;       // one of the owning family's eventKinds
  payload: TPayload;
};
```

The envelope is the currency of the *shared chrome* — the trace player, the timeline scrubber,
the comparison view and the metrics table all consume `TraceEvent[]` and never see a family's
payload union. A family converts its native trace into envelopes on demand via
`toTraceEvents`, which is a pure `zip`-with-index over the trace (`kind` = the payload's own
discriminator). Conversion is lazy and non-destructive.

**Pathfinding's native trace is not rewritten.** `AlgorithmEvent` remains exactly as it is and
becomes the pathfinding family's payload union. This is not laziness: `Execution.trace` is
asserted on, field-for-field, by the existing `execution-store`, `astar`, `player` and
`trace-reducer` tests (`expect(trace.find(e => e.type === 'path')).toEqual({ type: 'path',
nodes, edges })`). Widening those objects to the envelope would add own properties and fail
`toEqual`, and the prompt requires the existing suite to pass unmodified. The envelope sits
beside the payload rather than replacing it, which also keeps each family's payload free to be
shaped by what that family actually needs to express.

### 3. `Problem` gains a third variant; the two existing variants are untouched

```ts
type Problem =
  | { type: 'grid';  ... }   // unchanged
  | { type: 'graph'; ... }   // unchanged
  | { type: 'game-tree'; family: 'adversarial'; tree: GameTree; ... };
```

`type` remains the discriminant, so `grid | graph` keeps meaning "pathfinding" and every
existing narrowing site (`if (problem.type === 'graph')`) keeps compiling and behaving. A
family identifies its problems with `matchProblem`, so adding a family never requires editing
the `Problem` union's existing members. Only genuinely new problem shapes add variants.

`Execution` becomes generic with pathfinding defaults
(`Execution<TTrace = AlgorithmEvent, TMetrics = AlgorithmMetrics>`), which lets the store hold
heterogeneous executions while every existing read site keeps its exact current type.

### 4. Trace state is a structural union, narrowed by capability

`PlaybackState.vizState` is widened to `TraceState = PathfindingTraceState | GameTreeTraceState`.
Each family owns a pure `(state, event) => state` reducer. Renderers do not switch on a
discriminant field: they narrow structurally (`'cellStates' in state`), so the pathfinding state
type — and its constructor, which the reducer tests assert against — is not polluted with a
family tag.

Backward-seek correctness is preserved by keeping the existing invariant: rebuilding a
prefix is a fold from the initial state, which works for any pure family reducer. The
asymmetric `invertEvent` remains pathfinding-only and unused by the player; it is not part of
the family contract.

### 5. `AlgorithmResult` metrics become a family-owned column set

`metricsColumns: MetricColumn[]` replaces the hard-coded six rows in the metrics table.
Pathfinding's six columns keep their exact labels and accessors, so the existing table output
is unchanged; adversarial declares its own (visited, pruned, prune rate, max depth, branching
factor, time).

## Consequences

- Adding a family is one registry entry plus its algorithms. The two stub families
  (Optimization, Sorting & DP) exist to prove the claim: they are ~15 lines each.
- The comparison view becomes N-pane by construction: panes are `(execution, family)` pairs
  and the layout is a grid over the pair count.
- The algorithm `<Select>` is replaced by a `Cmd/Ctrl+K` palette because algorithm count is
  now unbounded across families; a single flat list stops being navigable well before 15.
- Cost: one new indirection (`toTraceEvents`) on the playback hot path, and a union at
  `PlaybackState.vizState`. Both are contained, and both are what buy the family-agnostic
  player/timeline/comparison.
- Cost: `environmentState` grows a family axis. It is treated as the single source of truth for
  "which family is active" rather than introducing a second store, to avoid two sources of
  truth for the same question.

## Alternatives rejected

- **Make `AlgorithmEvent` the envelope outright.** Breaks `toEqual` assertions in four existing
  test files, and forces the pathfinding payload into a nested `payload` for no gain — the
  pathfinding union is already the payload.
- **One mega-union of every family's events.** That is the closed union this ADR exists to
  remove; adding adversarial to it would have required editing the union, not registering a
  family.
- **A plugin/registry loaded at runtime from JSON.** Cannot carry component references, and
  would trade a type error for a runtime one.
