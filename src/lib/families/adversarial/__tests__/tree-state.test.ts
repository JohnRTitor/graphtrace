import { describe, expect, it } from 'vitest';
import { alphabeta } from '../../../algorithms/adversarial/alphabeta';
import { minimax } from '../../../algorithms/adversarial/minimax';
import { buildManualGameTree, generateTicTacToe } from '../../../generators/game';
import { collectSubtree, type GameTree } from '../../../graph/game-tree';
import {
	applyGameTreeEvent,
	createGameTreeTraceState,
	gameTreeNodeState,
	isOnVariation,
	isGameTreeState,
	wrapGameTreeEvents
} from '../tree-state';

const fold = (tree: GameTree, events: ReturnType<typeof wrapGameTreeEvents>, upTo: number) => {
	let state = createGameTreeTraceState();
	for (const event of events.slice(0, upTo)) {
		state = applyGameTreeEvent(state, event.payload, tree);
	}
	return state;
};

describe('game tree trace state', () => {
	it('starts empty and tagged for structural narrowing', () => {
		const state = createGameTreeTraceState();

		expect(state.kind).toBe('game-tree');
		expect(state.visited.size).toBe(0);
		expect(state.current).toBeNull();
		expect(state.rootValue).toBeNull();
		expect(isGameTreeState(state)).toBe(true);
	});

	it('wraps a native trace into the shared envelope', () => {
		const events = minimax.run(buildManualGameTree()).events;
		const wrapped = wrapGameTreeEvents(events);

		expect(wrapped).toHaveLength(events.length);
		expect(wrapped[0]).toMatchObject({ step: 0, kind: 'start' });
		expect(wrapped.map((event) => event.kind)).toContain('backup');
	});

	it('never mutates the state it is given', () => {
		const tree = buildManualGameTree();
		const before = createGameTreeTraceState();
		const after = applyGameTreeEvent(
			before,
			{ type: 'visit', node: tree.root!, depth: 0, player: 'max' },
			tree
		);

		expect(before.visited.size).toBe(0);
		expect(after.visited.has(tree.root!)).toBe(true);
	});

	it('reaches the same state by replay as by stepping', () => {
		const tree = buildManualGameTree();
		const events = wrapGameTreeEvents(alphabeta.run(tree).events);

		const stepped = fold(tree, events, 10);
		const replayed = fold(tree, events, 10);
		expect(replayed).toEqual(stepped);
	});

	it('records the backed-up value, window and root value by the end of the trace', () => {
		const tree = buildManualGameTree();
		const events = wrapGameTreeEvents(minimax.run(tree).events);
		const state = fold(tree, events, events.length);

		expect(state.rootValue).toBe(minimax.run(tree).metrics.rootValue);
		expect(state.values.get(tree.root!)).toBe(state.rootValue);
		expect(state.bounds.has(tree.root!)).toBe(true);
		expect(state.backedUp.has(tree.root!)).toBe(true);
	});

	it('dims the whole skipped subtree, not just the pruned entry node', () => {
		// A depth-limited Tic-Tac-Toe tree prunes regions several plies deep, which
		// is where dimming a subtree rather than a node actually matters.
		const tree = generateTicTacToe({ seed: 5, maxDepth: 4 });
		const events = wrapGameTreeEvents(alphabeta.run(tree).events);
		const deepest = events
			.map((event) => event.payload as { subtreeRoot: string; node: string })
			.filter((payload) => 'subtreeRoot' in payload)
			.map((payload) => collectSubtree(tree, payload.subtreeRoot).length + 1);

		expect(Math.max(...deepest)).toBeGreaterThan(1);

		const pruneEvent = events.find(
			(event) =>
				event.kind === 'prune' &&
				collectSubtree(
					tree,
					(event.payload as { subtreeRoot: string }).subtreeRoot
				).length > 0
		);
		expect(pruneEvent).toBeDefined();

		const state = fold(tree, events, pruneEvent!.step + 1);
		const root = (pruneEvent!.payload as { subtreeRoot: string }).subtreeRoot;
		const skipped = [tree.nodes.get(root)!, ...collectSubtree(tree, root)];

		for (const node of skipped) {
			expect(state.pruned.has(node.id)).toBe(true);
			expect(state.visited.has(node.id)).toBe(false);
		}
	});

	it('never marks a node as both pruned and visited', () => {
		const tree = generateTicTacToe({ seed: 5, maxDepth: 4 });
		const events = wrapGameTreeEvents(alphabeta.run(tree).events);
		const state = fold(tree, events, events.length);

		for (const node of state.pruned) {
			expect(state.visited.has(node)).toBe(false);
		}
	});

	it('clears the current node once the trace finishes', () => {
		const tree = buildManualGameTree();
		const events = wrapGameTreeEvents(minimax.run(tree).events);
		const state = fold(tree, events, events.length);

		expect(state.current).toBeNull();
	});

	it('bumps the backup tick on every backup, so values can animate', () => {
		const tree = buildManualGameTree();
		const events = wrapGameTreeEvents(minimax.run(tree).events);
		const state = fold(tree, events, events.length);

		expect(state.backupTick).toBe(events.filter((event) => event.kind === 'backup').length);
	});

	describe('gameTreeNodeState', () => {
		it('reports pending, visiting, backed-up and pruned', () => {
			const tree = buildManualGameTree();
			const root = tree.root!;
			const events = wrapGameTreeEvents(alphabeta.run(tree).events);
			const state = fold(tree, events, events.length);
			const untouched = 'mn-not-a-real-node';

			expect(gameTreeNodeState(createGameTreeTraceState(), untouched)).toBe('pending');
			expect(gameTreeNodeState(state, root)).toBe('backed-up');
			expect(state.pruned.size).toBeGreaterThan(0);
			for (const id of state.pruned) {
				expect(gameTreeNodeState(state, id)).toBe('pruned');
			}
		});

		it('does not call a node chosen just because it recorded a best move', () => {
			// Every interior node records a move, so keying "chosen" off that would
			// light up the whole tree instead of the one answer line.
			const tree = buildManualGameTree();
			const events = wrapGameTreeEvents(alphabeta.run(tree).events);
			const state = fold(tree, events, events.length);

			const interior = Array.from(tree.nodes.values()).filter(
				(node) => node.player !== 'terminal'
			);
			expect(interior.length).toBeGreaterThan(state.principalVariation.length);
			for (const node of interior) {
				expect(gameTreeNodeState(state, node.id)).not.toBe('chosen');
			}
		});

		it('puts pruning ahead of every other state, because a pruned node is never entered', () => {
			const tree = buildManualGameTree();
			const state = createGameTreeTraceState();
			const node = tree.nodes.get(tree.root!)!;

			state.visited.add(node.id);
			state.pruned.add(node.id);
			expect(gameTreeNodeState(state, node.id)).toBe('pruned');
		});

		it('reports the principal variation separately from node state', () => {
			const tree = buildManualGameTree();
			const result = alphabeta.run(tree);
			const events = wrapGameTreeEvents(result.events);
			const state = fold(tree, events, events.length);

			expect(state.principalVariation).toEqual(result.principalVariation);
			for (const id of state.principalVariation) {
				expect(isOnVariation(state, id)).toBe(true);
			}
			expect(isOnVariation(state, 'mn-not-a-real-node')).toBe(false);
		});
	});
});
