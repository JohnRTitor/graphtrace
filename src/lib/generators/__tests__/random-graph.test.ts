import { describe, it, expect } from 'vitest';
import { generateRandomGraph } from '../random-graph';
import { ManualGraph } from '../../graph/manual';

describe('generateRandomGraph', () => {
	it('generates the correct number of nodes', () => {
		const snapshot = generateRandomGraph({
			nodeCount: 10,
			edgeMultiplier: 2,
			weighted: false,
			ensurePath: false, directed: false, seed: 123
		});
		
		expect(snapshot.nodes.length).toBe(10);
		expect(snapshot.start).not.toBeNull();
		expect(snapshot.goal).not.toBeNull();
		expect(snapshot.start).not.toBe(snapshot.goal);
	});

	it('generates no duplicate edges and no self loops', () => {
		const snapshot = generateRandomGraph({
			nodeCount: 5,
			edgeMultiplier: 3,
			weighted: false,
			ensurePath: false, directed: false, seed: 123
		});
		
		const edgeSet = new Set<string>();
		for (const edge of snapshot.edges) {
			expect(edge.source).not.toBe(edge.target);
			
			const key = [edge.source, edge.target].sort().join('-');
			expect(edgeSet.has(key)).toBe(false);
			edgeSet.add(key);
		}
	});

	it('ensures connectivity when ensurePath is true (undirected)', () => {
		const snapshot = generateRandomGraph({
			nodeCount: 20,
			edgeMultiplier: 1.5,
			weighted: false,
			ensurePath: true, directed: false, seed: 456
		});
		
		// At least N-1 edges for a spanning tree
		expect(snapshot.edges.length).toBeGreaterThanOrEqual(19);
		
		// Basic reachability check
		const adj = new Map<string, string[]>();
		for (const n of snapshot.nodes) adj.set(n.id, []);
		for (const e of snapshot.edges) {
			adj.get(e.source)!.push(e.target);
			adj.get(e.target)!.push(e.source);
		}
		
		const visited = new Set<string>();
		const queue = [snapshot.nodes[0].id];
		visited.add(queue[0]);
		
		while(queue.length > 0) {
			const curr = queue.shift()!;
			for (const neighbor of adj.get(curr)!) {
				if (!visited.has(neighbor)) {
					visited.add(neighbor);
					queue.push(neighbor);
				}
			}
		}
		
		expect(visited.size).toBe(20); // all nodes reachable
	});

	it('ensures a path from start to goal when ensurePath is true (directed)', () => {
		const snapshot = generateRandomGraph({
			nodeCount: 20,
			edgeMultiplier: 1.5,
			weighted: false,
			ensurePath: true, directed: true, seed: 789
		});
		
		const adj = new Map<string, string[]>();
		for (const n of snapshot.nodes) adj.set(n.id, []);
		for (const e of snapshot.edges) {
			adj.get(e.source)!.push(e.target);
		}
		
		const visited = new Set<string>();
		const queue = [snapshot.start!];
		visited.add(queue[0]);
		
		let reachedGoal = false;
		while(queue.length > 0) {
			const curr = queue.shift()!;
			if (curr === snapshot.goal) {
				reachedGoal = true;
				break;
			}
			for (const neighbor of adj.get(curr)!) {
				if (!visited.has(neighbor)) {
					visited.add(neighbor);
					queue.push(neighbor);
				}
			}
		}
		
		expect(reachedGoal).toBe(true);
	});

	it('is deterministic with the same seed', () => {
		const options = {
			nodeCount: 15,
			edgeMultiplier: 2,
			weighted: true,
			ensurePath: true, directed: false, seed: 999
		};
		
		const snapshot1 = generateRandomGraph(options);
		const snapshot2 = generateRandomGraph(options);
		
		expect(snapshot1).toEqual(snapshot2);
	});
	
	it('generates valid weights when weighted is true', () => {
		const snapshot = generateRandomGraph({
			nodeCount: 10,
			edgeMultiplier: 2,
			weighted: true,
			ensurePath: false, directed: false, seed: 123
		});
		
		for (const edge of snapshot.edges) {
			expect(edge.weight).toBeGreaterThanOrEqual(1);
			expect(edge.weight).toBeLessThanOrEqual(10);
		}
	});

	it('respects directed option and allows overriding edge direction post-generation', () => {
		const snapshot = generateRandomGraph({
			nodeCount: 5,
			edgeMultiplier: 2,
			weighted: false,
			ensurePath: false,
			directed: true,
			seed: 123
		});
		
		// All generated edges should have directed: true
		for (const edge of snapshot.edges) {
			expect(edge.directed).toBe(true);
		}

		// Verify manual graph can load and modify it
		const graph = new ManualGraph();
		graph.load({
			nodes: snapshot.nodes,
			edges: snapshot.edges,
			start: snapshot.start,
			goal: snapshot.goal
		});

		const firstEdgeId = snapshot.edges[0].id;
		graph.execute({
			type: 'set-edge-directed',
			edgeId: firstEdgeId,
			from: true,
			to: false
		});

		const modifiedEdge = graph.edges.get(firstEdgeId);
		expect(modifiedEdge?.directed).toBe(false);
	});
});
