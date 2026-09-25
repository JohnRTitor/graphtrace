import { environmentState } from '../../state/environment.svelte';
import type { InspectorField } from '../types';

/**
 * The inspector schema for the pathfinding family.
 *
 * Data-driven so a new family contributes fields without a new inspector
 * component. Fields read through `environmentState`, and the schema is rebuilt
 * each render, so the values stay live.
 */
export function pathfindingInspectorSchema(): InspectorField[] {
	const isGraph = environmentState.environmentType === 'graph';

	const seed: InspectorField = {
		kind: 'text',
		id: 'seed',
		label: 'Generator seed',
		mono: true,
		read: () => environmentState.environmentSeed,
		write: (value) => {
			const parsed = Number.parseInt(value, 10);
			if (Number.isFinite(parsed)) environmentState.environmentSeed = parsed;
		}
	};

	if (isGraph) {
		return [
			{ kind: 'readonly', id: 'env', label: 'Environment', value: () => 'Manual graph' },
			{ kind: 'readonly', id: 'nodes', label: 'Nodes', mono: true, value: () => String(environmentState.graph.nodes.size) },
			{ kind: 'readonly', id: 'edges', label: 'Edges', mono: true, value: () => String(environmentState.graph.edges.size) },
			seed
		];
	}

	return [
		{ kind: 'readonly', id: 'env', label: 'Environment', value: () => 'Grid' },
		{
			kind: 'derived',
			id: 'size',
			label: 'Grid size',
			mono: true,
			value: () => `${environmentState.gridRows} x ${environmentState.gridCols}`
		},
		{
			kind: 'derived',
			id: 'walkable',
			label: 'Walkable cells',
			mono: true,
			hint: 'Cells available to the search',
			value: () => {
				let open = 0;
				for (const cell of environmentState.grid.nodes.values()) {
					if (cell.walkable) open++;
				}
				return String(open);
			}
		},
		seed
	];
}
