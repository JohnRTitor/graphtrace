import { describe, expect, it } from 'vitest';
import { ManualGraph } from '../../../graph/manual';
import { generateRandomGraph } from '../../../generators/random-graph';
import { extractPathEdges, graphStructureKey } from '../flow-adapter';

describe('graphStructureKey', () => {
	const graphWith = (nodeCount: number) => {
		const snapshot = generateRandomGraph({
			nodeCount,
			edgeMultiplier: 2,
			weighted: true,
			ensurePath: true,
			directed: false,
			seed: 7
		});
		const graph = new ManualGraph();
		graph.load({ nodes: snapshot.nodes, edges: snapshot.edges, start: snapshot.start, goal: snapshot.goal });
		return graph;
	};

	it('is stable across a node move, which is what stops the viewport refitting', () => {
		// The graph editor re-fits on this key. Reading the whole graph instead meant
		// every dropped drag triggered a full fitView: a relayout of every node and
		// edge, plus a visible jump back to the origin after each drag.
		const graph = graphWith(20);
		const before = graphStructureKey(graph);

		const first = graph.nodes.keys().next().value as string;
		graph.execute({ type: 'move-node', id: first, from: { x: 0, y: 0 }, to: { x: 400, y: 300 } });

		expect(graphStructureKey(graph)).toBe(before);
	});

	it('is stable across repeated moves of the same node', () => {
		const graph = graphWith(20);
		const before = graphStructureKey(graph);
		const first = graph.nodes.keys().next().value as string;

		for (let index = 0; index < 25; index++) {
			graph.execute({
				type: 'move-node',
				id: first,
				from: { x: 0, y: 0 },
				to: { x: index, y: index }
			});
		}

		expect(graphStructureKey(graph)).toBe(before);
	});

	it('changes when a node is added', () => {
		const graph = graphWith(20);
		const before = graphStructureKey(graph);

		graph.execute({ type: 'add-node', node: { id: 'extra', x: 0, y: 0, label: 'X' } });

		expect(graphStructureKey(graph)).not.toBe(before);
	});

	it('changes when an edge is added', () => {
		const graph = graphWith(20);
		const before = graphStructureKey(graph);
		const [a, b] = Array.from(graph.nodes.keys());

		graph.execute({ type: 'add-edge', edge: { id: 'zz', source: a, target: b, weight: 1, directed: false } });

		expect(graphStructureKey(graph)).not.toBe(before);
	});

	it('changes when the start or goal moves', () => {
		const graph = graphWith(20);
		const before = graphStructureKey(graph);

		graph.execute({ type: 'set-goal', from: graph.goal, to: null });

		expect(graphStructureKey(graph)).not.toBe(before);
	});
});

describe('extractPathEdges index', () => {
	/**
	 * The index replaced a scan-and-sort of the whole edge list per hop, which made
	 * the per-step cost of highlighting the path O(path x edges log edges). These
	 * assertions pin the resolution rules so the optimisation cannot change what is
	 * drawn.
	 */
	it('resolves an undirected hop in either direction', () => {
		const graph = new ManualGraph();
		graph.execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		graph.execute({ type: 'add-node', node: { id: 'B', x: 10, y: 0, label: 'B' } });
		graph.execute({ type: 'add-edge', edge: { id: 'ab', source: 'A', target: 'B', weight: 1, directed: false } });

		expect(Array.from(extractPathEdges(['A', 'B'], graph))).toEqual(['ab']);
		expect(Array.from(extractPathEdges(['B', 'A'], graph))).toEqual(['ab']);
	});

	it('does not match a directed edge against a reverse hop', () => {
		const graph = new ManualGraph();
		graph.execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		graph.execute({ type: 'add-node', node: { id: 'B', x: 10, y: 0, label: 'B' } });
		graph.execute({ type: 'add-edge', edge: { id: 'reverse', source: 'B', target: 'A', weight: 1, directed: true } });

		expect(extractPathEdges(['A', 'B'], graph).size).toBe(0);
	});

	it('prefers the lowest-weight parallel edge, then the lowest id', () => {
		const graph = new ManualGraph();
		graph.execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		graph.execute({ type: 'add-node', node: { id: 'B', x: 10, y: 0, label: 'B' } });
		graph.execute({ type: 'add-edge', edge: { id: 'heavy', source: 'A', target: 'B', weight: 9, directed: false } });
		graph.execute({ type: 'add-edge', edge: { id: 'light-b', source: 'A', target: 'B', weight: 1, directed: false } });
		graph.execute({ type: 'add-edge', edge: { id: 'light-a', source: 'A', target: 'B', weight: 1, directed: false } });

		expect(Array.from(extractPathEdges(['A', 'B'], graph))).toEqual(['light-a']);
	});

	it('handles empty and single-node paths', () => {
		const graph = new ManualGraph();
		expect(extractPathEdges([], graph).size).toBe(0);
		expect(extractPathEdges(['A'], graph).size).toBe(0);
	});

	it('sees an edge added after the index was built', () => {
		// The index is cached per graph version. If it were not invalidated, a newly
		// drawn edge would silently never be highlighted.
		const graph = new ManualGraph();
		graph.execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		graph.execute({ type: 'add-node', node: { id: 'B', x: 10, y: 0, label: 'B' } });

		expect(extractPathEdges(['A', 'B'], graph).size).toBe(0);

		graph.execute({ type: 'add-edge', edge: { id: 'ab', source: 'A', target: 'B', weight: 1, directed: false } });

		expect(Array.from(extractPathEdges(['A', 'B'], graph))).toEqual(['ab']);
	});

	it('sees a removed edge', () => {
		const graph = new ManualGraph();
		graph.execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		graph.execute({ type: 'add-node', node: { id: 'B', x: 10, y: 0, label: 'B' } });
		graph.execute({ type: 'add-edge', edge: { id: 'ab', source: 'A', target: 'B', weight: 1, directed: false } });
		expect(extractPathEdges(['A', 'B'], graph).size).toBe(1);

		graph.execute({ type: 'remove-edge', edge: { id: 'ab', source: 'A', target: 'B', weight: 1, directed: false } });

		expect(extractPathEdges(['A', 'B'], graph).size).toBe(0);
	});

	it('sees a re-weighted edge', () => {
		const graph = new ManualGraph();
		graph.execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		graph.execute({ type: 'add-node', node: { id: 'B', x: 10, y: 0, label: 'B' } });
		graph.execute({ type: 'add-edge', edge: { id: 'heavy', source: 'A', target: 'B', weight: 9, directed: false } });
		graph.execute({ type: 'add-edge', edge: { id: 'light', source: 'A', target: 'B', weight: 1, directed: false } });
		expect(Array.from(extractPathEdges(['A', 'B'], graph))).toEqual(['light']);

		graph.execute({ type: 'set-weight', edgeId: 'light', from: 1, to: 99 });

		expect(Array.from(extractPathEdges(['A', 'B'], graph))).toEqual(['heavy']);
	});

	it('resolves a whole path', () => {
		const graph = new ManualGraph();
		for (const id of ['A', 'B', 'C', 'D']) {
			graph.execute({ type: 'add-node', node: { id, x: 0, y: 0, label: id } });
		}
		graph.execute({ type: 'add-edge', edge: { id: 'ab', source: 'A', target: 'B', weight: 1, directed: false } });
		graph.execute({ type: 'add-edge', edge: { id: 'bc', source: 'B', target: 'C', weight: 1, directed: false } });
		graph.execute({ type: 'add-edge', edge: { id: 'cd', source: 'C', target: 'D', weight: 1, directed: false } });
		graph.execute({ type: 'add-edge', edge: { id: 'ac', source: 'A', target: 'C', weight: 1, directed: false } });

		expect(Array.from(extractPathEdges(['A', 'B', 'C', 'D'], graph)).sort()).toEqual(['ab', 'bc', 'cd']);
	});
});
