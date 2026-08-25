import { createGrid, setWall, setWeight, setStart, setGoal, clearGrid, getNode } from '../graph/grid';
import type { Grid, NodeId } from '../graph/types';

export class GridState {
	// Use Svelte 5 runes for reactive state
	// We wrap the Grid object to trigger reactivity when it changes entirely,
	// but we'll also provide a version counter to trigger reactivity on deep mutations
	// since Map mutations don't automatically trigger Svelte reactivity.
	
	private _grid = $state<Grid>(createGrid(30, 40));
	private _version = $state(0);
	
	constructor() {
		// Default start and goal for 30x40
		this.resetToDefaults(30, 40);
	}
	
	get grid(): Grid {
		// Accessing _version registers it as a dependency for anything reading the grid
		this._version;
		return this._grid;
	}
	
	get rows(): number {
		return this._grid.rows;
	}
	
	get cols(): number {
		return this._grid.cols;
	}
	
	get start(): NodeId | null {
		this._version;
		return this._grid.start;
	}
	
	get goal(): NodeId | null {
		this._version;
		return this._grid.goal;
	}

	resize(rows: number, cols: number): void {
		this._grid = createGrid(rows, cols);
		this.resetToDefaults(rows, cols);
		this._version++;
	}

	clear(): void {
		clearGrid(this._grid);
		this._version++;
	}
	
	// Force replacing the grid (e.g. from a generator)
	replaceGrid(newGrid: Grid): void {
		this._grid = newGrid;
		this._version++;
	}

	toggleWall(id: NodeId): void {
		const node = getNode(this._grid, id);
		if (!node) return;
		
		// Don't place walls on start/goal
		if (id === this._grid.start || id === this._grid.goal) return;
		
		setWall(this._grid, id, !node.walkable);
		this._version++;
	}

	setWall(id: NodeId, isWall: boolean): void {
		// Don't place walls on start/goal
		if (isWall && (id === this._grid.start || id === this._grid.goal)) return;
		
		setWall(this._grid, id, !isWall);
		this._version++;
	}
	
	setWeight(id: NodeId, weight: number): void {
		// Don't weight start/goal
		if (id === this._grid.start || id === this._grid.goal) return;
		
		setWeight(this._grid, id, weight);
		this._version++;
	}

	setStart(id: NodeId): void {
		const node = getNode(this._grid, id);
		if (!node) return;
		
		// Ensure it's walkable
		if (!node.walkable) {
			setWall(this._grid, id, true);
		}
		
		setStart(this._grid, id);
		this._version++;
	}

	setGoal(id: NodeId): void {
		const node = getNode(this._grid, id);
		if (!node) return;
		
		// Ensure it's walkable
		if (!node.walkable) {
			setWall(this._grid, id, true);
		}
		
		setGoal(this._grid, id);
		this._version++;
	}
	
	private resetToDefaults(rows: number, cols: number): void {
		// Set default start at 1/4 width, half height
		// Set default goal at 3/4 width, half height
		const startR = Math.floor(rows / 2);
		const startC = Math.floor(cols / 4);
		const goalR = Math.floor(rows / 2);
		const goalC = Math.floor((cols * 3) / 4);
		
		setStart(this._grid, `${startR},${startC}`);
		setGoal(this._grid, `${goalR},${goalC}`);
	}
}

// Global singleton for the app
export const gridState = new GridState();
