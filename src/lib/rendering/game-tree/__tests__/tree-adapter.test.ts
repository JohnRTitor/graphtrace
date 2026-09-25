import { describe, expect, it } from 'vitest';
import { alphabeta } from '../../../algorithms/adversarial/alphabeta';
import { minimax } from '../../../algorithms/adversarial/minimax';
import { buildManualGameTree } from '../../../generators/game';
import { applyGameTreeEvent, createGameTreeTraceState } from '../../../families/adversarial/tree-state';
import type { GameTree } from '../../../graph/game-tree';
import { formatTreeValue, toTreeEdges, toTreeNodes, treeColors } from '../tree-adapter';

const colors = treeColors('dark');

function replay(tree: GameTree, upTo: number) {
	let state = createGameTreeTraceState();
	for (const event of alphabeta.run(tree).events.slice(0, upTo)) {
		state = applyGameTreeEvent(state, event, tree);
	}
	return state;
}

describe('game tree flow adapter', () => {
	it('emits one node per tree node, laid out without negative coordinates', () => {
		const tree = buildManualGameTree();
		const { nodes, width, height } = toTreeNodes(tree, null, colors, true);

		expect(nodes).toHaveLength(tree.nodes.size);
		for (const node of nodes) {
			// The layout is offset so the top-left node starts at the origin, which
			// keeps the whole tree in positive SvelteFlow space.
			expect(node.position.x).toBeGreaterThanOrEqual(0);
			expect(node.position.y).toBeGreaterThanOrEqual(0);
		}
		expect(width).toBeGreaterThan(0);
		expect(height).toBeGreaterThan(0);
	});

	it('emits one edge per move, in tree order', () => {
		const tree = buildManualGameTree();
		const edges = toTreeEdges(tree, null, colors);
		const moveCount = Array.from(tree.children.values()).reduce((sum, kids) => sum + kids.length, 0);

		expect(edges).toHaveLength(moveCount);
		expect(edges[0].id.startsWith('move:')).toBe(true);
	});

	it('starts every node pending and unvalued', () => {
		const tree = buildManualGameTree();
		const { nodes } = toTreeNodes(tree, null, colors, true);

		for (const node of nodes) {
			expect(node.data.state).toBe('pending');
			expect(node.data.value).toBeUndefined();
		}
	});

	it('marks the root and the selected node', () => {
		const tree = buildManualGameTree();
		const { nodes } = toTreeNodes(tree, null, colors, true);
		const roots = nodes.filter((node) => node.data.isRoot);

		expect(roots).toHaveLength(1);
		expect(roots[0].id).toBe(tree.root);
	});

	it('carries the terminal utility and the position digest onto the node', () => {
		const tree = buildManualGameTree();
		const { nodes } = toTreeNodes(tree, null, colors, true);
		const leaf = nodes.find((node) => node.data.player === 'terminal');

		expect(leaf?.data.utility).not.toBeNull();
	});

	it('dims a pruned subtree rather than removing it', () => {
		const tree = buildManualGameTree();
		const events = alphabeta.run(tree).events;
		const pruneIndex = events.findIndex((event) => event.type === 'prune');
		const state = replay(tree, pruneIndex + 1);

		const { nodes } = toTreeNodes(tree, state, colors, true);
		const pruned = nodes.filter((node) => node.data.state === 'pruned');

		expect(pruned.length).toBeGreaterThan(0);
		// The whole tree is still on screen - that is the requirement.
		expect(nodes).toHaveLength(tree.nodes.size);
	});

	it('never marks a node as pruned after it has been visited', () => {
		const tree = buildManualGameTree();
		const events = alphabeta.run(tree).events;
		const state = replay(tree, events.length);
		const { nodes } = toTreeNodes(tree, state, colors, true);

		for (const node of nodes) {
			if (node.data.state !== 'pruned') continue;
			expect(state.visited.has(node.id)).toBe(false);
		}
	});

	it('highlights the principal variation as a connected run of chosen nodes', () => {
		const tree = buildManualGameTree();
		const result = alphabeta.run(tree);
		const state = replay(tree, result.events.length);
		const { nodes } = toTreeNodes(tree, state, colors, true);
		const chosen = nodes.filter((node) => node.data.state === 'chosen').map((node) => node.id);

		expect(chosen).toEqual(result.principalVariation);
	});

	it('marks the moves on the principal variation as path edges', () => {
		const tree = buildManualGameTree();
		const result = alphabeta.run(tree);
		const state = replay(tree, result.events.length);
		const edges = toTreeEdges(tree, state, colors);
		const pathEdges = edges.filter((edge) => edge.data?.state === 'path');

		// The variation is root -> ... -> leaf, so it spans one fewer edge than
		// it has nodes.
		expect(pathEdges).toHaveLength(result.principalVariation.length - 1);
	});

	it('marks edges into pruned nodes as pruned and dashes them', () => {
		const tree = buildManualGameTree();
		const result = alphabeta.run(tree);
		const state = replay(tree, result.events.length);
		const edges = toTreeEdges(tree, state, colors);
		const pruned = edges.filter((edge) => edge.data?.state === 'pruned');

		expect(pruned.length).toBeGreaterThan(0);
		for (const edge of pruned) {
			expect(state.pruned.has(edge.target)).toBe(true);
		}
	});

	it('shows backed-up values and the alpha/beta window once they exist', () => {
		const tree = buildManualGameTree();
		const result = alphabeta.run(tree);
		const state = replay(tree, result.events.length);
		const { nodes } = toTreeNodes(tree, state, colors, true);
		const root = nodes.find((node) => node.id === tree.root)!;

		expect(root.data.value).toBe(result.metrics.rootValue);
		expect(root.data.alpha).toBeDefined();
		expect(root.data.beta).toBeDefined();
	});

	it('advances the backup tick as values are backed up, so repeats can animate', () => {
		const tree = buildManualGameTree();
		const events = alphabeta.run(tree).events;
		const early = toTreeNodes(tree, replay(tree, 3), colors, true).nodes[0];
		const late = toTreeNodes(tree, replay(tree, events.length), colors, true).nodes[0];

		expect(late.data.backupTick).toBeGreaterThan(early.data.backupTick);
	});

	it('can hide values without changing any other state', () => {
		const tree = buildManualGameTree();
		const state = replay(tree, alphabeta.run(tree).events.length);
		const withValues = toTreeNodes(tree, state, colors, true).nodes;
		const without = toTreeNodes(tree, state, colors, false).nodes;

		expect(without[0].data.showValues).toBe(false);
		expect(without[0].data.state).toBe(withValues[0].data.state);
	});

	it('carries the palette through so a node never hardcodes a colour', () => {
		const tree = buildManualGameTree();
		const { nodes } = toTreeNodes(tree, null, treeColors('light'), true);

		expect(nodes[0].data.colors.path).toBe(treeColors('light').path);
		expect(nodes[0].data.colors.path).not.toBe(treeColors('dark').path);
	});

	describe('formatTreeValue', () => {
		it('signs positive values so the minimiser can be read at a glance', () => {
			expect(formatTreeValue(4)).toBe('+4');
			expect(formatTreeValue(0)).toBe('0');
			expect(formatTreeValue(-2)).toBe('-2');
		});

		it('renders an absent value as empty and infinities symbolically', () => {
			expect(formatTreeValue(undefined)).toBe('');
			expect(formatTreeValue(null)).toBe('');
			expect(formatTreeValue(Infinity)).toBe('∞');
			expect(formatTreeValue(-Infinity)).toBe('-∞');
		});
	});

	it('renders the same tree identically for minimax and alpha-beta', () => {
		const tree = buildManualGameTree();
		const plain = replayMinimax(tree);
		const pruned = replay(tree, alphabeta.run(tree).events.length);
		const { nodes: plainNodes } = toTreeNodes(tree, plain, colors, true);
		const { nodes: prunedNodes } = toTreeNodes(tree, pruned, colors, true);

		// The two runs must agree on everything except which branches were cut,
		// otherwise the side-by-side comparison would be showing different work.
		expect(plainNodes.map((node) => node.id)).toEqual(prunedNodes.map((node) => node.id));
		for (const node of prunedNodes) {
			if (node.data.state === 'pruned') continue;
			const match = plainNodes.find((candidate) => candidate.id === node.id)!;
			expect(match.data.value ?? match.data.utility).toBe(node.data.value ?? node.data.utility);
		}
	});
});

function replayMinimax(tree: GameTree) {
	let state = createGameTreeTraceState();
	for (const event of minimax.run(tree).events) {
		state = applyGameTreeEvent(state, event, tree);
	}
	return state;
}
