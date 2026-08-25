import { createGrid, setStart, setGoal, setWall, setWeight } from '../graph/grid';
import type { Grid } from '../graph/types';

export function generateDefaultPreset(rows: number, cols: number): Grid {
	const grid = createGrid(rows, cols);
	
	const startR = Math.floor(rows / 2);
	const startC = Math.floor(cols / 6);
	const goalR = Math.floor(rows / 2);
	const goalC = Math.floor((cols * 5) / 6);
	
	setStart(grid, `${startR},${startC}`);
	setGoal(grid, `${goalR},${goalC}`);

	// Create a simple wall structure
	const wallCol = Math.floor(cols / 3);
	for (let r = Math.floor(rows / 4); r < Math.floor((rows * 3) / 4); r++) {
		setWall(grid, `${r},${wallCol}`, true);
	}
	
	const wallCol2 = Math.floor((cols * 2) / 3);
	for (let r = Math.floor(rows / 3); r < Math.floor(rows); r++) {
		setWall(grid, `${r},${wallCol2}`, true);
	}

	// Add some weighted terrain in the middle
	for (let r = Math.floor(rows / 3); r < Math.floor((rows * 2) / 3); r++) {
		for (let c = Math.floor(cols / 2) - 2; c < Math.floor(cols / 2) + 3; c++) {
			setWeight(grid, `${r},${c}`, 5);
		}
	}
	for (let r = Math.floor(rows / 3) + 1; r < Math.floor((rows * 2) / 3) - 1; r++) {
		for (let c = Math.floor(cols / 2) - 1; c < Math.floor(cols / 2) + 2; c++) {
			setWeight(grid, `${r},${c}`, 9);
		}
	}

	return grid;
}
