import type { ManualGraph } from '$lib/graph/manual';
import type { VisualizationState } from '$lib/visualization/types';
import type { CustomNode, CustomEdge, GraphColors } from './types';
import type { NodeId } from '$lib/graph/types';
import { MarkerType } from '@xyflow/svelte';

/**
 * A cheap structural fingerprint of a graph: node count, edge count, and the
 * start/goal markers.
 *
 * Used as a reactivity key so that moving a node does not invalidate anything
 * that only cares about the graph's shape. Deliberately excludes node positions -
 * those change on every drag, and re-fitting the viewport to them is both a
 * waste and a visible jump.
 */
export function graphStructureKey(graph: ManualGraph): string {
	return `${graph.nodes.size}:${graph.edges.size}:${graph.start ?? '-'}:${graph.goal ?? '-'}`;
}

export function extractPathEdges(pathNodes: NodeId[], graph: ManualGraph): Set<string> {
	const pathEdges = new Set<string>();
	if (pathNodes.length < 2) return pathEdges;

	const index = edgeIndexFor(graph);

	for (let i = 0; i < pathNodes.length - 1; i++) {
		const foundEdgeId = index.get(`${pathNodes[i]}|${pathNodes[i + 1]}`);
		if (foundEdgeId !== undefined) pathEdges.add(foundEdgeId);
	}
	return pathEdges;
}

/**
 * Undirected-hop index: `source|target` -> the edge id to draw for that hop.
 *
 * The previous implementation scanned and sorted the whole edge list once per hop,
 * making `extractPathEdges` O(path x edges log edges) and re-running it on every
 * playback step - the per-step cost of highlighting the path. The index is built
 * once per graph version and cached in a `WeakMap`, so a hop is a single lookup.
 *
 * Ties resolve to the same edge as before: lowest weight, then lowest id.
 */
const edgeIndexes = new WeakMap<ManualGraph, { version: number; index: Map<string, string> }>();

function edgeIndexFor(graph: ManualGraph): Map<string, string> {
	const cached = edgeIndexes.get(graph);
	// `ManualGraph` is mutated in place and exposes a monotonic `version`, so it is
	// the only invalidation signal needed.
	if (cached && cached.version === graph.version) return cached.index;

	const index = new Map<string, string>();
	const best = new Map<string, { weight: number; id: string }>();
	for (const [id, edge] of graph.edges) {
		const pairs: [NodeId, NodeId][] = edge.directed
			? [[edge.source, edge.target]]
			: [
					[edge.source, edge.target],
					[edge.target, edge.source]
				];
		for (const [from, to] of pairs) {
			const key = `${from}|${to}`;
			const current = best.get(key);
			if (
				current === undefined ||
				edge.weight < current.weight ||
				(edge.weight === current.weight && id < current.id)
			) {
				best.set(key, { weight: edge.weight, id });
				index.set(key, id);
			}
		}
	}

	edgeIndexes.set(graph, { version: graph.version, index });
	return index;
}

export function toFlowNodes(
	graph: ManualGraph, 
	vizState: VisualizationState | null, 
	showCosts: boolean,
	colors: GraphColors
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
	colors: GraphColors
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
