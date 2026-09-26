import { allAlgorithmSummaries } from '../../algorithms';
import { gameTreeEventKinds } from '../../algorithms/adversarial/types';
import { adversarialEnvironmentTypes } from '../../generators/types';
import { adversarialMetricColumns } from './metrics';
import { adversarialInspectorSchema } from './inspector';
import {
	applyGameTreeEvent,
	createGameTreeTraceState,
	stepInto,
	wrapGameTreeEvents
} from './tree-state';
import { environmentState } from '../../state/environment.svelte';
import type { Problem } from '../../domain/problem';
import type { GameTreeEvent } from '../../algorithms/adversarial/types';
import type { RendererComponent } from '../types';
import type { ProblemFamily } from '../types';
import Swords from '@lucide/svelte/icons/swords';

/**
 * The adversarial search family.
 *
 * This family is the proof that the registry is load-bearing rather than
 * decorative: nothing here reuses the pathfinding environment model, event
 * vocabulary, reducer, metrics columns or renderer. It contributes a registry
 * entry and five new modules, and every piece of shared chrome (switcher, palette,
 * timeline, comparison grid, metrics table, legend) picked it up for free.
 */
export const adversarialFamily: ProblemFamily = {
	id: 'adversarial',
	name: 'Adversarial Search',
	icon: Swords,
	environmentTypes: adversarialEnvironmentTypes,
	algorithms: ['minimax', 'alphabeta'],
	eventKinds: [...gameTreeEventKinds],
	renderer: null as unknown as RendererComponent,
	inspectorSchema: adversarialInspectorSchema,
	metricsColumns: adversarialMetricColumns,
	status: 'ready',
	description:
		'Two-player game trees. No start and no goal: the search is a tree walk where MAX nodes maximise and MIN nodes minimise a utility that only exists at terminal leaves.',

	matchProblem: (problem: Problem) => problem.type === 'game-tree',
	createTraceState: createGameTreeTraceState,
	reduce: (state, event) => {
		// The tree snapshot is needed to dim an entire pruned subtree, not just the
		// pruned entry node. Reading the live environment keeps the reducer pure
		// with respect to its own state.
		const tree =
			environmentState.familyId === 'adversarial' ? environmentState.gameTree : undefined;
		return applyGameTreeEvent(state as never, event.payload as GameTreeEvent, tree);
	},
	/**
	 * In-place equivalent of `reduce` for the playback engine. The snapshot tree is
	 * threaded through by the codec, which is the only place that knows which
	 * execution is loaded; the `reduce` path above falls back to the live
	 * environment instead.
	 */
	stepInto: (state, event, tree) => stepInto(state as never, event.payload as GameTreeEvent, tree),
	toTraceEvents: (trace) => wrapGameTreeEvents(trace as readonly GameTreeEvent[]),	algorithmSummaries: () =>
		allAlgorithmSummaries().filter((summary) => summary.familyId === 'adversarial'),
	legend: () => [
		{ token: 'frontier', label: 'Pending', description: 'Not yet reached by the search.' },
		{ token: 'visited', label: 'Visited', description: 'Entered; its children are being searched.' },
		{ token: 'current', label: 'Current', description: 'The node being evaluated right now.' },
		{ token: 'path', label: 'Principal variation', description: 'The line of play the root player would choose.' },
		{ token: 'pruned', label: 'Pruned', description: 'Skipped by alpha-beta. Kept visible, dimmed, because the skipped work is the point.' }
	]
};

export * from './metrics';
export * from './inspector';
export * from './tree-state';
