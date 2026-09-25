import type { AlgorithmEvent } from '../algorithms/types';
import type { VisualizationState } from './types';

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

export function applyEvent(prevState: VisualizationState, event: AlgorithmEvent): VisualizationState {
	const state = cloneState(prevState);

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

	return state;
}

export function invertEvent(prevState: VisualizationState, event: AlgorithmEvent): VisualizationState {
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
