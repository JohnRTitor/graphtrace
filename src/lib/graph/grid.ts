import type { Grid, GridCell, NodeId } from './types';

export function createGrid(rows: number, cols: number): Grid {
	const nodes = new Map<NodeId, GridCell>();
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
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
	return { rows, cols, nodes, start: null, goal: null };
}

export function setWall(grid: Grid, id: NodeId, walkable: boolean): void {
	const node = grid.nodes.get(id);
	if (node) {
		node.walkable = walkable;
	}
}

export function setCost(grid: Grid, id: NodeId, cost: number): void {
	const node = grid.nodes.get(id);
	if (node) {
		node.cost = cost;
	}
}

export function setStart(grid: Grid, id: NodeId | null): void {
	grid.start = id;
}

export function setGoal(grid: Grid, id: NodeId | null): void {
	grid.goal = id;
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
