import { describe, expect, it } from 'vitest';
import { buildGameTree } from '../../../graph/game-tree-builder';
import { buildManualGameTree, generateRandomGameTree } from '../../../generators/game';
import { alphabeta } from '../alphabeta';
import { minimax } from '../minimax';
import type { GameTreeEvent } from '../types';

const kinds = (events: GameTreeEvent[]): string[] => events.map((event) => event.type);

describe('alphabeta', () => {
	it('agrees with plain minimax on the root value', () => {
		const plain = minimax.run(buildManualGameTree());
		const pruned = alphabeta.run(buildManualGameTree());

		expect(pruned.metrics.rootValue).toBe(plain.metrics.rootValue);
	});

	it('agrees with plain minimax on the principal variation', () => {
		const tree = buildManualGameTree();
		const plain = minimax.run(tree);
		const pruned = alphabeta.run(tree);

		expect(pruned.principalVariation).toEqual(plain.principalVariation);
	});

	it('emits prune events and skips strictly fewer nodes', () => {
		const tree = buildManualGameTree();
		const plain = minimax.run(tree);
		const pruned = alphabeta.run(tree);

		expect(kinds(pruned.events)).toContain('prune');
		expect(pruned.metrics.nodesVisited).toBeLessThan(plain.metrics.nodesVisited);
		expect(pruned.metrics.nodesPruned).toBeGreaterThan(0);
	});

	it('reports a prune rate consistent with the node counts', () => {
		const tree = buildManualGameTree();
		const pruned = alphabeta.run(tree);
		const expected = (pruned.metrics.nodesPruned / tree.nodes.size) * 100;

		expect(pruned.metrics.pruneRate).toBeCloseTo(expected, 5);
	});

	it('prunes the region after the evaluated move, never the move it just searched', () => {
		const tree = buildManualGameTree();
		const pruned = alphabeta.run(tree);
		const pruneEvents = pruned.events.filter((event) => event.type === 'prune');

		for (const event of pruneEvents) {
			if (event.type !== 'prune') continue;
			const visited = pruned.events.some(
				(candidate) => candidate.type === 'visit' && candidate.node === event.subtreeRoot
			);
			expect(visited).toBe(false);
		}
	});

	it('records the bound that caused each cut-off', () => {
		const tree = buildManualGameTree();
		const pruned = alphabeta.run(tree);
		const pruneEvents = pruned.events.filter((event) => event.type === 'prune');

		for (const event of pruneEvents) {
			if (event.type !== 'prune') continue;
			expect(['alpha', 'beta']).toContain(event.reason);
			expect(Number.isFinite(event.alpha)).toBe(true);
			expect(Number.isFinite(event.beta)).toBe(true);
		}
	});

	it('prunes nothing when the tree is a single forced move', () => {
		const tree = buildGameTree({
			player: 'max',
			children: [{ player: 'terminal', utility: 3 }]
		});
		const result = alphabeta.run(tree);

		expect(kinds(result.events)).not.toContain('prune');
		expect(result.metrics.nodesPruned).toBe(0);
	});

	it('saves substantially more nodes on a deeper random tree', () => {
		const tree = generateRandomGameTree({
			seed: 4242,
			branchingFactor: 4,
			depth: 4,
			minUtility: -9,
			maxUtility: 9
		});
		const plain = minimax.run(tree);
		const pruned = alphabeta.run(tree);

		expect(pruned.metrics.rootValue).toBe(plain.metrics.rootValue);
		expect(pruned.metrics.nodesVisited).toBeLessThan(plain.metrics.nodesVisited);
		expect(pruned.metrics.pruneRate).toBeGreaterThan(10);
	});
});
