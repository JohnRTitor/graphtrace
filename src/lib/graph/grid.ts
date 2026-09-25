import type { Grid, GridCell, NodeId } from './types';

function normalizeDimension(value: number): number {
	return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function isValidCost(cost: number): boolean {
	return Number.isFinite(cost) && cost >= 0;
}

export function createGrid(rows: number, cols: number): Grid {
	const safeRows = normalizeDimension(rows);
	const safeCols = normalizeDimension(cols);
	const nodes = new Map<NodeId, GridCell>();
	for (let r = 0; r < safeRows; r++) {
		for (let c = 0; c < safeCols; c++) {
			const id = `${r},${c}`;
			nodes.set(id, {
				id,
				row: r,
				col: c,
				walkable: true,
				cost: 1
			});
		}
	}
	return { rows: safeRows, cols: safeCols, nodes, start: null, goal: null };
}

export function setWall(grid: Grid, id: NodeId, walkable: boolean): void {
	const node = grid.nodes.get(id);
	if (node) {
		node.walkable = walkable;
	}
}

export function setCost(grid: Grid, id: NodeId, cost: number): void {
	const node = grid.nodes.get(id);
	if (node && isValidCost(cost)) {
		node.cost = cost;
	}
}

export function setStart(grid: Grid, id: NodeId | null): void {
	if (id === null) {
		grid.start = null;
		return;
	}
	const node = grid.nodes.get(id);
	if (node?.walkable) {
		grid.start = id;
	}
}

export function setGoal(grid: Grid, id: NodeId | null): void {
	if (id === null) {
		grid.goal = null;
		return;
	}
	const node = grid.nodes.get(id);
	if (node?.walkable) {
		grid.goal = id;
	}
}

export function getNode(grid: Grid, id: NodeId): GridCell | undefined {
	return grid.nodes.get(id);
}

export function clearGrid(grid: Grid): void {
	for (const node of grid.nodes.values()) {
		node.walkable = true;
		node.cost = 1;
	}
}
