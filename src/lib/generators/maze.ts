import { createGrid, setStart, setGoal, setWall } from '../graph/grid';
import type { Grid } from '../graph/types';

// Recursive backtracking maze generator
export function generateMaze(rows: number, cols: number): Grid {
	const grid = createGrid(rows, cols);
	
	// Start with all walls
	for (const node of grid.nodes.values()) {
		setWall(grid, node.id, true);
	}

	// Maze dimensions (needs to be odd sized for this algorithm to work well)
	// We'll map the logical maze to our actual grid
	const mazeRows = Math.floor((rows - 1) / 2);
	const mazeCols = Math.floor((cols - 1) / 2);
	
	const visited = Array(mazeRows).fill(false).map(() => Array(mazeCols).fill(false));
	
	function carve(r: number, c: number) {
		visited[r][c] = true;
		
		// Map logical maze coord to actual grid coord (offset by 1 to have outer wall)
		const gridR = r * 2 + 1;
		const gridC = c * 2 + 1;
		setWall(grid, `${gridR},${gridC}`, false);
		
		// Shuffle directions
		const dirs = [
			[-1, 0], [0, 1], [1, 0], [0, -1]
		].sort(() => Math.random() - 0.5);
		
		for (const [dr, dc] of dirs) {
			const nr = r + dr;
			const nc = c + dc;
			
			if (nr >= 0 && nr < mazeRows && nc >= 0 && nc < mazeCols && !visited[nr][nc]) {
				// Carve through wall between cells
				setWall(grid, `${gridR + dr},${gridC + dc}`, false);
				carve(nr, nc);
			}
		}
	}
	
	// Start carving from top-left
	if (mazeRows > 0 && mazeCols > 0) {
		carve(0, 0);
	}

	// Make sure we have some openings if we couldn't fit the exact size
	for (let r = 1; r < rows - 1; r += 2) {
		for (let c = 1; c < cols - 1; c += 2) {
			setWall(grid, `${r},${c}`, false);
		}
	}

	// Set start and goal in valid positions (top-left, bottom-right)
	const startR = 1;
	const startC = 1;
	const goalR = (mazeRows - 1) * 2 + 1 > 0 ? (mazeRows - 1) * 2 + 1 : rows - 2;
	const goalC = (mazeCols - 1) * 2 + 1 > 0 ? (mazeCols - 1) * 2 + 1 : cols - 2;
	
	const startId = `${startR},${startC}`;
	const goalId = `${goalR},${goalC}`;
	
	// Ensure start and goal are walkable
	setWall(grid, startId, false);
	setWall(grid, goalId, false);
	
	setStart(grid, startId);
	setGoal(grid, goalId);

	return grid;
}
