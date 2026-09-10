import type { BaseGraph, NodeId } from '../graph/types';
import type { Algorithm, AlgorithmEvent, AlgorithmMetrics, AlgorithmResult } from './types';
import { MinHeap } from './heap';

export const astar: Algorithm = {
	name: 'A* Search',
	description: 'Uses heuristics to guarantee the shortest path much faster than Dijkstra\'s Algorithm. Optimal for weighted graphs.',
	supportsWeights: true,
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
			metrics.executionTimeMs = performance.now() - startTime;
			return { events, metrics };
		}

		const openSet = new MinHeap<NodeId>();
		const gScore = new Map<NodeId, number>();
		const fScore = new Map<NodeId, number>();
		const parentMap = new Map<NodeId, NodeId>();
		const closedSet = new Set<NodeId>();

		gScore.set(start, 0);
		fScore.set(start, graph.getHeuristic(start, goal));
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

			const neighbors = graph.getNeighbors(current);
			
			for (const neighbor of neighbors) {
				const tentativeGScore = gScore.get(current)! + neighbor.weight;
				const neighborGScore = gScore.get(neighbor.target) ?? Infinity;

				if (tentativeGScore < neighborGScore) {
					if (closedSet.has(neighbor.target)) {
						closedSet.delete(neighbor.target);
					}

					parentMap.set(neighbor.target, current);
					gScore.set(neighbor.target, tentativeGScore);
					
					const h = graph.getHeuristic(neighbor.target, goal);
					const f = tentativeGScore + h;
					fScore.set(neighbor.target, f);
					
					if (neighborGScore === Infinity) {
						// Newly discovered
						metrics.nodesDiscovered++;
						events.push({ type: 'discover', node: neighbor.target, from: current });
					}
					
					openSet.insert(neighbor.target, f);
					events.push({ 
						type: 'update', 
						node: neighbor.target, 
						parent: current,
						g: tentativeGScore,
						h: h,
						f: f
					});
				} else {
					events.push({ type: 'skip', node: neighbor.target });
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

