import { describe, it, expect } from 'vitest';
import { generatePerfectMaze, generateBraidedMaze } from '../maze';
import { validateMaze } from '../validation';
import type { GeneratorOptions } from '../types';

describe('Maze Generators', () => {
	describe('Perfect Maze', () => {
		it('should generate a connected maze with E = V - 1 (no cycles)', () => {
			const options: GeneratorOptions = { seed: 12345 };
			const grid = generatePerfectMaze(31, 41, options);
			
			const validation = validateMaze(grid);
			
			expect(validation.connected).toBe(true);
			expect(validation.cycleCount).toBe(0);
			expect(validation.edgeCount).toBe(validation.nodeCount - 1);
			expect(validation.isPerfectMaze).toBe(true);
		});

		it('should place start and goal on walkable cells', () => {
			const options: GeneratorOptions = { seed: 12345 };
			const grid = generatePerfectMaze(31, 41, options);
			
			const startNode = grid.nodes.get(grid.start!);
			const goalNode = grid.nodes.get(grid.goal!);
			
			expect(startNode?.walkable).toBe(true);
			expect(goalNode?.walkable).toBe(true);
		});

		it('should be deterministic given the same seed', () => {
			const options: GeneratorOptions = { seed: 999 };
			const grid1 = generatePerfectMaze(21, 21, options);
			const grid2 = generatePerfectMaze(21, 21, options);
			
			const map1 = Array.from(grid1.nodes.values()).map(n => n.walkable);
			const map2 = Array.from(grid2.nodes.values()).map(n => n.walkable);
			
			expect(map1).toEqual(map2);
		});
		
		it('should produce different mazes with different seeds', () => {
			const grid1 = generatePerfectMaze(21, 21, { seed: 100 });
			const grid2 = generatePerfectMaze(21, 21, { seed: 101 });
			
			const map1 = Array.from(grid1.nodes.values()).map(n => n.walkable);
			const map2 = Array.from(grid2.nodes.values()).map(n => n.walkable);
			
			expect(map1).not.toEqual(map2);
		});
	});

	describe('Braided Maze', () => {
		it('should generate a connected maze with cycles', () => {
			const options: GeneratorOptions = { seed: 12345, loopDensity: 50 };
			const grid = generateBraidedMaze(31, 41, options);
			
			const validation = validateMaze(grid);
			
			expect(validation.connected).toBe(true);
			expect(validation.cycleCount).toBeGreaterThan(0);
			expect(validation.isPerfectMaze).toBe(false);
		});

		it('should place start and goal on walkable cells', () => {
			const options: GeneratorOptions = { seed: 12345, loopDensity: 50 };
			const grid = generateBraidedMaze(31, 41, options);
			
			const startNode = grid.nodes.get(grid.start!);
			const goalNode = grid.nodes.get(grid.goal!);
			
			expect(startNode?.walkable).toBe(true);
			expect(goalNode?.walkable).toBe(true);
		});
	});
});
