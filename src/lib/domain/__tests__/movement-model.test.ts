import { describe, it, expect } from 'vitest';
import { getMovementOffsets, type MovementModel } from '../movement-model';
import { getNeighbors } from '../../graph/neighbors';
import { createGrid, setWall } from '../../graph/grid';

describe('MovementModel', () => {
	it('4-way output is identical to the old hardcoded DIRECTIONS_4 array on a sample grid', () => {
		const grid = createGrid(3, 3);
		
		// The original getNeighbors behavior (implicitly 4-way)
		const neighborsWithoutModel = getNeighbors(grid, '1,1');
		const idsWithoutModel = neighborsWithoutModel.map(n => n.id).sort();
		
		expect(idsWithoutModel).toEqual(['0,1', '1,0', '1,2', '2,1']);
		
		// Explicit 4-way model
		const fourWayModel: MovementModel = { type: 'fourWay' };
		const neighborsWithModel = getNeighbors(grid, '1,1', fourWayModel);
		const idsWithModel = neighborsWithModel.map(n => n.id).sort();
		
		expect(idsWithModel).toEqual(idsWithoutModel);
	});

	it('8-way output includes diagonals', () => {
		const grid = createGrid(3, 3);
		const eightWayModel: MovementModel = { type: 'eightWay', blockCornerCutting: true };
		
		const neighbors = getNeighbors(grid, '1,1', eightWayModel);
		expect(neighbors.length).toBe(8);
		
		const ids = neighbors.map(n => n.id).sort();
		expect(ids).toEqual(['0,0', '0,1', '0,2', '1,0', '1,2', '2,0', '2,1', '2,2']);
	});

	it('corner cutting logic blocks diagonals when adjacent walls exist', () => {
		const grid = createGrid(3, 3);
		const eightWayModel: MovementModel = { type: 'eightWay', blockCornerCutting: true };
		
		// Place a wall at 0,1. Moving from 1,1 to 0,0 diagonally should be blocked
		// because one of the adjacent straight cells (0,1) is a wall.
		setWall(grid, '0,1', false);
		
		const neighbors = getNeighbors(grid, '1,1', eightWayModel);
		const ids = neighbors.map(n => n.id);
		
		expect(ids).not.toContain('0,0'); // Blocked by 0,1
		expect(ids).not.toContain('0,2'); // Blocked by 0,1
		expect(ids).toContain('2,0'); // Not blocked
	});

	it('allows corner cutting when the option is disabled', () => {
		const grid = createGrid(3, 3);
		setWall(grid, '0,1', false);
		const model: MovementModel = { type: 'eightWay', blockCornerCutting: false };
		const ids = getNeighbors(grid, '1,1', model).map((neighbor) => neighbor.id);
		expect(ids).toContain('0,0');
	});
});
