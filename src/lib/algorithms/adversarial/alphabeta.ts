import { runSearch } from './search-core';
import type { GameSearchAlgorithm } from './types';

/**
 * Alpha-beta pruning.
 *
 * Shares its entire recursive core with `minimax`, so the only difference between
 * the two executions is whether branches get cut. On one identical tree both
 * produce the same root value and the same principal variation, while alpha-beta
 * visits strictly fewer nodes and emits `prune` events where minimax does not.
 */
export const alphabeta: GameSearchAlgorithm = {
	id: 'alphabeta',
	name: 'Minimax with Alpha-Beta Pruning',
	description:
		'Minimax plus two bounds carried down the tree. Once a MAX node already holds a value that meets or beats the best MIN reply, its remaining children cannot change the decision above, and symmetrically for MIN. Same answer, far fewer nodes.',
	complexity: { time: 'O(b^(d/2))', space: 'O(d)' },
	properties: { optimal: true, complete: false },
	supportsPruning: true,

	run: (tree) => runSearch(tree, true)
};
