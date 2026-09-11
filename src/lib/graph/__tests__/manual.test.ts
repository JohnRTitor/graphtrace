import { describe, it, expect, beforeEach } from 'vitest';
import { ManualGraph, invertGraphCommand, type GraphCommand } from '../manual';

describe('ManualGraph', () => {
	let graph: ManualGraph;
	let history: GraphCommand[] = [];
	let redoStack: GraphCommand[] = [];

	const execute = (cmd: GraphCommand) => {
		graph.execute(cmd);
		history.push(cmd);
		redoStack = [];
	};

	const undo = () => {
		const cmd = history.pop();
		if (cmd) {
			graph.execute(invertGraphCommand(cmd));
			redoStack.push(cmd);
		}
	};

	const redo = () => {
		const cmd = redoStack.pop();
		if (cmd) {
			graph.execute(cmd);
			history.push(cmd);
		}
	};

	beforeEach(() => {
		graph = new ManualGraph();
		history = [];
		redoStack = [];
	});

	it('should add and remove nodes', () => {
		execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		expect(graph.nodes.has('A')).toBe(true);
		
		execute({ type: 'remove-node', node: graph.nodes.get('A')!, attachedEdges: [] });
		expect(graph.nodes.has('A')).toBe(false);
	});

	it('should support undo and redo', () => {
		execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		expect(graph.nodes.has('A')).toBe(true);
		
		undo();
		expect(graph.nodes.has('A')).toBe(false);
		
		redo();
		expect(graph.nodes.has('A')).toBe(true);
	});

	it('should remove attached edges when removing a node', () => {
		execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		execute({ type: 'add-node', node: { id: 'B', x: 10, y: 0, label: 'B' } });
		execute({ type: 'add-edge', edge: { id: 'e1', source: 'A', target: 'B', weight: 1, directed: false  } });
		
		expect(graph.edges.has('e1')).toBe(true);
		
		const nodeA = graph.nodes.get('A')!;
		const attachedEdges = graph.getAttachedEdges('A');
		
		execute({ type: 'remove-node', node: nodeA, attachedEdges });
		
		expect(graph.nodes.has('A')).toBe(false);
		expect(graph.edges.has('e1')).toBe(false);
		
		undo();
		
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
		execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'N1' } });

		execute({ type: 'set-label', id: 'A', from: 'N1', to: 'Origin' });
		expect(graph.nodes.get('A')!.label).toBe('Origin');

		undo();
		expect(graph.nodes.get('A')!.label).toBe('N1');

		redo();
		expect(graph.nodes.get('A')!.label).toBe('Origin');
	});



	it('clearing start/goal via set-start/set-goal with null restores on undo', () => {
		execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		execute({ type: 'set-start', from: null, to: 'A' });
		expect(graph.start).toBe('A');

		execute({ type: 'set-start', from: 'A', to: null });
		expect(graph.start).toBeNull();

		undo();
		expect(graph.start).toBe('A');
	});

	it('characterization: getHeuristic always returns 0 (Dijkstra degradation)', () => {
		execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		execute({ type: 'add-node', node: { id: 'B', x: 100, y: 100, label: 'B' } });
		
		expect(graph.getHeuristic('A', 'B')).toBe(0);
	});
});
