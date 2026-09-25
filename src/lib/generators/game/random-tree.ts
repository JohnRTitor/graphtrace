import { buildGameTree, type TreeSpecNode } from '../../graph/game-tree-builder';
import type { GameTree } from '../../graph/game-tree';
import { PRNG } from '../../utils/random';

export type RandomTreeOptions = {
	seed: number;
	/** Moves per interior node, 2-6. */
	branchingFactor: number;
	/** Plies below the root, 1-5. */
	depth: number;
	/** Inclusive bounds on generated leaf utilities. */
	minUtility: number;
	maxUtility: number;
};

/**
 * Generates a uniform random game tree.
 *
 * Uniform structure with random leaf utilities is the honest baseline for
 * studying pruning: there is no game structure to exploit, so the saving from
 * alpha-beta is close to the textbook worst case, which is exactly what makes it
 * a useful control against Tic-Tac-Toe's favourable ordering.
 */
export function generateRandomGameTree(options: RandomTreeOptions): GameTree {
	const branchingFactor = clampInt(options.branchingFactor, 2, 6, 3);
	const depth = clampInt(options.depth, 1, 5, 3);
	const prng = new PRNG(options.seed);

	const min = Number.isFinite(options.minUtility) ? Math.trunc(options.minUtility) : -10;
	const max = Number.isFinite(options.maxUtility) ? Math.trunc(options.maxUtility) : 10;
	const low = Math.min(min, max);
	const high = Math.max(min, max);

	const build = (level: number): TreeSpecNode => {
		if (level >= depth) {
			return { player: 'terminal', utility: prng.nextInt(low, high + 1) };
		}
		const fanout = level === 0 ? branchingFactor : prng.nextInt(1, branchingFactor + 1);
		return {
			player: level % 2 === 0 ? 'max' : 'min',
			children: Array.from({ length: fanout }, (_, index) => ({
				...build(level + 1),
				moveLabel: `m${index + 1}`
			}))
		};
	};

	return buildGameTree(build(0), 'rnd');
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
	if (!Number.isFinite(value)) return fallback;
	return Math.max(min, Math.min(max, Math.trunc(value as number)));
}
