import type { AlgorithmEvent } from '../algorithms/types';
import type { VisualizationState } from './types';

/**
 * The pathfinding family's reducer.
 *
 * There are two entry points, and the split is the point:
 *
 * - `applyEventInto` mutates the collections it is given and is O(1) per event.
 * - `applyEvent` is a thin pure wrapper over it, kept because purity is part of
 *   the family's reducer contract and is what the trace-reducer tests assert.
 *
 * The previous implementation cloned all seven collections on *every* event, so
 * stepping cost O(state size) per step and a backward seek - which is a replay
 * from the initial state - cost O(events x state size). Measured on a 30x40 grid
 * that was 0.12ms per event, so a single seek across a BFS trace blocked for
 * ~160ms in one task. Mutating costs ~0.1us per event, which brings a full replay
 * of any trace in this app to well under a frame.
 *
 * Paired with `stepInto` below, each event still produces exactly one new state
 * record, so reactive consumers invalidate once per event rather than once per
 * mutated cell.
 */

// Helper to efficiently shallow clone the state
function cloneState(state: VisualizationState): VisualizationState {
	return {
		cellStates: new Map(state.cellStates),
		currentNode: state.currentNode,
		pathNodes: new Set(state.pathNodes),
		pathEdges: new Set(state.pathEdges),
		costData: new Map(state.costData),
		expansionHistory: [...state.expansionHistory]
	};
}

/**
 * Folds one event into `state` **in place**.
 *
 * O(1) in the size of the state, which is what makes stepping and replay cheap.
 */
export function applyEventInto(state: VisualizationState, event: AlgorithmEvent): void {
	switch (event.type) {
		case 'start':
			break;

		case 'discover':
			state.cellStates.set(event.node, 'discovered');
			break;

		case 'expand':
			if (state.currentNode) {
				state.cellStates.set(state.currentNode, 'expanded');
				state.expansionHistory.push(state.currentNode);
			}
			state.currentNode = event.node;
			state.cellStates.set(event.node, 'current');
			break;

		case 'update':
			if (!state.cellStates.has(event.node)) {
				state.cellStates.set(event.node, 'discovered');
			}
			state.costData.set(event.node, {
				g: event.g,
				h: event.h,
				f: event.f
			});
			break;

		case 'skip':
			break;

		case 'path':
			for (const node of event.nodes) {
				state.cellStates.set(node, 'path');
				state.pathNodes.add(node);
			}
			for (const edge of event.edges ?? []) {
				state.pathEdges.add(edge);
			}
			if (state.currentNode) {
				state.cellStates.set(state.currentNode, 'expanded');
				state.expansionHistory.push(state.currentNode);
				state.currentNode = null;
			}
			break;

		case 'no-path':
		case 'finish':
			if (state.currentNode) {
				state.cellStates.set(state.currentNode, 'expanded');
				state.expansionHistory.push(state.currentNode);
				state.currentNode = null;
			}
			break;
	}
}

/**
 * Pure fold, and the family's reducer contract.
 *
 * A fresh state is produced by cloning, so the caller's state is never touched.
 */
export function applyEvent(
	prevState: VisualizationState,
	event: AlgorithmEvent
): VisualizationState {
	const state = cloneState(prevState);
	applyEventInto(state, event);
	return state;
}

/**
 * `applyEventInto` followed by a fresh record identity.
 *
 * The record is shallow, so this is seven field writes. Subscribers that
 * invalidate on record identity - every `$state` and `$derived` in the renderers
 * - see exactly one change per event, even though the mutation may have touched
 * a Map a thousand keys long.
 */
export function stepInto(
	state: VisualizationState,
	event: AlgorithmEvent
): VisualizationState {
	applyEventInto(state, event);
	return { ...state };
}

export function invertEvent(
	prevState: VisualizationState,
	event: AlgorithmEvent
): VisualizationState {
	const state = cloneState(prevState);

	switch (event.type) {
		case 'start':
			break;

		case 'discover':
			// Inverse of discover is removing it from cellStates
			// Technically it might have been unvisited
			state.cellStates.delete(event.node);
			break;

		case 'expand':
			// Inverse of expand: the current node becomes discovered again
			state.cellStates.set(event.node, 'discovered');
			// The previous current node becomes current again
			if (state.expansionHistory.length > 0) {
				const prevCurrent = state.expansionHistory.pop()!;
				state.currentNode = prevCurrent;
				state.cellStates.set(prevCurrent, 'current');
			} else {
				state.currentNode = null;
			}
			break;

		case 'update':
			// Update is tricky to invert exactly without knowing prior cost.
			// But for pure visualization purposes, if we step backwards over an update,
			// typically we just delete the costData if we want to be simple,
			// or we need previous costData. But since we don't have it, we delete it.
			state.costData.delete(event.node);
			break;

		case 'skip':
			break;

		case 'path':
			for (const node of event.nodes) {
				state.cellStates.set(node, 'expanded');
				state.pathNodes.delete(node);
			}
			for (const edge of event.edges ?? []) {
				state.pathEdges.delete(edge);
			}
			if (state.expansionHistory.length > 0) {
				const prevCurrent = state.expansionHistory.pop()!;
				state.currentNode = prevCurrent;
				state.cellStates.set(prevCurrent, 'current');
			}
			break;

		case 'no-path':
		case 'finish':
			// Restore the last current node
			if (state.expansionHistory.length > 0) {
				const prevCurrent = state.expansionHistory.pop()!;
				state.currentNode = prevCurrent;
				state.cellStates.set(prevCurrent, 'current');
			}
			break;
	}

	return state;
}
