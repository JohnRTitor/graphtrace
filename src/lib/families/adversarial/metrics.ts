import type { MetricColumn } from '../../trace/types';

/**
 * The adversarial family's metrics columns.
 *
 * These are what make the family comparison meaningful: `pruneRate` is the single
 * number that separates alpha-beta from plain minimax, and the visit/prune pair
 * shows where the saving came from.
 */
export const adversarialMetricColumns: MetricColumn[] = [
	{ key: 'nodesVisited', label: 'Nodes Visited', better: 'lower', description: 'Nodes the search entered, terminal leaves included.' },
	{ key: 'nodesPruned', label: 'Nodes Pruned', better: 'higher', description: 'Nodes never entered, because an ancestor cut the branch.' },
	{
		key: 'pruneRate',
		label: 'Prune Rate',
		better: 'higher',
		description: 'Pruned nodes as a share of the whole tree. The number that separates alpha-beta from minimax.',
		format: (value) => `${value.toFixed(1)}%`
	},
	{ key: 'maxDepthReached', label: 'Max Depth Reached', better: 'lower', description: 'Deepest node reached, in moves from the root.' },
	{
		key: 'branchingFactor',
		label: 'Branching Factor',
		description: 'Average moves per interior node across the whole tree.',
		format: (value) => value.toFixed(2)
	},
	{ key: 'leafEvaluations', label: 'Leaf Evaluations', better: 'lower', description: 'Terminal positions whose utility was read.' },
	{
		key: 'rootValue',
		label: 'Root Value',
		description: 'Utility backed up to the root, from the root player\u2019s point of view.',
		format: (value) => (value > 0 ? `+${value}` : String(value))
	},
	{
		key: 'executionTimeMs',
		label: 'Execution Time',
		better: 'lower',
		format: (value) => `${value.toFixed(2)} ms`
	}
];
