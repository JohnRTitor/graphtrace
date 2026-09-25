import type { NodeId } from '../graph/types';

export type CellVisualState = 
	| 'empty'
	| 'wall'
	| 'start'
	| 'goal'
	| 'discovered' // in frontier
	| 'expanded'   // fully explored
	| 'current'    // currently being processed
	| 'path';      // part of the final path

export type CostData = {
	g?: number;
	h?: number;
	f?: number;
};

export type VisualizationState = {
	cellStates: Map<NodeId, CellVisualState>;
	currentNode: NodeId | null;
	pathNodes: Set<NodeId>;
	pathEdges: Set<string>;
	costData: Map<NodeId, CostData>;
	expansionHistory: NodeId[];
};

export type PlaybackStatus = 'idle' | 'running' | 'paused' | 'completed';

export function createInitialVisualizationState(): VisualizationState {
	return {
		cellStates: new Map(),
		currentNode: null,
		pathNodes: new Set(),
		pathEdges: new Set(),
		costData: new Map(),
		expansionHistory: []
	};
}
