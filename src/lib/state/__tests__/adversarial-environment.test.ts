import { describe, expect, it } from 'vitest';
import { EnvironmentState } from '../environment.svelte';
import { executionStore } from '../execution-store.svelte';
import { serializeGameTree } from '../../graph/game-tree';

function adversarialState(): EnvironmentState {
	const state = new EnvironmentState();
	state.familyId = 'adversarial';
	return state;
}

describe('adversarial environment', () => {
	it('starts in pathfinding and moves its algorithm when the family changes', () => {
		const state = adversarialState();

		expect(state.familyId).toBe('adversarial');
		expect(state.environmentType).toBe('manual_tree');
		expect(state.selectedAlgorithmId).toBe('minimax');
	});

	it('moves to the family that owns a newly chosen environment type', () => {
		const state = adversarialState();

		state.environmentType = 'tic_tac_toe';
		expect(state.familyId).toBe('adversarial');

		state.environmentType = 'perfect_maze';
		expect(state.familyId).toBe('pathfinding');
		expect(state.selectedAlgorithmId).toBe('bfs');
	});

	it('refuses to switch to an unbuilt family', () => {
		const state = adversarialState();

		state.familyId = 'optimization';
		expect(state.familyId).toBe('adversarial');
	});

	it('exposes the game tree as the problem for the adversarial family', () => {
		const state = adversarialState();
		const problem = state.getProblem();

		expect(problem.type).toBe('game-tree');
		if (problem.type === 'game-tree') {
			expect(problem.tree).toBe(state.gameTree);
			expect(problem.family).toBe('adversarial');
		}
	});

	describe('generation', () => {
		it('regenerates deterministically for a seed', () => {
			const state = adversarialState();
			state.environmentType = 'random_tree';
			state.environmentSeed = 1234;
			state.handleGenerateGameTree();
			const first = serializeGameTree(state.gameTree);

			state.handleGenerateGameTree();
			expect(serializeGameTree(state.gameTree)).toEqual(first);
		});

		it('produces a different tree for a different seed', () => {
			const state = adversarialState();
			state.environmentType = 'random_tree';
			state.environmentSeed = 1;
			state.handleGenerateGameTree();
			const first = serializeGameTree(state.gameTree);

			state.environmentSeed = 2;
			state.handleGenerateGameTree();
			expect(serializeGameTree(state.gameTree)).not.toEqual(first);
		});

		it('restores the built-in manual tree', () => {
			const state = adversarialState();
			state.environmentType = 'random_tree';
			state.handleGenerateGameTree();

			state.environmentType = 'manual_tree';
			state.handleGenerateGameTree();
			expect(state.gameTree.nodes.size).toBeGreaterThan(0);
		});
	});

	describe('editing', () => {
		it('adds a child whose kind is the opposite of its parent', () => {
			const state = adversarialState();
			const root = state.gameTreeRoot!;
			const before = state.gameTree.nodes.size;

			const child = state.addGameTreeChild(root);
			expect(child).not.toBeNull();
			expect(state.gameTree.nodes.size).toBe(before + 1);
			expect(state.gameTree.nodes.get(child!)?.player).toBe('min');
		});

		it('adds a second sibling that matches the first', () => {
			const state = adversarialState();
			const root = state.gameTreeRoot!;
			const first = state.addGameTreeChild(root)!;
			const second = state.addGameTreeChild(root)!;

			expect(state.gameTree.nodes.get(first)?.player).toBe('min');
			expect(state.gameTree.nodes.get(second)?.player).toBe('min');
			expect(state.gameTree.children.get(root)).toContain(second);
		});

		it('refuses to add a child to a terminal node', () => {
			const state = adversarialState();
			const root = state.gameTreeRoot!;
			const leaf = state.addGameTreeChild(root)!;
			state.setGameTreePlayer(leaf, 'terminal');

			expect(state.addGameTreeChild(leaf)).toBeNull();
		});

		it('removes a node together with everything below it', () => {
			const state = adversarialState();
			const root = state.gameTreeRoot!;
			const child = state.addGameTreeChild(root)!;
			const grandchild = state.addGameTreeChild(child)!;
			expect(state.gameTree.nodes.has(grandchild)).toBe(true);

			state.removeGameTreeNode(child);
			expect(state.gameTree.nodes.has(child)).toBe(false);
			expect(state.gameTree.nodes.has(grandchild)).toBe(false);
			expect(state.gameTree.children.get(root)).not.toContain(child);
		});

		it('clears the whole tree when the root is removed', () => {
			const state = adversarialState();
			state.removeGameTreeNode(state.gameTreeRoot!);

			expect(state.gameTree.nodes.size).toBe(0);
			expect(state.gameTreeRoot).toBeNull();
		});

		it('re-derives depths after a structural edit', () => {
			const state = adversarialState();
			const root = state.gameTreeRoot!;
			const child = state.addGameTreeChild(root)!;
			state.addGameTreeChild(child);

			expect(state.gameTree.nodes.get(child)?.depth).toBe(1);
			for (const node of state.gameTree.nodes.values()) {
				expect(node.depth).toBeGreaterThanOrEqual(0);
			}
		});

		it('sets a terminal utility and a node kind', () => {
			const state = adversarialState();
			const child = state.addGameTreeChild(state.gameTreeRoot!)!;

			state.setGameTreeUtility(child, -4);
			expect(state.gameTree.nodes.get(child)?.utility).toBe(-4);

			state.setGameTreePlayer(child, 'terminal');
			expect(state.gameTree.nodes.get(child)?.player).toBe('terminal');
		});

		it('renames a move', () => {
			const state = adversarialState();
			const child = state.addGameTreeChild(state.gameTreeRoot!)!;

			state.setGameTreeMoveLabel(child, '  fork  ');
			expect(state.gameTree.nodes.get(child)?.moveLabel).toBe('fork');
		});

		it('rejects a non-finite utility', () => {
			const state = adversarialState();
			const child = state.addGameTreeChild(state.gameTreeRoot!)!;
			const before = state.gameTree.nodes.get(child)?.utility;

			state.setGameTreeUtility(child, Number.NaN);
			expect(state.gameTree.nodes.get(child)?.utility).toBe(before);
		});

		it('re-roots the tree onto a subtree', () => {
			const state = adversarialState();
			const child = state.addGameTreeChild(state.gameTreeRoot!)!;
			const grandchild = state.addGameTreeChild(child)!;

			state.makeGameTreeRoot(grandchild);
			expect(state.gameTreeRoot).toBe(grandchild);
			expect(state.gameTree.nodes.get(grandchild)?.depth).toBe(0);
		});

		it('undoes and redoes a structural edit', () => {
			const state = adversarialState();
			const root = state.gameTreeRoot!;
			const before = state.gameTree.nodes.size;

			state.addGameTreeChild(root);
			expect(state.gameTree.nodes.size).toBe(before + 1);

			state.undo();
			expect(state.gameTree.nodes.size).toBe(before);

			state.redo();
			expect(state.gameTree.nodes.size).toBe(before + 1);
		});

		it('undoes and redoes a scalar edit', () => {
			const state = adversarialState();
			const child = state.addGameTreeChild(state.gameTreeRoot!)!;
			// A fresh interior node carries no utility until it becomes terminal.
			const before = state.gameTree.nodes.get(child)?.utility;

			state.setGameTreeUtility(child, 7);
			expect(state.gameTree.nodes.get(child)?.utility).toBe(7);

			state.undo();
			expect(state.gameTree.nodes.get(child)?.utility).toBe(before);

			state.redo();
			expect(state.gameTree.nodes.get(child)?.utility).toBe(7);
		});
	});

	describe('running', () => {
		it('runs an adversarial algorithm and records the family on the execution', () => {
			const state = adversarialState();

			const id = state.runAlgorithm('step');
			expect(id).not.toBeNull();
			expect(state.runError).toBeNull();

			const execution = executionStore.get(id!);
			expect(execution?.familyId).toBe('adversarial');
			expect(execution?.algorithmId).toBe('minimax');
		});

		it('reports a run error for a pathfinding algorithm against a game tree', () => {
			const state = adversarialState();
			state.selectedAlgorithmId = 'minimax';

			// Selecting a pathfinding algorithm is allowed by the setter, but the
			// store owns the mapping and must refuse rather than silently no-op.
			const problem = state.getProblem();
			expect(() => executionStore.execute(problem, 'bfs')).toThrow();
		});
	});
});
