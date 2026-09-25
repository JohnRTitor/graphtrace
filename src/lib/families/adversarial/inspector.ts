import { averageBranchingFactor, gameTreeDepth } from '../../graph/game-tree';
import { environmentState } from '../../state/environment.svelte';
import type { InspectorField } from '../types';

const ENV_LABELS: Record<string, string> = {
	manual_tree: 'Manual tree',
	tic_tac_toe: 'Tic-Tac-Toe (full)',
	tic_tac_toe_limited: 'Tic-Tac-Toe (depth limited)',
	nim: 'Nim',
	random_tree: 'Random game tree'
};

/**
 * The inspector schema for the adversarial family.
 *
 * Mirrors the pathfinding schema's shape exactly - which is the point: the
 * inspector component is written once and driven entirely by whichever family is
 * active.
 */
export function adversarialInspectorSchema(): InspectorField[] {
	const tree = environmentState.gameTree;

	return [
		{
			kind: 'readonly',
			id: 'env',
			label: 'Game',
			value: () => ENV_LABELS[environmentState.environmentType] ?? environmentState.environmentType
		},
		{
			kind: 'derived',
			id: 'nodes',
			label: 'Tree nodes',
			mono: true,
			value: () => String(tree.nodes.size)
		},
		{
			kind: 'derived',
			id: 'leaves',
			label: 'Terminal leaves',
			mono: true,
			hint: 'Positions with a fixed utility',
			value: () => {
				let leaves = 0;
				for (const node of tree.nodes.values()) {
					if (node.player === 'terminal') leaves++;
				}
				return String(leaves);
			}
		},
		{ kind: 'derived', id: 'depth', label: 'Max depth', mono: true, value: () => String(gameTreeDepth(tree)) },
		{
			kind: 'derived',
			id: 'branching',
			label: 'Branching factor',
			mono: true,
			value: () => averageBranchingFactor(tree).toFixed(2)
		},
		{
			kind: 'text',
			id: 'seed',
			label: 'Generator seed',
			mono: true,
			read: () => environmentState.environmentSeed,
			write: (value) => {
				const parsed = Number.parseInt(value, 10);
				if (Number.isFinite(parsed)) environmentState.environmentSeed = parsed;
			}
		}
	];
}
