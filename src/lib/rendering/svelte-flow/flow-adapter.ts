import type { ManualGraph } from '$lib/graph/manual';
import type { VisualizationState } from '$lib/visualization/types';
import type { CustomNode, CustomEdge } from './types';
import type { NodeId } from '$lib/graph/types';
import { MarkerType } from '@xyflow/svelte';

export function extractPathEdges(pathNodes: NodeId[], graph: ManualGraph): Set<string> {
	const pathEdges = new Set<string>();
	if (pathNodes.length < 2) return pathEdges;

	for (let i = 0; i < pathNodes.length - 1; i++) {
		const u = pathNodes[i];
		const v = pathNodes[i + 1];

		// Find edge between u and v
		let foundEdgeId: string | null = null;
		for (const [edgeId, edge] of graph.edges.entries()) {
			if ((edge.source === u && edge.target === v) || (edge.source === v && edge.target === u)) {
				foundEdgeId = edgeId;
				break; // Stop after first match (could be multiple in multigraph, but graphtrace isn't one)
			}
		}

		if (foundEdgeId) {
			pathEdges.add(foundEdgeId);
		}
	}
	return pathEdges;
}

export function toFlowNodes(
	graph: ManualGraph, 
	vizState: VisualizationState | null, 
	showCosts: boolean,
	colors: any
): CustomNode[] {
	return Array.from(graph.nodes.values()).map(node => {
		const cellState = vizState?.cellStates.get(node.id);
		
		let state: 'discovered' | 'expanded' | 'current' | 'path' | 'none' = 'none';
		if (cellState === 'path') state = 'path';
		else if (cellState === 'current') state = 'current';
		else if (cellState === 'expanded') state = 'expanded';
		else if (cellState === 'discovered') state = 'discovered';

		const costData = vizState?.costData.get(node.id);

		return {
			id: node.id,
			type: 'custom',
			position: { x: node.x, y: node.y },
			data: {
				label: node.label,
				isStart: node.id === graph.start,
				isGoal: node.id === graph.goal,
				state,
				g: costData?.g,
				h: costData?.h,
				f: costData?.f,
				showCosts,
				colors
			}
		};
	});
}

export function toFlowEdges(
	graph: ManualGraph,
	vizState: VisualizationState | null,
	pathEdges: Set<string>,
	colors: any
): CustomEdge[] {
	return Array.from(graph.edges.values()).map(edge => {
		
		// In a graph, edges aren't directly in vizState cells. 
		// We could infer edge state from endpoint states, or just use pathEdges.
		// For now, let's just highlight path edges, or if both endpoints are expanded.
		let state: 'discovered' | 'expanded' | 'current' | 'path' | 'none' = 'none';
		
		if (pathEdges.has(edge.id)) {
			state = 'path';
		} else if (vizState) {
			const sourceState = vizState.cellStates.get(edge.source);
			const targetState = vizState.cellStates.get(edge.target);
			// Just a nice visual touch: if both endpoints are expanded, edge looks expanded
			if (sourceState === 'expanded' && targetState === 'expanded') {
				state = 'expanded';
			} else if ((sourceState === 'expanded' || sourceState === 'discovered' || sourceState === 'path' || sourceState === 'current') && 
					   (targetState === 'expanded' || targetState === 'discovered' || targetState === 'path' || targetState === 'current')) {
				state = 'discovered';
			}
		}

		return {
			id: edge.id,
			type: 'custom',
			source: edge.source,
			target: edge.target,
			animated: state === 'path', // Animate path edges
			markerEnd: edge.directed ? MarkerType.ArrowClosed : undefined,
			data: {
				weight: edge.weight,
				directed: edge.directed,
				isPath: state === 'path',
				state,
				colors
			}
		};
	});
}
