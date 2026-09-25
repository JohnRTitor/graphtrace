import { describe, it, expect } from 'vitest';
import { ManualGraph } from '../../../graph/manual';
import { extractPathEdges, toFlowNodes, toFlowEdges } from '../flow-adapter';

describe('Flow Adapter', () => {
	it('should extract path edges correctly', () => {
		const graph = new ManualGraph();
		graph.execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		graph.execute({ type: 'add-node', node: { id: 'B', x: 10, y: 0, label: 'B' } });
		graph.execute({ type: 'add-node', node: { id: 'C', x: 20, y: 0, label: 'C' } });
		
		graph.execute({ type: 'add-edge', edge: { id: 'e1', source: 'A', target: 'B', weight: 1, directed: false  } });
		graph.execute({ type: 'add-edge', edge: { id: 'e2', source: 'B', target: 'C', weight: 1, directed: false  } });
		graph.execute({ type: 'add-edge', edge: { id: 'e3', source: 'A', target: 'C', weight: 1, directed: false  } });

		// Path: A -> B -> C
		const pathEdges = extractPathEdges(['A', 'B', 'C'], graph);
		
		expect(pathEdges.size).toBe(2);
		expect(pathEdges.has('e1')).toBe(true);
		expect(pathEdges.has('e2')).toBe(true);
		expect(pathEdges.has('e3')).toBe(false);
	});

	it('does not match a directed edge against a reverse path', () => {
		const graph = new ManualGraph();
		graph.execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		graph.execute({ type: 'add-node', node: { id: 'B', x: 10, y: 0, label: 'B' } });
		graph.execute({ type: 'add-edge', edge: { id: 'reverse', source: 'B', target: 'A', weight: 1, directed: true } });

		expect(extractPathEdges(['A', 'B'], graph).size).toBe(0);
	});

	it('chooses the lowest valid edge id for parallel edges', () => {
		const graph = new ManualGraph();
		graph.execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		graph.execute({ type: 'add-node', node: { id: 'B', x: 10, y: 0, label: 'B' } });
		graph.execute({ type: 'add-edge', edge: { id: 'edge-z', source: 'A', target: 'B', weight: 1, directed: false } });
		graph.execute({ type: 'add-edge', edge: { id: 'edge-a', source: 'A', target: 'B', weight: 1, directed: false } });

		const pathEdges = extractPathEdges(['A', 'B'], graph);
		expect(Array.from(pathEdges)).toEqual(['edge-a']);
	});
	
	it('should handle empty paths', () => {
		const graph = new ManualGraph();
		expect(extractPathEdges([], graph).size).toBe(0);
		expect(extractPathEdges(['A'], graph).size).toBe(0);
	});
	
	it('should map nodes to flow nodes', () => {
		const graph = new ManualGraph();
		graph.execute({ type: 'add-node', node: { id: 'A', x: 10, y: 20, label: 'A' } });
		
		const colors = {
			bg: 'white',
			wall: 'gray',
			gridLines: 'lightgray',
			weight: 'gray',
			text: 'black',
			start: 'green',
			goal: 'red',
			discovered: 'blue',
			expanded: 'indigo',
			path: 'gold',
			current: 'magenta'
		};
		const flowNodes = toFlowNodes(graph, null, false, colors);
		
		expect(flowNodes).toHaveLength(1);
		expect(flowNodes[0].id).toBe('A');
		expect(flowNodes[0].position.x).toBe(10);
		expect(flowNodes[0].position.y).toBe(20);
		expect(flowNodes[0].data.label).toBe('A');
	});
});
