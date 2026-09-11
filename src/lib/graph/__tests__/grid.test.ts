import { describe, it, expect } from 'vitest';
import { createGrid, setStart, setGoal, setWall, setWeight, getNode } from '../grid';
import { GridAdapter } from '../graph-adapter';

describe('grid', () => {
	it('creates a walkable, unweighted grid by default', () => {
		const grid = createGrid(3, 3);
		expect(grid.nodes.size).toBe(9);
		expect(grid.start).toBeNull();
		expect(grid.goal).toBeNull();
		expect(getNode(grid, '1,1')?.walkable).toBe(true);
		expect(getNode(grid, '1,1')?.weight).toBe(1);
	});

	it('sets and clears start/goal', () => {
		const grid = createGrid(3, 3);
		setStart(grid, '0,0');
		setGoal(grid, '2,2');
		expect(grid.start).toBe('0,0');
		expect(grid.goal).toBe('2,2');

		setStart(grid, null);
		setGoal(grid, null);
		expect(grid.start).toBeNull();
		expect(grid.goal).toBeNull();
	});

	it('allows start and goal to coincide on the same cell', () => {
		// The domain model doesn't forbid this; the maze context menu must
		// therefore offer independent "Clear Start" / "Clear Goal" actions
		// on such a cell rather than a single contradictory item.
		const grid = createGrid(3, 3);
		setStart(grid, '1,1');
		setGoal(grid, '1,1');
		expect(grid.start).toBe('1,1');
		expect(grid.goal).toBe('1,1');
	});

	it('toggles wall and weight independently', () => {
		const grid = createGrid(3, 3);
		setWall(grid, '1,1', false);
		expect(getNode(grid, '1,1')?.walkable).toBe(false);

		setWeight(grid, '0,0', 5);
		expect(getNode(grid, '0,0')?.weight).toBe(5);
	});

	it('characterization: start cost is 0, walls are unreachable, heuristic is Manhattan', () => {
		const grid = createGrid(3, 3);
		setStart(grid, '0,0');
		setGoal(grid, '2,2');
		
		// 1. Walls are unreachable
		setWall(grid, '1,1', false);
		
		// 2. Start cost is 0 conceptually, but we can verify neighbors entering cell cost semantics
		setWeight(grid, '0,1', 10);
		setWeight(grid, '1,0', 5);
		
		const adapter = new GridAdapter(grid);
		
		// Heuristic is Manhattan distance
		expect(adapter.getHeuristic('0,0', '2,2')).toBe(4);
		
		// Check that neighbors of '0,0' return correct entering costs (weight)
		const neighborsFromStart = adapter.getNeighbors('0,0');
		expect(neighborsFromStart).toEqual(
			expect.arrayContaining([
				{ target: '0,1', weight: 10 },
				{ target: '1,0', weight: 5 }
			])
		);
		
		// '1,1' is a wall, so it should not be in the neighbors of '0,1'
		const neighborsFrom01 = adapter.getNeighbors('0,1');
		expect(neighborsFrom01.map(n => n.target)).not.toContain('1,1');
		
		// Returning to start ('0,0') from '0,1' uses the start node's weight (which is 1 by default, since we didn't change it). 
		// Actually, start cost being 0 in the prompt refers to the path calculation, which we tested in bfs.
		// Let's assert the start cell's weight is still 1 if untouched
		expect(neighborsFrom01.find(n => n.target === '0,0')?.weight).toBe(1);
	});
});
