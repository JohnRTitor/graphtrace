import type { BaseGraph, NodeId } from '../graph/types';
import type { Algorithm, AlgorithmEvent, AlgorithmMetrics, AlgorithmResult } from './types';

export const bfs: Algorithm = {
	name: 'Breadth-First Search',
	description: 'Explores all nodes at the present depth before moving on to nodes at the next depth level. Guarantees the shortest path on unweighted graphs.',
	supportsWeights: false,
	complexity: { time: 'O(V + E)', space: 'O(V)' },
	properties: { optimal: true, complete: true },
	run(graph: BaseGraph, start: NodeId, goal: NodeId): AlgorithmResult {
		const startTime = performance.now();
		const events: AlgorithmEvent[] = [];
		const metrics: AlgorithmMetrics = {
			nodesDiscovered: 0,
			nodesExpanded: 0,
			maxFrontierSize: 0,
			pathLength: 0,
			pathCost: 0,
			executionTimeMs: 0
		};

		events.push({ type: 'start', node: start });

		if (start === goal) {
			events.push({ type: 'path', nodes: [start] });
			events.push({ type: 'finish', found: true });
			metrics.pathLength = 1;
			metrics.executionTimeMs = performance.now() - startTime;
			return { events, metrics };
		}

		const queue: NodeId[] = [start];
		let head = 0;
		const visited = new Set<NodeId>([start]);
		const parentMap = new Map<NodeId, NodeId>();
		const parentEdgeMap = new Map<NodeId, string>();
		
		let found = false;

		while (head < queue.length) {
			metrics.maxFrontierSize = Math.max(metrics.maxFrontierSize, queue.length - head);
			
			const current = queue[head++];
			
			if (current !== start) {
				events.push({ type: 'expand', node: current });
				metrics.nodesExpanded++;
			}

			if (current === goal) {
				found = true;
				break;
			}

			const neighbors = graph.getNeighbors(current);
			
			for (const neighbor of neighbors) {
				if (!visited.has(neighbor.target)) {
					visited.add(neighbor.target);
					parentMap.set(neighbor.target, current);
					if (neighbor.id) parentEdgeMap.set(neighbor.target, neighbor.id);
					queue.push(neighbor.target);
					events.push({ type: 'discover', node: neighbor.target, from: current, edge: neighbor.id });
					metrics.nodesDiscovered++;
				}
			}
		}

		if (found) {
			const path: NodeId[] = [];
			const pathEdges: string[] = [];
			let curr: NodeId | undefined = goal;
			while (curr) {
				path.unshift(curr);
				const parent = parentMap.get(curr);
				const edgeId = parentEdgeMap.get(curr);
				if (edgeId) pathEdges.push(edgeId);
				curr = parent;
			}
			pathEdges.reverse();
			events.push({ type: 'path', nodes: path, ...(pathEdges.length > 0 ? { edges: pathEdges } : {}) });
			metrics.pathLength = path.length;
			metrics.pathCost = path.length - 1; // Unweighted cost
		} else {
			events.push({ type: 'no-path' });
		}

		events.push({ type: 'finish', found });
		metrics.executionTimeMs = performance.now() - startTime;

		return { events, metrics };
	}
};
