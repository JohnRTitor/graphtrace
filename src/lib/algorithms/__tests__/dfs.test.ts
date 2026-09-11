import { describe, it, expect } from 'vitest';
import { dfs } from '../dfs';
import { createGrid, setStart, setGoal, setWall } from '../../graph/grid';
import { GridAdapter } from '../../graph/graph-adapter';
import { ManualGraph } from '../../graph/manual';

describe('DFS Algorithm', () => {
	it('should find a path in an empty grid', () => {
		const grid = createGrid(5, 5);
		setStart(grid, '0,0');
		setGoal(grid, '4,4');
		
		const adapter = new GridAdapter(grid);
		const result = dfs.run(adapter, grid.start!, grid.goal!);
		
		// DFS path length is unpredictable, but it should find *a* path
		expect(result.metrics.pathLength).toBeGreaterThanOrEqual(9); 
		expect(result.events.length).toBeGreaterThan(0);
	});

	it('should return no path if unreachable', () => {
		const grid = createGrid(3, 3);
		setStart(grid, '0,0');
		setGoal(grid, '2,2');
		
		// Wall off the start
		setWall(grid, '0,1', false);
		setWall(grid, '1,0', false);
		setWall(grid, '1,1', false);
		
		const adapter = new GridAdapter(grid);
		const result = dfs.run(adapter, grid.start!, grid.goal!);
		
		expect(result.metrics.pathLength).toBe(0); 
		expect(result.metrics.nodesExpanded).toBe(0); // Only start node
	});

	it('should work on a manual graph', () => {
		const graph = new ManualGraph();
		graph.execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		graph.execute({ type: 'add-node', node: { id: 'B', x: 10, y: 0, label: 'B' } });
		graph.execute({ type: 'add-node', node: { id: 'C', x: 20, y: 0, label: 'C' } });
		graph.execute({ type: 'add-edge', edge: { id: 'e1', source: 'A', target: 'B', weight: 1, directed: false  } });
		graph.execute({ type: 'add-edge', edge: { id: 'e2', source: 'B', target: 'C', weight: 1, directed: false  } });
		
		const result = dfs.run(graph, 'A', 'C');
		expect(result.metrics.pathLength).toBe(3);
	});
});
