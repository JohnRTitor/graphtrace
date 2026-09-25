import { describe, expect, it } from 'vitest';
import { buildGameTree } from '../../../graph/game-tree-builder';
import { buildManualGameTree } from '../../../generators/game';
import { minimax } from '../minimax';
import type { GameTreeEvent } from '../types';

const kinds = (events: GameTreeEvent[]): string[] => events.map((event) => event.type);

describe('minimax', () => {
	it('backs up the max of the min nodes at the root', () => {
		const result = minimax.run(buildManualGameTree());

		// open A = min(3,5) = 3, open B = min(1,9) = 1, open C = min(max(4,9), max(2,6)) = min(9,6) = 6
		expect(result.metrics.rootValue).toBe(6);
	});

	it('chooses the move the root player should play', () => {
		const tree = buildManualGameTree();
		const result = minimax.run(tree);

		const rootId = tree.root!;
		const openC = (tree.children.get(rootId) ?? [])[2];
		expect(result.principalVariation[0]).toBe(rootId);
		expect(result.principalVariation[1]).toBe(openC);
	});

	it('emits only the family vocabulary', () => {
		const result = minimax.run(buildManualGameTree());
		const allowed = new Set(['start', 'visit', 'evaluate', 'backup', 'choose', 'finish']);

		for (const kind of kinds(result.events)) {
			expect(allowed.has(kind)).toBe(true);
		}
	});

	it('never prunes, and touches every node in the tree', () => {
		const tree = buildManualGameTree();
		const result = minimax.run(tree);

		expect(kinds(result.events)).not.toContain('prune');
		expect(result.metrics.nodesPruned).toBe(0);
		// `nodesVisited` counts every node entered, terminal leaves included, so an
		// unpruned search visits the entire tree.
		expect(result.metrics.nodesVisited).toBe(tree.nodes.size);
	});

	it('reads the utility of every terminal leaf exactly once', () => {
		const tree = buildManualGameTree();
		const result = minimax.run(tree);

		const leaves = Array.from(tree.nodes.values()).filter((node) => node.player === 'terminal');
		const evaluated = result.events.filter((event) => event.type === 'evaluate');
		expect(result.metrics.leafEvaluations).toBe(leaves.length);
		expect(evaluated).toHaveLength(leaves.length);
	});

	it('evaluates a lone terminal root at its own utility', () => {
		const tree = buildGameTree({ player: 'terminal', utility: 7 });
		const result = minimax.run(tree);

		expect(result.metrics.rootValue).toBe(7);
		expect(result.principalVariation).toEqual([tree.root]);
	});

	it('returns a zero-valued empty trace for a tree with no root', () => {
		const result = minimax.run({ nodes: new Map(), children: new Map(), root: null });

		expect(result.events.map((event) => event.type)).toEqual(['finish']);
		expect(result.metrics.rootValue).toBe(0);
	});

	it('prefers the first of equally good moves, so traces stay deterministic', () => {
		const tree = buildGameTree({
			player: 'max',
			children: [
				{ player: 'terminal', utility: 4 },
				{ player: 'terminal', utility: 4 }
			]
		});
		const result = minimax.run(tree);

		expect(result.principalVariation[1]).toBe((tree.children.get(tree.root!) ?? [])[0]);
	});

	it('recovers from an interior node with no moves instead of returning NaN', () => {
		const tree = buildGameTree({ player: 'max' });
		// buildGameTree promotes a childless spec node to terminal, so force an
		// interior node with an empty move list directly.
		tree.nodes.get(tree.root!)!.player = 'min';
		tree.children.set(tree.root!, []);

		const result = minimax.run(tree);
		expect(Number.isFinite(result.metrics.rootValue)).toBe(true);
		expect(result.metrics.rootValue).toBe(0);
	});
});
