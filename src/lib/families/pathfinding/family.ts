import { allAlgorithmSummaries } from '../../algorithms';
import { pathfindingEventKinds } from '../../algorithms/types';
import { pathfindingMetricColumns } from './metrics';
import {
	createPathfindingTraceState,
	reducePathfinding,
	stepIntoPathfinding,
	wrapPathfindingEvents
} from './trace';
import { pathfindingInspectorSchema } from './inspector';
import Route from '@lucide/svelte/icons/route';
import { pathfindingEnvironmentTypes } from '../../generators/types';
import type { ProblemFamily } from '../types';
import type { Problem } from '../../domain/problem';
import type { RendererComponent } from '../types';

/**
 * The pathfinding family.
 *
 * This is a registration, not a rewrite: the algorithms, the trace union, the
 * reducer and the metrics are the ones that already existed. What is new is that
 * they are now described by a registry entry, which is what lets the family
 * switcher, the palette, the legend and the metrics table be written once.
 */
export const pathfindingFamily: ProblemFamily = {
	id: 'pathfinding',
	name: 'Pathfinding',
	icon: Route,
	environmentTypes: pathfindingEnvironmentTypes,
	algorithms: ['bfs', 'dfs', 'astar'],
	eventKinds: [...pathfindingEventKinds],
	// Resolved at runtime through `families/renderers.ts`; see the ADR.
	renderer: null as unknown as RendererComponent,
	inspectorSchema: pathfindingInspectorSchema,
	metricsColumns: pathfindingMetricColumns,
	status: 'ready',
	description:
		'Single-source shortest paths over grids and manual graphs. One start, one goal, one frontier that grows as the search proceeds.',

	matchProblem: (problem: Problem) => problem.type === 'grid' || problem.type === 'graph',
	createTraceState: createPathfindingTraceState,
	stepInto: stepIntoPathfinding,
	reduce: reducePathfinding,
	toTraceEvents: (trace) => wrapPathfindingEvents(trace as Parameters<typeof wrapPathfindingEvents>[0]),
	algorithmSummaries: () =>
		allAlgorithmSummaries().filter((summary) => summary.familyId === 'pathfinding'),
	legend: () => [
		{
			token: 'frontier',
			label: 'Discovered',
			description: 'Reached and queued, but not yet expanded.'
		},
		{
			token: 'visited',
			label: 'Expanded',
			description: 'Fully explored; its neighbours are known.'
		},
		{ token: 'current', label: 'Current', description: 'The node being processed right now.' },
		{ token: 'path', label: 'Path', description: 'Part of the final shortest path.' },
		{
			token: 'pruned',
			label: 'Pruned',
			description: 'Unused by pathfinding; reserved so the meaning stays fixed across families.'
		}
	]
};

export * from './trace';
export * from './metrics';
export * from './inspector';
