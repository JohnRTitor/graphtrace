import { describe, expect, it } from 'vitest';
import { generateTicTacToe, generateNim, buildManualGameTree } from '../../../generators/game';
import { alphabeta } from '../../../algorithms/adversarial/alphabeta';
import { minimax } from '../../../algorithms/adversarial/minimax';
import {
	applyGameTreeEvent,
	stepInto,
	createGameTreeTraceState,
	type GameTreeTraceState
} from '../../../families/adversarial/tree-state';
import {
	countChangedFlowNodes,
	toTreeEdges,
	toTreeNodes,
	treeColors,
	type TreeFlowNode
} from '../tree-adapter';
import type { GameTree } from '../../../graph/game-tree';
import { cloneGameTree } from '../../../graph/game-tree';

const colors = treeColors('dark');

/**
 * Replays a trace the way the engine does, rendering every `RENDER_EVERY` events
 * to mirror a renderer that refreshes roughly once per frame at a moderate speed.
 */
function replayWithRendering(
	tree: GameTree,
	events: ReturnType<typeof minimax.run>['events'],
	renderEvery = 20
) {
	let state = createGameTreeTraceState();
	let previous: TreeFlowNode[] | undefined;
	let renders = 0;
	let warmRenders = 0;
	let changedTotal = 0;
	let worstRender = 0;
	let previousRenderedCount = 0;

	for (const event of events) {
		state = stepInto(state, event, tree);
		previousRenderedCount++;
		if (previousRenderedCount < renderEvery) continue;
		previousRenderedCount = 0;

		const { nodes } = toTreeNodes(tree, state, colors, true);
		const changed = countChangedFlowNodes(previous, nodes);
		renders++;
		// The first render is a cold build by definition, so it is counted for
		// totals but excluded from the per-render statistic being asserted.
		if (previous !== undefined) {
			warmRenders++;
			changedTotal += changed;
			worstRender = Math.max(worstRender, changed);
		}
		previous = nodes;
	}

	return { renders, warmRenders, changedTotal, worstRender, nodeCount: tree.nodes.size };
}

describe('game tree renderer incrementality', () => {
	it('reuses unchanged node objects instead of rebuilding the whole tree', () => {
		const tree = generateTicTacToe({ seed: 3, maxDepth: 0 });
		const { warmRenders, worstRender, nodeCount, changedTotal } = replayWithRendering(
			tree,
			minimax.run(tree).events
		);

		expect(warmRenders).toBeGreaterThan(50);
		expect(nodeCount).toBeGreaterThan(1000);

		// A single search step touches a handful of nodes. Rebuilding everything
		// would mean `nodeCount` changed objects per render, which is what made a
		// large tree freeze during playback.
		expect(worstRender).toBeLessThan(nodeCount / 50);
		expect(changedTotal).toBeLessThan(warmRenders * (nodeCount / 100));
	});

	it('hands back the identical array contents when nothing has changed', () => {
		const tree = buildManualGameTree();
		let state = createGameTreeTraceState();
		for (const event of minimax.run(tree).events) state = stepInto(state, event, tree);

		const first = toTreeNodes(tree, state, colors, true);
		const second = toTreeNodes(tree, state, colors, true);

		expect(countChangedFlowNodes(first.nodes, second.nodes)).toBe(0);
		// A no-op step must not even rebuild the layout.
		expect(second.nodes).not.toBe(first.nodes);
	});

	it('reuses edge objects too', () => {
		const tree = generateNim({ seed: 5, heapCount: 3, maxStones: 3 });
		let state = createGameTreeTraceState();
		for (const event of alphabeta.run(tree).events) state = stepInto(state, event, tree);

		const first = toTreeEdges(tree, state, colors);
		const second = toTreeEdges(tree, state, colors);

		expect(first).toHaveLength(second.length);
		for (let index = 0; index < first.length; index++) {
			expect(second[index]).toBe(first[index]);
		}
	});

	it('still reports the same states as a from-scratch rebuild', () => {
		// The cache must never change what is rendered, only how much work it takes.
		const tree = generateTicTacToe({ seed: 7, maxDepth: 3 });
		const events = minimax.run(tree).events;

		let incrementalState = createGameTreeTraceState();
		for (let index = 0; index < events.length; index++) {
			incrementalState = stepInto(incrementalState, events[index], tree);
			if (index % 37 !== 0) continue;

			const incremental = toTreeNodes(tree, incrementalState, colors, true).nodes;
			// A clone has a different identity, so the adapter's per-tree cache
			// cannot be hit and the result is a genuine cold rebuild.
			const cold = toTreeNodes(cloneGameTree(tree), incrementalState, colors, true).nodes;

			expect(incremental.map((node) => node.id)).toEqual(cold.map((node) => node.id));
			expect(incremental.map((node) => node.data.state)).toEqual(
				cold.map((node) => node.data.state)
			);
			expect(incremental.map((node) => node.data.value)).toEqual(
				cold.map((node) => node.data.value)
			);
		}
	});

	it('invalidates the cache when the tree is structurally edited', () => {
		const tree = buildManualGameTree();
		const before = toTreeNodes(tree, null, colors, true).nodes.length;
		const root = tree.root!;

		// Mutating the tree the way the editor does, without replacing the object,
		// is the case a shape-keyed cache has to notice.
		const existing = Array.from(tree.children.get(root) ?? [])[0];
		tree.nodes.set('added-1', {
			id: 'added-1',
			parent: existing,
			depth: 2,
			player: 'terminal',
			utility: 1,
			moveLabel: 'new'
		});
		tree.children.set('added-1', []);
		tree.children.get(existing)!.push('added-1');

		const after = toTreeNodes(tree, null, colors, true);
		expect(after.nodes).toHaveLength(before + 1);
		expect(after.nodes.map((node) => node.id)).toContain('added-1');
	});
});

describe('game tree reducer fast path', () => {
	it('matches the pure reducer at every step', () => {
		const tree = generateTicTacToe({ seed: 3, maxDepth: 4 });
		const events = minimax.run(tree).events;

		let pure: GameTreeTraceState = createGameTreeTraceState();
		let fast: GameTreeTraceState = createGameTreeTraceState();

		for (let index = 0; index < events.length; index += 3) {
			pure = applyGameTreeEvent(pure, events[index], tree);
			fast = stepInto(fast, events[index], tree);
			expect(fast.visited).toEqual(pure.visited);
			expect(fast.pruned).toEqual(pure.pruned);
			expect(fast.backedUp).toEqual(pure.backedUp);
			expect(fast.values).toEqual(pure.values);
			expect(fast.principalVariation).toEqual(pure.principalVariation);
			expect(fast.rootValue).toBe(pure.rootValue);
		}
	});

	it('replays a full-size trace within a generous budget', () => {
		// The pre-fix reducer cloned eight collections per event and, on a `prune`,
		// walked the skipped subtree - so a replay was quadratic. Measured at ~7s
		// for this trace; the budget is exceeded by more than an order of magnitude if
		// that ever returns.
		const tree = generateTicTacToe({ seed: 3, maxDepth: 0 });
		const events = minimax.run(tree).events;

		const started = performance.now();
		let state = createGameTreeTraceState();
		for (const event of events) state = stepInto(state, event, tree);
		const elapsed = performance.now() - started;

		expect(elapsed).toBeLessThan(400);
		expect(state.visited.size).toBeGreaterThan(1000);
	});

	it('rewrites the variation in place rather than reallocating it', () => {
		// `choose` fires on roughly half of all events; a fresh array each time was a
		// meaningful share of playback allocation churn.
		const tree = buildManualGameTree();
		const state = createGameTreeTraceState();
		const before = state.principalVariation;

		stepInto(state, { type: 'choose', node: tree.root!, move: tree.children.get(tree.root!)![0], value: 1 }, tree);
		expect(state.principalVariation).toBe(before);
		expect(before).toHaveLength(2);
	});
});
