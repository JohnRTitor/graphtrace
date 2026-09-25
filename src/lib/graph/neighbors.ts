import type { Grid, GridCell, NodeId } from './types';
import { type MovementModel, getMovementOffsets } from '../domain/movement-model';

export function getNeighbors(grid: Grid, nodeId: NodeId, movementModel?: MovementModel): GridCell[] {
	const node = grid.nodes.get(nodeId);
	if (!node) return [];

	const neighbors: GridCell[] = [];
	const offsets = getMovementOffsets(movementModel);

	for (const [dr, dc] of offsets) {
		const r = node.row + dr;
		const c = node.col + dc;

		if (r >= 0 && r < grid.rows && c >= 0 && c < grid.cols) {
			const neighborId = `${r},${c}`;
			const neighbor = grid.nodes.get(neighborId);
			if (neighbor && neighbor.walkable) {
				const isDiagonal = Math.abs(dr) === 1 && Math.abs(dc) === 1;

				if (isDiagonal && movementModel?.blockCornerCutting) {
					const adj1 = grid.nodes.get(`${node.row + dr},${node.col}`);
					const adj2 = grid.nodes.get(`${node.row},${node.col + dc}`);
					if ((adj1 && !adj1.walkable) || (adj2 && !adj2.walkable)) {
						continue;
					}
				}

				neighbors.push(neighbor);
			}
		}
	}

	return neighbors;
}
