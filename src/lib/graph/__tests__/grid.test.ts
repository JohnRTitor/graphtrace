import { describe, it, expect } from 'vitest';
import { createGrid, setStart, setGoal, setWall, setWeight, getNode } from '../grid';

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
});
