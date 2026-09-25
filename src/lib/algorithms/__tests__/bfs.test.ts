import { describe, it, expect } from 'vitest';
import { bfs } from '../bfs';
import { createGrid, setStart, setGoal, setWall } from '../../graph/grid';
import { GridAdapter } from '../../graph/graph-adapter';
import { ManualGraph } from '../../graph/manual';

describe('BFS Algorithm', () => {
	it('should find the shortest path in an empty grid', () => {
		const grid = createGrid(5, 5);
		setStart(grid, '0,0');
		setGoal(grid, '4,4');
		
		const adapter = new GridAdapter(grid);
		const result = bfs.run(adapter, grid.start!, grid.goal!);
		
		expect(result.metrics.pathLength).toBe(9); // 8 steps = 9 nodes
		expect(result.events.length).toBeGreaterThan(0);
	});

	it('should find path around an obstacle', () => {
		const grid = createGrid(3, 3);
		setStart(grid, '0,0');
		setGoal(grid, '0,2');
		setWall(grid, '0,1', false);
		setWall(grid, '1,1', false);
		// Path must go down to row 2 and back up
		
		const adapter = new GridAdapter(grid);
		const result = bfs.run(adapter, grid.start!, grid.goal!);
		
		expect(result.metrics.pathLength).toBe(7); 
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
		const result = bfs.run(adapter, grid.start!, grid.goal!);
		
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
		
		const result = bfs.run(graph, 'A', 'C');
		expect(result.metrics.pathLength).toBe(3);
	});

	it('reports a one-node zero-cost path when start equals goal', () => {
		const grid = createGrid(1, 1);
		const result = bfs.run(new GridAdapter(grid), '0,0', '0,0');

		expect(result.metrics.pathLength).toBe(1);
		expect(result.metrics.pathCost).toBe(0);
	});
});
