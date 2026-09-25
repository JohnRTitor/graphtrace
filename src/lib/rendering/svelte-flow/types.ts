import type { Node, Edge } from '@xyflow/svelte';
import type { NodeId } from '$lib/graph/types';
import { tracePaletteFor, type ThemeName } from '$lib/theme/tokens';

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

/**
 * Projects the centralized theme palette onto the node-edge renderer's colour
 * shape.
 *
 * The mapping from trace state to colour lives here and nowhere else: the manual
 * graph renderer's "discovered"/"expanded" names are simply the frontier and
 * visited states under the names this adapter has always used, so a grid cell and
 * a graph node showing the same stage of a search are the same colour.
 */
export function graphColorsFor(theme: ThemeName): GraphColors {
	const palette = tracePaletteFor(theme);
	return {
		bg: palette.background,
		wall: palette.barrier,
		gridLines: palette.structure,
		weight: palette.surface,
		text: palette.mutedText,
		start: palette.start,
		goal: palette.goal,
		discovered: palette.frontier,
		expanded: palette.visited,
		path: palette.path,
		current: palette.current
	};
}

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
export type { NodeId };
