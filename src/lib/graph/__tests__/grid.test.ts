import { describe, it, expect } from 'vitest';
import { createGrid, setWall, setWeight, clearNode, clearWallsAndWeights } from '../grid';
import { getNeighbors } from '../neighbors';

describe('Graph Grid Utilities', () => {
	it('should create a grid with correct dimensions', () => {
		const grid = createGrid(5, 5);
		expect(grid.rows).toBe(5);
		expect(grid.cols).toBe(5);
		expect(grid.nodes.size).toBe(25);
		expect(grid.startNode).toBe('1,1');
		expect(grid.goalNode).toBe('3,3');
	});

	it('should set walls', () => {
		let grid = createGrid(5, 5);
		grid = setWall(grid, '0,0');
		expect(grid.nodes.get('0,0')?.isWall).toBe(true);
		
		grid = clearNode(grid, '0,0');
		expect(grid.nodes.get('0,0')?.isWall).toBe(false);
	});

	it('should set weights', () => {
		let grid = createGrid(5, 5);
		grid = setWeight(grid, '2,2', 10);
		expect(grid.nodes.get('2,2')?.weight).toBe(10);
		
		grid = clearNode(grid, '2,2');
		expect(grid.nodes.get('2,2')?.weight).toBe(1);
	});

	it('should clear all walls and weights', () => {
		let grid = createGrid(5, 5);
		grid = setWall(grid, '0,0');
		grid = setWeight(grid, '1,1', 5);
		
		grid = clearWallsAndWeights(grid);
		expect(grid.nodes.get('0,0')?.isWall).toBe(false);
		expect(grid.nodes.get('1,1')?.weight).toBe(1);
	});
});

describe('Graph Neighbors', () => {
	it('should get valid neighbors (no diagonals)', () => {
		const grid = createGrid(3, 3);
		// Middle node
		const neighbors = getNeighbors(grid, '1,1');
		expect(neighbors).toHaveLength(4);
		expect(neighbors.map(n => n.id).sort()).toEqual(['0,1', '1,0', '1,2', '2,1']);
	});

	it('should not return wall neighbors', () => {
		let grid = createGrid(3, 3);
		grid = setWall(grid, '0,1');
		const neighbors = getNeighbors(grid, '1,1');
		expect(neighbors).toHaveLength(3);
		expect(neighbors.map(n => n.id).sort()).toEqual(['1,0', '1,2', '2,1']);
	});

	it('should respect grid boundaries', () => {
		const grid = createGrid(3, 3);
		// Corner node
		const neighbors = getNeighbors(grid, '0,0');
		expect(neighbors).toHaveLength(2);
		expect(neighbors.map(n => n.id).sort()).toEqual(['0,1', '1,0']);
	});
});
