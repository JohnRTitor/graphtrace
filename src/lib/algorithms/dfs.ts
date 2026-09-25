import type { BaseGraph, NodeId } from '../graph/types';
import type { Algorithm, AlgorithmEvent, AlgorithmMetrics, AlgorithmResult } from './types';

export const dfs: Algorithm = {
	name: 'Depth-First Search',
	description: 'Explores as far as possible along each branch before backtracking. Does not guarantee the shortest path.',
	supportsWeights: false,
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

		const stack: NodeId[] = [start];
		const visited = new Set<NodeId>([start]);
		const parentMap = new Map<NodeId, NodeId>();
		
		let found = false;

		while (stack.length > 0) {
			metrics.maxFrontierSize = Math.max(metrics.maxFrontierSize, stack.length);
			
			const current = stack.pop()!;
			
			if (current !== start) {
				events.push({ type: 'expand', node: current });
				metrics.nodesExpanded++;
			}

			if (current === goal) {
				found = true;
				break;
			}

			const neighbors = graph.getNeighbors(current);
			
			// For DFS, standard practice in visualization is to push neighbors in reverse order
			// so that they are explored in visual "top-to-bottom/left-to-right" order when popped.
			// However, keeping it simple: just push them as returned.
			for (let i = neighbors.length - 1; i >= 0; i--) {
				const neighbor = neighbors[i];
				if (!visited.has(neighbor.target)) {
					visited.add(neighbor.target);
					parentMap.set(neighbor.target, current);
					stack.push(neighbor.target);
					events.push({ type: 'discover', node: neighbor.target, from: current });
					metrics.nodesDiscovered++;
				} else {
					// Only show skip if it's not the parent we just came from
					if (parentMap.get(current) !== neighbor.target) {
						events.push({ type: 'skip', node: neighbor.target });
					}
				}
			}
		}

		if (found) {
			const path: NodeId[] = [];
			let curr: NodeId | undefined = goal;
			while (curr) {
				path.unshift(curr);
				curr = parentMap.get(curr);
			}
			events.push({ type: 'path', nodes: path });
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
