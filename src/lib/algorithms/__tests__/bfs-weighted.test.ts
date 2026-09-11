import { describe, it, expect } from 'vitest';
import { bfs } from '../bfs';
import { createGrid, setStart, setGoal, setWeight } from '../../graph/grid';
import { GridAdapter } from '../../graph/graph-adapter';
import { ManualGraph } from '../../graph/manual';

describe('BFS on Weighted Graphs (Characterization)', () => {
	it('pins pathCost to path.length - 1 on a grid regardless of heavy weights', () => {
		const grid = createGrid(3, 3);
		setStart(grid, '0,0');
		setGoal(grid, '0,2');
		
		// Make the direct path extremely heavy
		setWeight(grid, '0,1', 100);
		
		const adapter = new GridAdapter(grid);
		const result = bfs.run(adapter, grid.start!, grid.goal!);
		
		// BFS ignores weights and takes the path 0,0 -> 0,1 -> 0,2
		expect(result.metrics.pathLength).toBe(3);
		// pathCost is hardcoded to pathLength - 1, completely ignoring the 100 weight
		expect(result.metrics.pathCost).toBe(2);
	});

	it('pins pathCost to path.length - 1 on a manual graph regardless of edge weights', () => {
		const graph = new ManualGraph();
		graph.execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		graph.execute({ type: 'add-node', node: { id: 'B', x: 10, y: 0, label: 'B' } });
		graph.execute({ type: 'add-node', node: { id: 'C', x: 20, y: 0, label: 'C' } });
		
		// Add an extremely heavy edge
		graph.execute({ type: 'add-edge', edge: { id: 'e1', source: 'A', target: 'B', weight: 50, directed: false } });
		graph.execute({ type: 'add-edge', edge: { id: 'e2', source: 'B', target: 'C', weight: 1, directed: false } });
		
		const result = bfs.run(graph, 'A', 'C');
		
		expect(result.metrics.pathLength).toBe(3);
		// pathCost is hardcoded to pathLength - 1, ignoring the 50 weight
		expect(result.metrics.pathCost).toBe(2);
	});
});
