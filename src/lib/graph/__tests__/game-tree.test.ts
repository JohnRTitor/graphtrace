import { describe, expect, it } from 'vitest';
import {
	averageBranchingFactor,
	cloneGameTree,
	collectSubtree,
	createGameTree,
	gameTreeDepth,
	invertGameTreeCommand,
	layoutGameTree,
	loadGameTree,
	restoreGameTree,
	serializeGameTree
} from '../game-tree';
import { buildGameTree } from '../game-tree-builder';

const sample = () =>
	buildGameTree({
		player: 'max',
		children: [
			{ player: 'min', moveLabel: 'a', children: [{ player: 'terminal', utility: 1 }] },
			{ player: 'min', moveLabel: 'b', children: [{ player: 'terminal', utility: 2 }] }
		]
	});

describe('game tree model', () => {
	it('assigns ids in pre-order and depths along the root path', () => {
		const tree = sample();

		expect(tree.root).toBe('n0');
		expect(tree.nodes.get('n0')).toMatchObject({ depth: 0, player: 'max' });
		expect(tree.nodes.get('n1')).toMatchObject({ depth: 1, parent: 'n0', player: 'min' });
		expect(tree.nodes.get('n2')).toMatchObject({ depth: 2, player: 'terminal', utility: 1 });
	});

	it('preserves move order, which is what the search depends on', () => {
		const tree = sample();

		expect(tree.children.get('n0')).toEqual(['n1', 'n3']);
	});

	it('promotes a childless node to terminal so it always has a value', () => {
		const tree = buildGameTree({ player: 'max' });

		expect(tree.nodes.get(tree.root!)?.player).toBe('terminal');
		expect(tree.nodes.get(tree.root!)?.utility).toBe(0);
	});

	it('reports depth and average branching factor', () => {
		const tree = sample();

		// Three interior nodes (root plus two MIN nodes) sharing four moves.
		expect(gameTreeDepth(tree)).toBe(2);
		expect(averageBranchingFactor(tree)).toBeCloseTo(4 / 3, 5);
	});

	it('returns zero branching factor for a tree with no interior nodes', () => {
		expect(averageBranchingFactor(buildGameTree({ player: 'terminal', utility: 1 }))).toBe(0);
	});

	it('collects a whole subtree', () => {
		const tree = sample();
		const collected = collectSubtree(tree, 'n1');

		expect(collected.map((node) => node.id)).toEqual(['n2']);
	});

	it('clones deeply enough that mutating the copy leaves the source alone', () => {
		const tree = sample();
		const copy = cloneGameTree(tree);
		copy.nodes.get('n2')!.utility = 99;
		copy.children.get('n0')!.push('n3');

		expect(tree.nodes.get('n2')?.utility).toBe(1);
		expect(tree.children.get('n0')).toEqual(['n1', 'n3']);
	});

	describe('layout', () => {
		it('centres each internal node over its children', () => {
			const layout = layoutGameTree(sample());
			const byId = new Map(layout.nodes.map((node) => [node.id, node]));

			expect(byId.get('n0')!.x).toBeCloseTo((byId.get('n1')!.x + byId.get('n3')!.x) / 2, 5);
		});

		it('places children below their parent', () => {
			const layout = layoutGameTree(sample());
			const byId = new Map(layout.nodes.map((node) => [node.id, node]));

			expect(byId.get('n1')!.y).toBeGreaterThan(byId.get('n0')!.y);
		});

		it('emits one edge per move, labelled with the move', () => {
			const layout = layoutGameTree(sample());

			expect(layout.edges).toHaveLength(4);
			expect(layout.edges[0]).toMatchObject({ source: 'n0', target: 'n1', moveLabel: 'a' });
		});

		it('returns an empty layout for a tree with no root', () => {
			expect(layoutGameTree(createGameTree())).toEqual({ nodes: [], edges: [], width: 0, height: 0 });
		});
	});

	describe('serialization', () => {
		it('round-trips a tree', () => {
			const tree = sample();
			const restored = createGameTree();
			restoreGameTree(restored, serializeGameTree(tree));

			expect(Array.from(restored.nodes.keys())).toEqual(Array.from(tree.nodes.keys()));
			expect(restored.children.get('n0')).toEqual(tree.children.get('n0'));
			expect(restored.root).toBe(tree.root);
		});

		it('rejects data with no usable root', () => {
			expect(loadGameTree({ nodes: [], children: [], root: null })).toBeNull();
			expect(loadGameTree({ nodes: [], children: [], root: 'missing' })).toBeNull();
			expect(loadGameTree('not a tree')).toBeNull();
		});

		it('drops nodes with an unrecognised player', () => {
			const tree = sample();
			const snapshot = serializeGameTree(tree);
			snapshot.nodes[1][1].player = 'sideways' as never;

			const loaded = loadGameTree(snapshot);
			expect(loaded).not.toBeNull();
			expect(loaded!.nodes.has('n1')).toBe(false);
		});

		it('drops edges whose endpoints are missing', () => {
			const tree = sample();
			const snapshot = serializeGameTree(tree);
			snapshot.children[0][1] = ['n1', 'ghost'];

			const loaded = loadGameTree(snapshot);
			expect(loaded!.children.get('n0')).toEqual(['n1']);
		});

		it('re-derives depths rather than trusting stored ones', () => {
			const tree = sample();
			const snapshot = serializeGameTree(tree);
			snapshot.nodes[2][1].depth = 99;

			const loaded = loadGameTree(snapshot);
			expect(loaded!.nodes.get('n2')?.depth).toBe(2);
		});

		it('drops nodes unreachable from the root', () => {
			const tree = sample();
			const snapshot = serializeGameTree(tree);
			snapshot.nodes.push(['orphan', { id: 'orphan', parent: null, depth: 0, player: 'max', utility: null, moveLabel: '' }]);

			const loaded = loadGameTree(snapshot);
			expect(loaded!.nodes.has('orphan')).toBe(false);
		});

		it('survives an edge list that would form a cycle', () => {
			const tree = sample();
			const snapshot = serializeGameTree(tree);
			// n2 is already a child of n1, so pointing n1's edge list back at the
			// root would close a loop through the root's own child.
			const n1Entry = snapshot.children[1];
			n1Entry[1] = [...n1Entry[1], 'n0'];
			snapshot.nodes[0][1].parent = 'n2';

			const loaded = loadGameTree(snapshot);
			expect(loaded).not.toBeNull();
			// The root stays the root, and the cycle does not hang the traversal.
			expect(loaded!.root).toBe('n0');
			expect(loaded!.nodes.get('n0')?.depth).toBe(0);
		});
	});

	describe('command inversion', () => {
		it('swaps the from and to of a scalar edit', () => {
			expect(
				invertGameTreeCommand({ type: 'set-utility', id: 'n0', from: 1, to: 5 })
			).toEqual({ type: 'set-utility', id: 'n0', from: 5, to: 1 });

			expect(
				invertGameTreeCommand({ type: 'set-player', id: 'n0', from: 'max', to: 'min' })
			).toEqual({ type: 'set-player', id: 'n0', from: 'min', to: 'max' });
		});

		it('swaps the before and after snapshots of a structural edit', () => {
			const before = serializeGameTree(sample());
			const after = serializeGameTree(buildGameTree({ player: 'max' }));
			const inverted = invertGameTreeCommand({ type: 'replace-tree', before, after });

			expect(inverted).toEqual({ type: 'replace-tree', before: after, after: before });
		});
	});
});
