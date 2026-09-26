import { applyEvent, stepInto } from '../../visualization/trace-reducer';
import type { VisualizationState } from '../../visualization/types';
import type { AlgorithmEvent } from '../../algorithms/types';
import { toTraceEvents, type TraceEvent } from '../../trace/types';
import type { GameTreeTraceState } from '../adversarial/tree-state';
import type { TraceState } from '../../trace/types';

/**
 * The pathfinding family's trace state is the pre-existing
 * `VisualizationState`, unchanged. It is kept byte-for-byte as it was because
 * the reducer and player tests assert against `createInitialVisualizationState`.
 * This module only supplies the family-level adapters around it.
 */
export type PathfindingTraceState = VisualizationState;

export function createPathfindingTraceState(): PathfindingTraceState {
	return {
		cellStates: new Map(),
		currentNode: null,
		pathNodes: new Set(),
		pathEdges: new Set(),
		costData: new Map(),
		expansionHistory: []
	};
}

export function isPathfindingState(state: TraceState): state is PathfindingTraceState {
	return (state as PathfindingTraceState).cellStates instanceof Map;
}

/** Wraps the pathfinding union into the shared envelope, `kind` = the event type. */
export function wrapPathfindingEvents(
	events: readonly AlgorithmEvent[]
): TraceEvent<AlgorithmEvent>[] {
	return toTraceEvents(events, events.map((event) => event.type));
}

/**
 * Family reducer for pathfinding. The envelope's payload is unwrapped and
 * handed to the original reducer, so the family's own semantics stay in one
 * place and the shared player stays family-agnostic.
 */
export function reducePathfinding(state: TraceState, event: TraceEvent): TraceState {
	if (!isPathfindingState(state)) return state;
	return applyEvent(state, event.payload as AlgorithmEvent);
}

/**
 * In-place equivalent of {@link reducePathfinding} for the playback engine.
 *
 * The engine prefers this over `reduce`, so a family that supplies it must
 * accept that its state is mutated between steps. The state handed back is a
 * fresh shallow copy, which is what makes the renderer see a new value while
 * the expensive nested structures are shared rather than cloned.
 */
export function stepIntoPathfinding(state: TraceState, event: TraceEvent): TraceState {
	if (!isPathfindingState(state)) return state;
	return stepInto(state, event.payload as AlgorithmEvent);
}

export function asPathfindingState(state: TraceState | null): PathfindingTraceState | null {
	return state && isPathfindingState(state) ? state : null;
}

/** Convenience for renderers that only need the game-tree half of the union. */
export function asGameTreeState(state: TraceState | null): GameTreeTraceState | null {
	return state && (state as GameTreeTraceState).kind === 'game-tree'
		? (state as GameTreeTraceState)
		: null;
}
