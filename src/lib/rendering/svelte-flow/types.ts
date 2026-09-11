import type { Node, Edge } from '@xyflow/svelte';
import type { NodeId } from '$lib/graph/types';

export type GraphNodeData = {
	label: string;
	isStart: boolean;
	isGoal: boolean;
	state?: 'discovered' | 'expanded' | 'current' | 'path' | 'none';
	g?: number; // Cost from start
	h?: number; // Heuristic to goal
	f?: number; // Total cost (g + h)
	showCosts: boolean;
	colors: any;
};

export type GraphEdgeData = {
	weight: number;
	isPath: boolean;
	state?: 'discovered' | 'expanded' | 'current' | 'path' | 'none';
	colors: any;
};

export type CustomNode = Node<GraphNodeData>;
export type CustomEdge = Edge<GraphEdgeData>;
