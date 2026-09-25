import { buildGameTree, type TreeSpecNode } from '../../graph/game-tree-builder';
import type { GameTree } from '../../graph/game-tree';

/**
 * A hand-built 3-ply tree used as the adversarial family's manual starting
 * point. It is deliberately small enough to reason about by hand.
 *
 * The move order is chosen so that pruning is *visible* on a tree this size:
 * `open B` leads with a losing leaf, so once the root's alpha is 3 the search
 * cuts off `open B`'s second leaf immediately. The move ordering is therefore
 * part of the pedagogy, not an accident - reversing it would hide the effect.
 */
export function buildManualGameTree(): GameTree {
	const spec: TreeSpecNode = {
		player: 'max',
		state: 'root',
		children: [
			{
				player: 'min',
				moveLabel: 'open A',
				children: [
					{ player: 'terminal', utility: 3, moveLabel: 'reply a1' },
					{ player: 'terminal', utility: 5, moveLabel: 'reply a2' }
				]
			},
			{
				player: 'min',
				moveLabel: 'open B',
				children: [
					{ player: 'terminal', utility: 1, moveLabel: 'reply b1' },
					{ player: 'terminal', utility: 9, moveLabel: 'reply b2' }
				]
			},
			{
				player: 'min',
				moveLabel: 'open C',
				children: [
					{
						player: 'max',
						moveLabel: 'chase 1',
						children: [
							{ player: 'terminal', utility: 4, moveLabel: 'take 1' },
							{ player: 'terminal', utility: 9, moveLabel: 'take 2' }
						]
					},
					{
						player: 'max',
						moveLabel: 'chase 2',
						children: [
							{ player: 'terminal', utility: 2, moveLabel: 'take 3' },
							{ player: 'terminal', utility: 6, moveLabel: 'take 4' }
						]
					}
				]
			}
		]
	};
	return buildGameTree(spec, 'mn');
}
