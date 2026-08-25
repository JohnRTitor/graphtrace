import { createGrid, setStart, setGoal, setWall, setWeight } from '../graph/grid';
import type { Grid } from '../graph/types';

export type RandomGeneratorOptions = {
	density?: number; // 0.0 to 1.0, representing wall density
	weighted?: boolean; // whether to add weights
};

// Simple pseudo-random number generator for reproducible grids if needed
function splitmix32(a: number) {
	return function() {
		a |= 0;
		a = a + 0x9e3779b9 | 0;
		let t = a ^ a >>> 16;
		t = Math.imul(t, 0x21f0aaad);
		t = t ^ t >>> 15;
		t = Math.imul(t, 0x735a2d97);
		return ((t = t ^ t >>> 15) >>> 0) / 4294967296;
	}
}

export function generateRandomGrid(
	rows: number,
	cols: number,
	options: RandomGeneratorOptions = {}
): Grid {
	const density = options.density ?? 0.3;
	const grid = createGrid(rows, cols);
	const prng = splitmix32(Date.now()); // Using current time as seed for now

	const startR = Math.floor(rows / 2);
	const startC = Math.floor(cols / 4);
	const goalR = Math.floor(rows / 2);
	const goalC = Math.floor((cols * 3) / 4);
	
	const startId = `${startR},${startC}`;
	const goalId = `${goalR},${goalC}`;
	
	setStart(grid, startId);
	setGoal(grid, goalId);

	for (const node of grid.nodes.values()) {
		if (node.id === startId || node.id === goalId) continue;

		if (prng() < density) {
			setWall(grid, node.id, true);
		} else if (options.weighted && prng() < 0.2) {
			// 20% chance of a walkable cell having a higher weight (2-9)
			const weight = Math.floor(prng() * 8) + 2;
			setWeight(grid, node.id, weight);
		}
	}

	return grid;
}
