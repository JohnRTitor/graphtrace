import type { AlgorithmEvent } from '../algorithms/types';
import type { VisualizationState } from './types';

// Applies a single algorithm event to the visualization state
// Note: This mutates the state object directly for performance, 
// since it will be called thousands of times per second during fast playback.
export function applyEvent(state: VisualizationState, event: AlgorithmEvent): void {
	switch (event.type) {
		case 'start':
			// Just tracking, visualization usually draws start node separately
			break;
			
		case 'discover':
			state.cellStates.set(event.node, 'discovered');
			break;
			
		case 'expand':
			if (state.currentNode) {
				// The previous current node is now fully expanded
				state.cellStates.set(state.currentNode, 'expanded');
			}
			state.currentNode = event.node;
			state.cellStates.set(event.node, 'current');
			break;
			
		case 'update':
			// Used by A* to update costs
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
			// Could be visualized briefly, but usually we ignore it
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
				state.currentNode = null;
			}
			break;
			
		case 'no-path':
			if (state.currentNode) {
				state.cellStates.set(state.currentNode, 'expanded');
				state.currentNode = null;
			}
			break;
			
		case 'finish':
			if (state.currentNode) {
				state.cellStates.set(state.currentNode, 'expanded');
				state.currentNode = null;
			}
			break;
	}
}
