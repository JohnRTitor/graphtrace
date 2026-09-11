import { createGrid, setStart, setGoal, setWall, setCost } from '../graph/grid';
import type { Grid } from '../graph/types';
import { PRNG } from '../utils/random';
import type { GeneratorOptions } from './types';

export function generateRandomGrid(
	rows: number,
	cols: number,
	options: GeneratorOptions
): Grid {
	const density = (options.obstacleDensity ?? 30) / 100;
	const grid = createGrid(rows, cols);
	const prng = new PRNG(options.seed);

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

		if (prng.nextFloat() < density) {
			setWall(grid, node.id, false);
		} else if (options.weighted && prng.nextFloat() < 0.2) {
			// 20% chance of a walkable cell having a higher weight (2-9)
			const cost = prng.nextInt(2, 10);
			setCost(grid, node.id, cost);
		}
	}

	return grid;
}

export function generateBlankGrid(
	rows: number,
	cols: number,
	options: GeneratorOptions
): Grid {
	const grid = createGrid(rows, cols);

	const startR = Math.floor(rows / 2);
	const startC = Math.floor(cols / 4);
	const goalR = Math.floor(rows / 2);
	const goalC = Math.floor((cols * 3) / 4);
	
	setStart(grid, `${startR},${startC}`);
	setGoal(grid, `${goalR},${goalC}`);

	return grid;
}
