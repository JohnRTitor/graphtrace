import type { MetricColumn } from '../../trace/types';

/**
 * The pathfinding family's metrics columns.
 *
 * The six labels and accessors are exactly those the pre-registry metrics table
 * hard-coded, so migrating pathfinding into the family registry is a pure refactor
 * and the rendered table is unchanged.
 */
export const pathfindingMetricColumns: MetricColumn[] = [
	{ key: 'nodesDiscovered', label: 'Nodes Discovered', better: 'lower' },
	{ key: 'nodesExpanded', label: 'Nodes Expanded', better: 'lower' },
	{ key: 'maxFrontierSize', label: 'Max Frontier Size', better: 'lower' },
	{ key: 'pathLength', label: 'Path Length', better: 'lower' },
	{ key: 'pathCost', label: 'Path Cost', better: 'lower' },
	{
		key: 'executionTimeMs',
		label: 'Execution Time',
		better: 'lower',
		format: (value) => `${value.toFixed(2)} ms`
	}
];
