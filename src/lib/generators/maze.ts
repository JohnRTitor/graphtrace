import { createGrid, setStart, setGoal, setWall } from '../graph/grid';
import type { Grid } from '../graph/types';
import { PRNG } from '../utils/random';
import type { GeneratorOptions } from './types';

export function generatePerfectMaze(rows: number, cols: number, options: GeneratorOptions): Grid {
	rows = Math.max(3, Math.min(1000, Math.floor(Number.isFinite(rows) ? rows : 3)));
	cols = Math.max(3, Math.min(1000, Math.floor(Number.isFinite(cols) ? cols : 3)));
	const grid = createGrid(rows, cols);
	const prng = new PRNG(options.seed);
	
	// Start with all walls
	for (const node of grid.nodes.values()) {
		setWall(grid, node.id, false);
	}

	// Maze dimensions: odd coordinates are cells, even coordinates are walls.
	// E.g., for 31x41, max cell is r=29, c=39.
	// r must be odd: 1, 3, 5... rows-2 (if rows is odd) or rows-3 (if rows is even).
	const mazeRows = Math.floor((rows - 1) / 2);
	const mazeCols = Math.floor((cols - 1) / 2);
	
	const visited = Array(mazeRows).fill(false).map(() => Array(mazeCols).fill(false));
	
	// Stack for iterative DFS: stores [r, c] (maze coordinates, not grid coordinates)
	const stack: [number, number][] = [];
	
	if (mazeRows > 0 && mazeCols > 0) {
		// Start carving from top-left cell
		stack.push([0, 0]);
		visited[0][0] = true;
		
		// Map maze coord to grid coord
		setWall(grid, `1,1`, true);
	}

	const dirs = [
		[-1, 0], [0, 1], [1, 0], [0, -1]
	];
	
	while (stack.length > 0) {
		const [r, c] = stack[stack.length - 1];
		
		// Find unvisited neighbors
		const unvisitedNeighbors: [number, number, number, number][] = []; // [nr, nc, dr, dc]
		
		for (const [dr, dc] of dirs) {
			const nr = r + dr;
			const nc = c + dc;
			if (nr >= 0 && nr < mazeRows && nc >= 0 && nc < mazeCols && !visited[nr][nc]) {
				unvisitedNeighbors.push([nr, nc, dr, dc]);
			}
		}
		
		if (unvisitedNeighbors.length > 0) {
			// Choose a random unvisited neighbor
			const [nr, nc, dr, dc] = unvisitedNeighbors[prng.nextInt(0, unvisitedNeighbors.length)];
			
			// Map logical maze coord to actual grid coord (offset by 1 to have outer wall)
			const currentGridR = r * 2 + 1;
			const currentGridC = c * 2 + 1;
			
			// Carve the wall between current and neighbor
			setWall(grid, `${currentGridR + dr},${currentGridC + dc}`, true);
			
			// Mark neighbor as visited and walkable
			visited[nr][nc] = true;
			const neighborGridR = nr * 2 + 1;
			const neighborGridC = nc * 2 + 1;
			setWall(grid, `${neighborGridR},${neighborGridC}`, true);
			
			// Push neighbor to stack
			stack.push([nr, nc]);
		} else {
			// Backtrack
			stack.pop();
		}
	}

	// Set start and goal in valid positions (top-left, bottom-right)
	const startR = 1;
	const startC = 1;
	// Calculate the furthest odd coordinates for the goal
	const goalR = (mazeRows - 1) * 2 + 1 > 0 ? (mazeRows - 1) * 2 + 1 : rows - 2;
	const goalC = (mazeCols - 1) * 2 + 1 > 0 ? (mazeCols - 1) * 2 + 1 : cols - 2;
	
	const startId = `${startR},${startC}`;
	const goalId = `${goalR},${goalC}`;
	
	// Ensure start and goal are walkable (they should be already if mazeRows/Cols > 0, but fallback safety)
	setWall(grid, startId, true);
	setWall(grid, goalId, true);
	
	setStart(grid, startId);
	setGoal(grid, goalId);

	return grid;
}

export function generateBraidedMaze(rows: number, cols: number, options: GeneratorOptions): Grid {
	// First generate a perfect maze
	const grid = generatePerfectMaze(rows, cols, options);
	const prng = new PRNG(options.seed);
	
	const requestedLoopDensity = options.loopDensity ?? 10;
	const loopDensity = Math.max(0, Math.min(1, (Number.isFinite(requestedLoopDensity) ? requestedLoopDensity : 10) / 100));
	
	// A perfect maze has walls on even rows/cols that separate odd rows/cols.
	// To create loops, we randomly remove some of these internal walls.
	
	// Collect internal walls that separate two walkable cells.
	const internalWalls: string[] = [];
	
	for (let r = 1; r < rows - 1; r++) {
		for (let c = 1; c < cols - 1; c++) {
			const node = grid.nodes.get(`${r},${c}`);
			if (node && !node.walkable) {
				// Check if it separates two walkable cells horizontally or vertically
				const up = grid.nodes.get(`${r - 1},${c}`);
				const down = grid.nodes.get(`${r + 1},${c}`);
				const left = grid.nodes.get(`${r},${c - 1}`);
				const right = grid.nodes.get(`${r},${c + 1}`);
				
				const separatesVertical = up && down && up.walkable && down.walkable;
				const separatesHorizontal = left && right && left.walkable && right.walkable;
				
				// Exclude intersections (even r, even c) to keep clean corridors
				// (We only want to remove walls between two corridor cells)
				if ((r % 2 === 0 && c % 2 !== 0 && separatesVertical) || 
					(r % 2 !== 0 && c % 2 === 0 && separatesHorizontal)) {
					internalWalls.push(`${r},${c}`);
				}
			}
		}
	}
	
	// Shuffle walls to remove them randomly
	const shuffledWalls = prng.shuffle(internalWalls);
	const wallsToRemove = Math.floor(shuffledWalls.length * loopDensity);
	
	for (let i = 0; i < wallsToRemove; i++) {
		setWall(grid, shuffledWalls[i], true);
	}
	
	return grid;
}
