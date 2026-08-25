import type { Grid, NodeId } from '../graph/types';
import { getNeighbors } from '../graph/neighbors';
import type { Algorithm, AlgorithmEvent, AlgorithmMetrics, AlgorithmResult } from './types';
import { MinHeap } from './heap';

function heuristic(nodeA: NodeId, nodeB: NodeId): number {
	const [r1, c1] = nodeA.split(',').map(Number);
	const [r2, c2] = nodeB.split(',').map(Number);
	return Math.abs(r1 - r2) + Math.abs(c1 - c2);
}

export const astar: Algorithm = {
	name: 'A* Search',
	description: 'Uses heuristics to guarantee the shortest path much faster than Dijkstra\'s Algorithm. Optimal for weighted graphs.',
	supportsWeights: true,
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

		const openSet = new MinHeap<NodeId>();
		const gScore = new Map<NodeId, number>();
		const fScore = new Map<NodeId, number>();
		const parentMap = new Map<NodeId, NodeId>();
		const closedSet = new Set<NodeId>();

		gScore.set(start, 0);
		fScore.set(start, heuristic(start, goal));
		openSet.insert(start, fScore.get(start)!);

		let found = false;

		while (!openSet.isEmpty()) {
			metrics.maxFrontierSize = Math.max(metrics.maxFrontierSize, openSet.size());
			
			const current = openSet.extractMin()!;

			// In a priority queue with duplicates (because we don't do decrease-key), 
			// we might extract a node we've already fully processed.
			if (closedSet.has(current)) {
				continue;
			}
			closedSet.add(current);

			if (current !== start) {
				events.push({ type: 'expand', node: current });
				metrics.nodesExpanded++;
			}

			if (current === goal) {
				found = true;
				break;
			}

			const neighbors = getNeighbors(grid, current);
			
			for (const neighbor of neighbors) {
				if (closedSet.has(neighbor.id)) {
					events.push({ type: 'skip', node: neighbor.id });
					continue;
				}

				const tentativeGScore = gScore.get(current)! + neighbor.weight;
				const neighborGScore = gScore.get(neighbor.id) ?? Infinity;

				if (tentativeGScore < neighborGScore) {
					parentMap.set(neighbor.id, current);
					gScore.set(neighbor.id, tentativeGScore);
					
					const h = heuristic(neighbor.id, goal);
					const f = tentativeGScore + h;
					fScore.set(neighbor.id, f);
					
					if (neighborGScore === Infinity) {
						// Newly discovered
						metrics.nodesDiscovered++;
						events.push({ type: 'discover', node: neighbor.id, from: current });
					}
					
					openSet.insert(neighbor.id, f);
					events.push({ 
						type: 'update', 
						node: neighbor.id, 
						parent: current,
						g: tentativeGScore,
						h: h,
						f: f
					});
				} else {
					events.push({ type: 'skip', node: neighbor.id });
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
			metrics.pathCost = gScore.get(goal) ?? 0;
		} else {
			events.push({ type: 'no-path' });
		}

		events.push({ type: 'finish', found });
		metrics.executionTimeMs = performance.now() - startTime;

		return { events, metrics };
	}
};
