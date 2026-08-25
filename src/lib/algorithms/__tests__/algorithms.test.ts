import { describe, it, expect } from 'vitest';
import { bfs } from '../bfs';
import { dfs } from '../dfs';
import { astar } from '../astar';
import { createGrid, setWall, setWeight } from '../../graph/grid';

describe('BFS Algorithm', () => {
	it('should find shortest path on empty grid', () => {
		const grid = createGrid(5, 5); // start 1,1 goal 3,3
		const events = bfs(grid);
		
		// The last event should be a path event
		const lastEvent = events[events.length - 1];
		expect(lastEvent.type).toBe('path');
		expect(lastEvent.nodeIds).toContain('3,3'); // includes goal
		
		// Shortest path from (1,1) to (3,3) is 4 steps (length 5 including start)
		expect(lastEvent.nodeIds.length).toBe(5);
	});

	it('should fail if goal is unreachable', () => {
		let grid = createGrid(5, 5);
		// Wall off the start node (1,1)
		grid = setWall(grid, '0,1');
		grid = setWall(grid, '1,0');
		grid = setWall(grid, '2,1');
		grid = setWall(grid, '1,2');
		
		const events = bfs(grid);
		const lastEvent = events[events.length - 1];
		
		// Since it can't reach the goal, it should end with visited events, no path
		expect(lastEvent.type).toBe('visited');
	});
});

describe('DFS Algorithm', () => {
	it('should find a path to the goal', () => {
		const grid = createGrid(5, 5);
		const events = dfs(grid);
		
		const pathEvents = events.filter(e => e.type === 'path');
		expect(pathEvents.length).toBe(1);
		
		const pathEvent = pathEvents[0];
		expect(pathEvent.nodeIds).toContain('1,1');
		expect(pathEvent.nodeIds).toContain('3,3');
	});
});

describe('A* Algorithm', () => {
	it('should find optimal path with weights', () => {
		let grid = createGrid(5, 5);
		// Path straight is (1,1) -> (2,1) -> (3,1) -> (3,2) -> (3,3)
		// Let's put a heavy weight on (2,1)
		grid = setWeight(grid, '2,1', 10);
		
		const events = astar(grid);
		const pathEvent = events[events.length - 1];
		expect(pathEvent.type).toBe('path');
		
		// It should avoid (2,1)
		expect(pathEvent.nodeIds).not.toContain('2,1');
	});
});
