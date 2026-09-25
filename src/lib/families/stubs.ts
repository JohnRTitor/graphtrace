import Waypoints from '@lucide/svelte/icons/waypoints';
import Shuffle from '@lucide/svelte/icons/shuffle';
import { commonMetricColumns } from '../trace/types';
import type { ProblemFamily } from './types';

/**
 * Optimization: network flow and minimum spanning trees.
 *
 * This entry is intentionally unbuilt. It exists to make the cost of adding a
 * family measurable: everything the app needs from a family to *present* it -
 * name, icon, description, metric columns, legend, palette grouping, switcher
 * slot - is data on this object. There is no algorithm, no environment, no
 * renderer, and the shared chrome renders it as a "coming soon" state.
 *
 * When it is built, the work is: add environment types to `generators/types.ts`,
 * add a problem variant matched by `matchProblem`, add algorithms to the
 * per-algorithm registry, and replace `status: 'planned'`. No change to the
 * switcher, palette, timeline, comparison view or metrics table.
 */
export const optimizationFamily: ProblemFamily = {
	id: 'optimization',
	name: 'Optimization',
	icon: Waypoints,
	environmentTypes: [],
	algorithms: [],
	eventKinds: ['augment', 'saturate', 'select', 'improve', 'join'],
	// Reuses the existing node-edge canvas: flow networks and graphs are drawn
	// the same way, so a new renderer is not expected here.
	renderer: null as unknown as ProblemFamily['renderer'],
	inspectorSchema: () => [],
	metricsColumns: commonMetricColumns,
	status: 'planned',
	description:
		'Network flow (Ford-Fulkerson, Edmonds-Karp) and minimum spanning trees (Kruskal, Prim). Coming soon.',

	matchProblem: () => false,
	createTraceState: () => {
		throw new Error('The optimization family is not implemented yet.');
	},
	reduce: (state) => state,
	toTraceEvents: (trace) =>
		trace.map((payload, step) => ({ step, kind: 'unknown', payload })),
	algorithmSummaries: () => [],
	legend: () => []
};

/**
 * Sorting and dynamic programming.
 *
 * Second unbuilt entry, same purpose: a third and fourth family shape (array
 * state, a bottom-up table rather than a frontier) confirm the registry is not
 * quietly specialised to graph-shaped problems.
 */
export const sortingFamily: ProblemFamily = {
	id: 'sorting',
	name: 'Sorting & DP',
	icon: Shuffle,
	environmentTypes: [],
	algorithms: [],
	eventKinds: ['compare', 'swap', 'insert', 'merge', 'base-case', 'fill'],
	renderer: null as unknown as ProblemFamily['renderer'],
	inspectorSchema: () => [],
	metricsColumns: [
		{ key: 'comparisons', label: 'Comparisons', better: 'lower' },
		{ key: 'writes', label: 'Writes', better: 'lower' },
		{ key: 'subproblems', label: 'Subproblems', better: 'lower' },
		...commonMetricColumns
	],
	status: 'planned',
	description:
		'Comparison sorts and classic dynamic programming over intervals or knapsacks. Coming soon.',

	matchProblem: () => false,
	createTraceState: () => {
		throw new Error('The sorting and dynamic programming family is not implemented yet.');
	},
	reduce: (state) => state,
	toTraceEvents: (trace) => trace.map((payload, step) => ({ step, kind: 'unknown', payload })),
	algorithmSummaries: () => [],
	legend: () => []
};
