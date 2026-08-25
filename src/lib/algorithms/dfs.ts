import type { Grid, NodeId } from '../graph/types';
import { getNeighbors } from '../graph/neighbors';
import type { Algorithm, AlgorithmEvent, AlgorithmMetrics, AlgorithmResult } from './types';

export const dfs: Algorithm = {
	name: 'Depth-First Search',
	description: 'Explores as far as possible along each branch before backtracking. Does not guarantee the shortest path.',
	supportsWeights: false,
	run(grid: Grid, start: NodeId, goal: NodeId): AlgorithmResult {
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
			metrics.executionTimeMs = performance.now() - startTime;
			return { events, metrics };
		}

		const stack: NodeId[] = [start];
		const visited = new Set<NodeId>();
		const parentMap = new Map<NodeId, NodeId>();
		
		let found = false;

		while (stack.length > 0) {
			metrics.maxFrontierSize = Math.max(metrics.maxFrontierSize, stack.length);
			
			const current = stack.pop()!;
			
			if (!visited.has(current)) {
				visited.add(current);
				
				if (current !== start) {
					events.push({ type: 'expand', node: current });
					metrics.nodesExpanded++;
				}

				if (current === goal) {
					found = true;
					break;
				}

				const neighbors = getNeighbors(grid, current);
				
				// Push in reverse order so that we explore in the "up, right, down, left" priority order visually
				// (Because stack pops the last added element first)
				for (let i = neighbors.length - 1; i >= 0; i--) {
					const neighbor = neighbors[i];
					if (!visited.has(neighbor.id)) {
						if (!parentMap.has(neighbor.id)) {
							// Only set parent the first time we discover it to keep path somewhat logical
							parentMap.set(neighbor.id, current);
						}
						stack.push(neighbor.id);
						events.push({ type: 'discover', node: neighbor.id, from: current });
						metrics.nodesDiscovered++;
					} else {
						events.push({ type: 'skip', node: neighbor.id });
					}
				}
			} else {
				events.push({ type: 'skip', node: current });
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
