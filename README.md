# GraphTrace

An interactive visualizer for algorithm families, built so that adding a *kind* of
algorithm is a registry entry rather than a rewrite.

- **Pathfinding** — BFS, DFS and A\* over grids and manual graphs, with seeded maze
  and random-graph generators, a cost brush, and a per-cell trace timeline.
- **Adversarial search** — minimax and alpha-beta pruning over game trees, with
  Tic-Tac-Toe, Nim and random-tree generators. Pruned subtrees are dimmed rather
  than deleted, because the skipped work is the lesson.
- **Optimization** and **Sorting & DP** — registered, deliberately unbuilt. They
  exist to keep the top level honestly a registry.

Press <kbd>⌘K</kbd> / <kbd>Ctrl K</kbd> for the algorithm palette, <kbd>Space</kbd> to
play, <kbd>N</kbd> to step, <kbd>B</kbd> to step back.

## Architecture

The extension point is the **problem family registry**
(`src/lib/families/registry.ts`). A family is one object declaring its environment
types, algorithms, event vocabulary, canvas renderer, inspector schema, metrics
columns and legend. Everything in the shared chrome — the family switcher, the
algorithm palette, the trace timeline, the comparison grid, the metrics table — is
written against that declaration and never against a specific family.

```
src/lib/
  families/          the registry, the family contract, and one folder per family
  algorithms/        the per-algorithm layer (unchanged in role; see below)
  trace/             the family-agnostic trace envelope and timeline bucketing
  generators/        grid, maze, graph and game-tree generators
  graph/             the environment models: grids, manual graphs, game trees
  rendering/         konva (cell grid) + svelte-flow (graph and tree canvases)
  components/        the shared chrome
  theme/tokens.ts    colour, motion and shape - one source of truth
```

### The trace envelope

Different families mean different things by an event, so there is no shared union
of event types. Instead there is a shared *envelope*:

```ts
type TraceEvent<TPayload = unknown> = {
  step: number;
  kind: string;   // one of the owning family's declared eventKinds
  payload: TPayload;
};
```

The player, the timeline and the comparison view only ever see `TraceEvent[]`. A
family keeps its own native payload union and converts on demand. Pathfinding's
`AlgorithmEvent` is unchanged, which is why migrating it into the registry was a
pure refactor with no behaviour change.

### Why there is no `Algorithm.run(graph, start, goal)` any more

It could not be. Minimax has no goal node and no frontier. `GameSearchAlgorithm`
is a separate interface rather than a widened `Algorithm`, because unifying them
behind a loosely typed input would erase exactly the type information the registry
depends on.

## Documentation

- [`docs/adr/0001-problem-families-and-trace-events.md`](docs/adr/0001-problem-families-and-trace-events.md)
  — the architecture decision record, including the alternatives that were rejected
  and one deliberate deviation from the original brief.
- [`docs/design-tokens.md`](docs/design-tokens.md) — colour, type, motion and shape,
  and why the trace-state palette is kept separate from chrome.

## Adding a family

1. Add its environment types to `src/lib/generators/types.ts`.
2. Add a `Problem` variant matched by the family's `matchProblem`.
3. Add algorithms to the per-algorithm registry.
4. Write one `ProblemFamily` object and add it to `families` in the registry.
5. If it needs a new canvas, add it to `src/lib/families/renderers.ts`.

No change to the switcher, palette, timeline, comparison view or metrics table. The
two stub families are ~15 lines each and exist to make that claim checkable.

## Development

```sh
pnpm install
pnpm dev        # dev server
pnpm test       # vitest
pnpm check      # svelte-check
pnpm build      # production build
```

Tests are co-located with their modules in `__tests__/` folders.
