import type { Grid, GridNode, NodeId } from './types';

// For 4-directional movement
const DIRECTIONS_4 = [
	[-1, 0], // Up
	[0, 1],  // Right
	[1, 0],  // Down
	[0, -1]  // Left
];

export function getNeighbors(grid: Grid, nodeId: NodeId): GridNode[] {
	const node = grid.nodes.get(nodeId);
	if (!node) return [];

	const neighbors: GridNode[] = [];

	for (const [dr, dc] of DIRECTIONS_4) {
		const r = node.row + dr;
		const c = node.col + dc;

		if (r >= 0 && r < grid.rows && c >= 0 && c < grid.cols) {
			const neighborId = `${r},${c}`;
			const neighbor = grid.nodes.get(neighborId);
			if (neighbor && neighbor.walkable) {
				neighbors.push(neighbor);
			}
		}
	}

	return neighbors;
}
