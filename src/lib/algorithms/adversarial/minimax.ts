import { runSearch } from './search-core';
import type { GameSearchAlgorithm } from './types';

/**
 * Plain minimax: the search core with the pruning tests disabled.
 *
 * This is a separate algorithm rather than a config flag so the comparison view
 * can hold two executions of genuinely different behaviour over one identical
 * tree, which is the canonical demonstration of this family.
 */
export const minimax: GameSearchAlgorithm = {
	id: 'minimax',
	name: 'Minimax',
	description:
		'Searches the entire game tree. A MAX node takes the highest value among its children, a MIN node the lowest, and the resulting root value identifies the move the first player should play. Exhaustive, and exponential in depth.',
	complexity: { time: 'O(b^d)', space: 'O(d)' },
	properties: { optimal: true, complete: true },
	supportsPruning: false,

	run: (tree) => runSearch(tree, false)
};
