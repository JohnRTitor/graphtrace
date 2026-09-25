import { describe, it, expect, beforeEach } from 'vitest';
import { ManualGraph, invertGraphCommand, type GraphCommand } from '../manual';
import type { CostModel } from '../../domain/cost-model';

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

	it('traverses directed edges only in their source-to-target direction', () => {
		execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		execute({ type: 'add-node', node: { id: 'B', x: 10, y: 0, label: 'B' } });
		execute({ type: 'add-node', node: { id: 'C', x: 20, y: 0, label: 'C' } });
		execute({ type: 'add-edge', edge: { id: 'ab', source: 'A', target: 'B', weight: 1, directed: true } });
		execute({ type: 'add-edge', edge: { id: 'bc', source: 'B', target: 'C', weight: 1, directed: true } });

		expect(graph.getNeighbors('A').map((neighbor) => neighbor.target)).toEqual(['B']);
		expect(graph.getNeighbors('B').map((neighbor) => neighbor.target)).toEqual(['C']);
		expect(graph.getNeighbors('C')).toEqual([]);
	});

	it('applies edge and entered-node costs in each traversal direction', () => {
		const costModel: CostModel = {
			edgeCost: (edge) => edge.weight * 2,
			nodeCost: (node) => node.cost ?? 0
		};
		graph = new ManualGraph(costModel);
		graph.execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A', cost: 100 } });
		graph.execute({ type: 'add-node', node: { id: 'B', x: 10, y: 0, label: 'B', cost: 3 } });

		graph.execute({ type: 'add-edge', edge: { id: 'ab', source: 'A', target: 'B', weight: 2, directed: false } });

		expect(graph.getNeighbors('A')).toEqual([{ target: 'B', weight: 7 }]);
		expect(graph.getNeighbors('B')).toEqual([{ target: 'A', weight: 104 }]);
	});

	it('uses movementCost as the total graph entry cost when provided', () => {
		graph = new ManualGraph({ movementCost: (from, to) => from === 'A' && to === 'B' ? 0.5 : 2 });
		graph.execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		graph.execute({ type: 'add-node', node: { id: 'B', x: 10, y: 0, label: 'B' } });
		graph.execute({ type: 'add-edge', edge: { id: 'ab', source: 'A', target: 'B', weight: 9, directed: true } });

		expect(graph.getNeighbors('A')).toEqual([{ target: 'B', weight: 0.5 }]);
	});

	it('rejects invalid command costs, weights, and endpoint references', () => {
		execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		execute({ type: 'add-node', node: { id: 'B', x: 10, y: 0, label: 'B' } });
		execute({ type: 'add-node', node: { id: 'invalid', x: 20, y: 0, label: 'Invalid', cost: -1 } });
		execute({ type: 'add-edge', edge: { id: 'valid', source: 'A', target: 'B', weight: 0, directed: false } });
		execute({ type: 'add-edge', edge: { id: 'negative', source: 'A', target: 'B', weight: -1, directed: false } });
		execute({ type: 'add-edge', edge: { id: 'infinite', source: 'A', target: 'B', weight: Infinity, directed: false } });
		execute({ type: 'add-edge', edge: { id: 'dangling', source: 'A', target: 'missing', weight: 1, directed: false } });
		execute({ type: 'set-weight', edgeId: 'valid', from: 0, to: -1 });
		execute({ type: 'set-weight', edgeId: 'valid', from: 0, to: Number.NaN });
		execute({ type: 'set-node-cost', nodeId: 'A', from: undefined, to: Infinity });
		execute({ type: 'set-start', from: null, to: 'missing' });
		execute({ type: 'set-goal', from: null, to: 'missing' });

		expect(graph.nodes.has('invalid')).toBe(false);
		expect(Array.from(graph.edges.keys())).toEqual(['valid']);
		expect(graph.edges.get('valid')?.weight).toBe(0);
		expect(graph.nodes.get('A')?.cost).toBeUndefined();
		expect(graph.start).toBeNull();
		expect(graph.goal).toBeNull();
	});

	it('loads finite nonnegative costs and only edges with valid endpoints', () => {
		const loaded = new ManualGraph();
		loaded.load({
			nodes: [
				{ id: 'A', x: 0, y: 0, label: 'A', cost: 0 },
				{ id: 'B', x: 10, y: 0, label: 'B', cost: -1 },
				{ id: 'C', x: 20, y: 0, label: 'C', cost: Infinity },
				{ id: 'D', x: 30, y: 0, label: 'D', cost: 0.5 }
			],
			edges: [
				{ id: 'zero', source: 'A', target: 'D', weight: 0, directed: false },
				{ id: 'negative', source: 'A', target: 'D', weight: -0.5, directed: false },
				{ id: 'fractional', source: 'A', target: 'D', weight: 0.5, directed: false },
				{ id: 'missing', source: 'A', target: 'unknown', weight: 1, directed: false }
			],
			start: 'A',
			goal: 'missing'
		});

		expect(Array.from(loaded.nodes.keys())).toEqual(['A', 'D']);
		expect(Array.from(loaded.edges.keys())).toEqual(['zero', 'fractional']);
		expect(loaded.start).toBe('A');
		expect(loaded.goal).toBeNull();
	});
});
