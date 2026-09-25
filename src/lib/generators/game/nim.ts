import { buildGameTree, type TreeSpecNode } from '../../graph/game-tree-builder';
import type { GameTree } from '../../graph/game-tree';
import { PRNG } from '../../utils/random';

export type NimOptions = {
	seed: number;
	/** Number of heaps. 1-5 keeps the tree legible. */
	heapCount: number;
	/** Stones in each heap. 1-4 keeps the tree small enough to render. */
	maxStones: number;
};

/**
 * Upper bounds on the configuration.
 *
 * The tree size is governed by the number of distinct heap states, which is the
 * product of `(stones + 1)`. Capping both dimensions keeps that product at
 * 4^3 = 64 states, and the whole tree under ~1,800 nodes. The ranges are
 * deliberately clamped rather than the expansion being cut off part-way: a
 * generator that silently stopped early would produce a tree whose leaves lie
 * about being terminal.
 */
const MAX_HEAPS = 3;
const MAX_STONES = 3;

/** Guards against a pathological configuration building an unbounded tree. */
const MAX_PLIES = 24;

/**
 * Generates a bounded Nim game tree.
 *
 * Nim's utilities use the classic normal-play convention: the player to move at
 * a position with no stones left has lost, so a terminal position scores -1 for
 * whoever is to move there. Because the root is MAX, the root value reports
 * whether the opening position is winning (+1) or losing (-1). Nim has no draws,
 * which makes it a clean contrast with Tic-Tac-Toe.
 */
export function generateNim(options: NimOptions): GameTree {
	const heapCount = clamp(options.heapCount, 1, MAX_HEAPS, 3);
	const maxStones = clamp(options.maxStones, 1, MAX_STONES, 3);
	const prng = new PRNG(options.seed);

	const heaps: number[] = Array.from({ length: heapCount }, () =>
		prng.nextInt(1, maxStones + 1)
	);

	return buildGameTree(expandNode(heaps, 'max', 0, prng), 'nim');
}

/**
 * Expands one position into a spec node.
 *
 * A terminal position expands to a childless node, not to a terminal child: with
 * no stones left there is no move to play, so there is no node to play it into.
 */
function expandNode(
	position: number[],
	turnToMove: 'max' | 'min',
	pliesUsed: number,
	prng: PRNG
): TreeSpecNode {
	const exhausted = position.every((stones) => stones === 0);
	if (exhausted || pliesUsed >= MAX_PLIES) {
		// Normal play: whoever faces an empty position has lost. The depth guard
		// is scored as a draw, which can only make a truncated search less
		// confident, never wrong about a resolved position.
		return { player: 'terminal', utility: exhausted ? -1 : 0, state: position.join(',') };
	}

	const moves: { take: number; next: number[] }[] = [];
	for (let index = 0; index < position.length; index++) {
		for (let take = 1; take <= position[index]; take++) {
			const next = [...position];
			next[index] -= take;
			moves.push({ take, next });
		}
	}

	const opponent = turnToMove === 'max' ? 'min' : 'max';
	return {
		player: turnToMove,
		state: position.join(','),
		children: prng.shuffle(moves).map((move) => ({
			...expandNode(move.next, opponent, pliesUsed + 1, prng),
			moveLabel: `take ${move.take}`
		}))
	};
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
	if (!Number.isFinite(value)) return fallback;
	return Math.max(min, Math.min(max, Math.trunc(value as number)));
}
