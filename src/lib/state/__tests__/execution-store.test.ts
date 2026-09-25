import { describe, expect, it } from 'vitest';
import { ExecutionStore } from '../execution-store.svelte';
import { ManualGraph } from '../../graph/manual';
import type { Problem } from '../../domain/problem';

function graphProblem(graph: ManualGraph, nodeCost: (node: { cost?: number }) => number): Problem {
	return {
		type: 'graph',
		graph,
		costModel: {
			nodeCost,
			edgeCost: (edge) => edge.weight
		},
		version: 'test'
	};
}

describe('ExecutionStore', () => {
	it('uses the problem cost model when executing a manual graph', () => {
		const graph = new ManualGraph();
		graph.execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		graph.execute({ type: 'add-node', node: { id: 'B', x: 10, y: 0, label: 'B', cost: 5 } });
		graph.execute({ type: 'add-node', node: { id: 'C', x: 20, y: 0, label: 'C' } });
		graph.execute({ type: 'add-edge', edge: { id: 'ab', source: 'A', target: 'B', weight: 1, directed: true } });
		graph.execute({ type: 'add-edge', edge: { id: 'bc', source: 'B', target: 'C', weight: 1, directed: true } });
		graph.execute({ type: 'add-edge', edge: { id: 'ac', source: 'A', target: 'C', weight: 10, directed: true } });
		graph.execute({ type: 'set-start', from: null, to: 'A' });
		graph.execute({ type: 'set-goal', from: null, to: 'C' });

		const store = new ExecutionStore();
		store.run(graphProblem(graph, (node) => node.cost ?? 0), 'astar');
		const execution = store.activeExecution;

		expect(execution?.metrics.pathCost).toBe(7);
		expect(execution?.trace.find((event) => event.type === 'path')).toEqual({
			type: 'path',
			nodes: ['A', 'B', 'C'],
			edges: ['ab', 'bc']
		});
	});

	it('rejects missing start or goal nodes', () => {
		const graph = new ManualGraph();
		graph.execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		const store = new ExecutionStore();

		expect(() => store.run(graphProblem(graph, () => 0), 'bfs')).toThrow();
	});

	it('keeps an immutable problem snapshot with the execution', () => {
		const graph = new ManualGraph();
		graph.execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		graph.execute({ type: 'add-node', node: { id: 'B', x: 10, y: 0, label: 'B' } });
		graph.execute({ type: 'add-edge', edge: { id: 'ab', source: 'A', target: 'B', weight: 1, directed: false } });
		graph.execute({ type: 'set-start', from: null, to: 'A' });
		graph.execute({ type: 'set-goal', from: null, to: 'B' });

		const store = new ExecutionStore();
		store.run(graphProblem(graph, () => 0), 'bfs');
		graph.nodes.get('A')!.label = 'Changed';

		const snapshot = store.activeExecution?.problemSnapshot;
		expect(snapshot?.type).toBe('graph');
		if (snapshot?.type === 'graph') {
			expect(snapshot.graph.nodes.get('A')?.label).toBe('A');
		}
	});
});
