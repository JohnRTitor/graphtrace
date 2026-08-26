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
});
