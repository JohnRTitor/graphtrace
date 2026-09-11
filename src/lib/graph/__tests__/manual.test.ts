import { describe, it, expect } from 'vitest';
import { ManualGraph } from '../manual';

describe('ManualGraph', () => {
	it('should add and remove nodes', () => {
		const graph = new ManualGraph();
		
		graph.execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		expect(graph.nodes.has('A')).toBe(true);
		
		graph.execute({ type: 'remove-node', node: graph.nodes.get('A')!, attachedEdges: [] });
		expect(graph.nodes.has('A')).toBe(false);
	});

	it('should support undo and redo', () => {
		const graph = new ManualGraph();
		
		graph.execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		expect(graph.nodes.has('A')).toBe(true);
		
		graph.undo();
		expect(graph.nodes.has('A')).toBe(false);
		
		graph.redo();
		expect(graph.nodes.has('A')).toBe(true);
	});

	it('should remove attached edges when removing a node', () => {
		const graph = new ManualGraph();
		
		graph.execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		graph.execute({ type: 'add-node', node: { id: 'B', x: 10, y: 0, label: 'B' } });
		graph.execute({ type: 'add-edge', edge: { id: 'e1', source: 'A', target: 'B', weight: 1, directed: false } });
		
		expect(graph.edges.has('e1')).toBe(true);
		
		const nodeA = graph.nodes.get('A')!;
		const attachedEdges = graph.getAttachedEdges('A');
		
		graph.execute({ type: 'remove-node', node: nodeA, attachedEdges });
		
		expect(graph.nodes.has('A')).toBe(false);
		expect(graph.edges.has('e1')).toBe(false);
		
		graph.undo();
		
		expect(graph.nodes.has('A')).toBe(true);
		expect(graph.edges.has('e1')).toBe(true);
	});

	it('should serialize and deserialize correctly', () => {
		const graph1 = new ManualGraph();
		graph1.execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		graph1.execute({ type: 'set-start', from: null, to: 'A' });
		
		const serialized = JSON.parse(graph1.serialize());
		
		const graph2 = new ManualGraph();
		graph2.load(serialized);
		
		expect(graph2.nodes.has('A')).toBe(true);
		expect(graph2.start).toBe('A');
	});

	it('should rename a node and undo/redo the label change', () => {
		const graph = new ManualGraph();
		graph.execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'N1' } });

		graph.execute({ type: 'set-label', id: 'A', from: 'N1', to: 'Origin' });
		expect(graph.nodes.get('A')!.label).toBe('Origin');

		graph.undo();
		expect(graph.nodes.get('A')!.label).toBe('N1');

		graph.redo();
		expect(graph.nodes.get('A')!.label).toBe('Origin');
	});

	it('should reverse a directed edge and undo/redo it', () => {
		const graph = new ManualGraph();
		graph.execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		graph.execute({ type: 'add-node', node: { id: 'B', x: 10, y: 0, label: 'B' } });
		graph.execute({ type: 'add-edge', edge: { id: 'e1', source: 'A', target: 'B', weight: 1, directed: true } });

		graph.execute({ type: 'reverse-edge', edgeId: 'e1', oldSource: 'A', oldTarget: 'B' });
		expect(graph.edges.get('e1')!.source).toBe('B');
		expect(graph.edges.get('e1')!.target).toBe('A');

		graph.undo();
		expect(graph.edges.get('e1')!.source).toBe('A');
		expect(graph.edges.get('e1')!.target).toBe('B');

		graph.redo();
		expect(graph.edges.get('e1')!.source).toBe('B');
		expect(graph.edges.get('e1')!.target).toBe('A');
	});

	it('clearing start/goal via set-start/set-goal with null restores on undo', () => {
		const graph = new ManualGraph();
		graph.execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		graph.execute({ type: 'set-start', from: null, to: 'A' });
		expect(graph.start).toBe('A');

		graph.execute({ type: 'set-start', from: 'A', to: null });
		expect(graph.start).toBeNull();

		graph.undo();
		expect(graph.start).toBe('A');
	});

	it('characterization: getHeuristic always returns 0 (Dijkstra degradation)', () => {
		const graph = new ManualGraph();
		graph.execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		graph.execute({ type: 'add-node', node: { id: 'B', x: 100, y: 100, label: 'B' } });
		
		// Even though nodes have spatial coordinates, heuristic returns 0 today
		expect(graph.getHeuristic('A', 'B')).toBe(0);
	});
});
