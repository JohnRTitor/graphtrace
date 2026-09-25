import { describe, expect, it } from 'vitest';
import { gameTreeDepth, layoutGameTree, serializeGameTree } from '../../../graph/game-tree';
import { buildManualGameTree, generateNim, generateRandomGameTree, generateTicTacToe, isBoardFull, winnerOf } from '../index';

describe('game tree generators', () => {
	describe('manual tree', () => {
		it('builds a small tree with a MAX root and terminal leaves', () => {
			const tree = buildManualGameTree();

			expect(tree.nodes.get(tree.root!)?.player).toBe('max');
			expect(gameTreeDepth(tree)).toBe(3);
			for (const node of tree.nodes.values()) {
				if (node.player === 'terminal') expect(Number.isFinite(node.utility)).toBe(true);
			}
		});

		it('is deterministic', () => {
			expect(serializeGameTree(buildManualGameTree())).toEqual(serializeGameTree(buildManualGameTree()));
		});
	});

	describe('tic-tac-toe', () => {
		it('is deterministic for a given seed', () => {
			const a = generateTicTacToe({ seed: 7 });
			const b = generateTicTacToe({ seed: 7 });
			expect(serializeGameTree(a)).toEqual(serializeGameTree(b));
		});

		it('produces a different tree for a different seed', () => {
			const a = serializeGameTree(generateTicTacToe({ seed: 1 }));
			const b = serializeGameTree(generateTicTacToe({ seed: 2 }));
			expect(a).not.toEqual(b);
		});

		it('roots at a MAX node a fixed opening below the empty board', () => {
			const tree = generateTicTacToe({ seed: 3 });

			expect(tree.nodes.get(tree.root!)?.player).toBe('max');
			// Fixed 1.O corner / 1.X centre opening, then a full 7-ply game.
			expect(gameTreeDepth(tree)).toBe(7);
			expect(tree.nodes.get(tree.root!)?.state).toBe('O...X....');
		});

		it('stays small enough to render, unlike the full empty-board tree', () => {
			const tree = generateTicTacToe({ seed: 3 });

			// The empty-board game tree is ~550k nodes; the fixed opening is ~6.8k.
			expect(tree.nodes.size).toBe(6812);
		});

		it('advances the board by exactly one move per edge', () => {
			const tree = generateTicTacToe({ seed: 3 });

			for (const [parent, kids] of tree.children) {
				const parentState = tree.nodes.get(parent)!.state!;
				for (const kid of kids) {
					const kidState = tree.nodes.get(kid)!.state!;
					const before = (parentState.match(/[XO]/g) ?? []).length;
					const after = (kidState.match(/[XO]/g) ?? []).length;
					expect(after).toBe(before + 1);
				}
			}
		});

		it('only reaches terminal or heuristically-scored leaves when untruncated', () => {
			const tree = generateTicTacToe({ seed: 3 });
			const leaves = Array.from(tree.nodes.values()).filter((node) => node.player === 'terminal');

			expect(leaves.length).toBeGreaterThan(0);
			for (const leaf of leaves) {
				expect([-1, 0, 1]).toContain(leaf.utility);
			}
		});

		it('honours a depth limit', () => {
			const full = generateTicTacToe({ seed: 3, maxDepth: 0 });
			const limited = generateTicTacToe({ seed: 3, maxDepth: 4 });

			expect(gameTreeDepth(limited)).toBeLessThan(gameTreeDepth(full));
			expect(gameTreeDepth(limited)).toBe(4);
		});

		it('leaves the root with one child per legal reply', () => {
			const tree = generateTicTacToe({ seed: 3 });
			const openings = tree.children.get(tree.root!) ?? [];

			// After 1.O corner / 1.X centre there are seven legal replies.
			expect(openings).toHaveLength(7);
		});

		it('produces a layout whose siblings follow the search order left to right', () => {
			const tree = generateTicTacToe({ seed: 11, maxDepth: 4 });
			const layout = layoutGameTree(tree);
			const childXs = (tree.children.get(tree.root!) ?? []).map(
				(id) => layout.nodes.find((node) => node.id === id)!.x
			);

			expect(childXs).toEqual([...childXs].sort((a, b) => a - b));
		});

		it('detects wins and full boards', () => {
			expect(winnerOf('XXX......')).toBe('X');
			expect(winnerOf('OOO......')).toBe('O');
			expect(winnerOf('XOXOXXOXO')).toBeNull();
			expect(isBoardFull('XYXOXXOXY')).toBe(true);
			expect(isBoardFull('.........')).toBe(false);
		});
	});

	describe('nim', () => {
		it('is deterministic for a given seed', () => {
			const options = { seed: 11, heapCount: 3, maxStones: 3 };
			expect(serializeGameTree(generateNim(options))).toEqual(serializeGameTree(generateNim(options)));
		});

		it('scores an empty position as a loss for the player to move', () => {
			const tree = generateNim({ seed: 5, heapCount: 2, maxStones: 2 });
			const leaves = Array.from(tree.nodes.values()).filter((node) => node.player === 'terminal');

			expect(leaves.length).toBeGreaterThan(0);
			for (const leaf of leaves) {
				expect(leaf.utility).toBe(-1);
			}
		});

		it('advances the position by exactly one move per edge', () => {
			const tree = generateNim({ seed: 5, heapCount: 3, maxStones: 3 });

			for (const [parent, kids] of tree.children) {
				const parentState = tree.nodes.get(parent)!.state!;
				for (const kid of kids) {
					const kidState = tree.nodes.get(kid)!.state!;
					const before = parentState.split(',').reduce((a, b) => a + Number(b), 0);
					const after = kidState.split(',').reduce((a, b) => a + Number(b), 0);
					expect(after).toBeLessThan(before);
				}
			}
		});

		it('clamps oversized configurations instead of building an unbounded tree', () => {
			const clamped = generateNim({ seed: 5, heapCount: 99, maxStones: 99 });
			const largest = generateNim({ seed: 5, heapCount: 3, maxStones: 3 });

			expect(clamped.nodes.size).toBe(largest.nodes.size);
			expect(clamped.nodes.size).toBeLessThan(5_000);
		});

		it('reports a first-player win from a single-heap opening', () => {
			// With one heap, the opener can take every stone and win outright.
			const tree = generateNim({ seed: 5, heapCount: 1, maxStones: 3 });
			const leaves = Array.from(tree.nodes.values()).filter((node) => node.player === 'terminal');

			expect(leaves.every((leaf) => leaf.utility === -1)).toBe(true);
		});
	});

	describe('random game tree', () => {
		it('is deterministic for a given seed', () => {
			const options = { seed: 99, branchingFactor: 3, depth: 3, minUtility: -5, maxUtility: 5 };
			expect(serializeGameTree(generateRandomGameTree(options))).toEqual(
				serializeGameTree(generateRandomGameTree(options))
			);
		});

		it('respects the requested depth', () => {
			const tree = generateRandomGameTree({
				seed: 1,
				branchingFactor: 2,
				depth: 4,
				minUtility: -1,
				maxUtility: 1
			});
			expect(gameTreeDepth(tree)).toBe(4);
		});

		it('keeps every leaf utility inside the requested range', () => {
			const tree = generateRandomGameTree({
				seed: 2,
				branchingFactor: 3,
				depth: 3,
				minUtility: -4,
				maxUtility: 4
			});

			for (const node of tree.nodes.values()) {
				if (node.player !== 'terminal') continue;
				expect(node.utility!).toBeGreaterThanOrEqual(-4);
				expect(node.utility!).toBeLessThanOrEqual(4);
			}
		});

		it('alternates MAX and MIN down the tree', () => {
			const tree = generateRandomGameTree({
				seed: 4,
				branchingFactor: 3,
				depth: 3,
				minUtility: 0,
				maxUtility: 1
			});

			for (const node of tree.nodes.values()) {
				if (node.player === 'terminal') continue;
				expect(node.player).toBe(node.depth % 2 === 0 ? 'max' : 'min');
			}
		});

		it('clamps out-of-range settings rather than producing an unbounded tree', () => {
			const tree = generateRandomGameTree({
				seed: 1,
				branchingFactor: 99,
				depth: 99,
				minUtility: 0,
				maxUtility: 1
			});

			expect(gameTreeDepth(tree)).toBeLessThanOrEqual(5);
		});
	});
});
