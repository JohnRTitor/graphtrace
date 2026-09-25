import type { Node, Edge } from '@xyflow/svelte';
import type { NodeId } from '$lib/graph/types';

export type GraphColors = {
	bg: string;
	wall: string;
	gridLines: string;
	weight: string;
	text: string;
	start: string;
	goal: string;
	discovered: string;
	expanded: string;
	path: string;
	current: string;
};

export type GraphNodeData = {
	label: string;
	isStart: boolean;
	isGoal: boolean;
	state?: 'discovered' | 'expanded' | 'current' | 'path' | 'none';
	g?: number; // Cost from start
	h?: number; // Heuristic to goal
	f?: number; // Total cost (g + h)
	showCosts: boolean;
	colors: GraphColors;
};

export type GraphEdgeData = {
	weight: number;
	isPath: boolean;
	state?: 'discovered' | 'expanded' | 'current' | 'path' | 'none';
	colors: GraphColors;
};

export type CustomNode = Node<GraphNodeData>;
export type CustomEdge = Edge<GraphEdgeData>;
