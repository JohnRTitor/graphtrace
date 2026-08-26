import type { BaseGraph, BaseGraphEdge, BaseGraphNode, Grid, NodeId } from './types';

// For 4-directional movement in grid
const DIRECTIONS_4 = [
	[-1, 0], // Up
	[0, 1],  // Right
	[1, 0],  // Down
	[0, -1]  // Left
];

export class GridAdapter implements BaseGraph {
	constructor(private grid: Grid) {}

	getNode(id: NodeId): BaseGraphNode | undefined {
		const node = this.grid.nodes.get(id);
		return node ? { id: node.id } : undefined;
	}

	getNeighbors(id: NodeId): BaseGraphEdge[] {
		const node = this.grid.nodes.get(id);
		if (!node) return [];

		const edges: BaseGraphEdge[] = [];

		for (const [dr, dc] of DIRECTIONS_4) {
			const r = node.row + dr;
			const c = node.col + dc;

			if (r >= 0 && r < this.grid.rows && c >= 0 && c < this.grid.cols) {
				const neighborId = `${r},${c}`;
				const neighbor = this.grid.nodes.get(neighborId);
				if (neighbor && neighbor.walkable) {
					edges.push({ target: neighborId, weight: neighbor.weight });
				}
			}
		}

		return edges;
	}

	getHeuristic(nodeA: NodeId, nodeB: NodeId): number {
		const [r1, c1] = nodeA.split(',').map(Number);
		const [r2, c2] = nodeB.split(',').map(Number);
		return Math.abs(r1 - r2) + Math.abs(c1 - c2); // Manhattan distance
	}

	getStart(): NodeId | null {
		return this.grid.start;
	}

	getGoal(): NodeId | null {
		return this.grid.goal;
	}
}
