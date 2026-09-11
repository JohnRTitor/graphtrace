import type { BaseGraph, BaseGraphEdge, BaseGraphNode, Grid, NodeId } from './types';
import { type MovementModel, getMovementOffsets } from '../domain/movement-model';
import { type CostModel, defaultGridCostModel } from '../domain/cost-model';

export class GridAdapter implements BaseGraph {
	constructor(
		private grid: Grid,
		private movementModel?: MovementModel,
		private costModel: CostModel = defaultGridCostModel
	) {}

	getNode(id: NodeId): BaseGraphNode | undefined {
		const node = this.grid.nodes.get(id);
		return node ? { id: node.id } : undefined;
	}

	getNeighbors(id: NodeId): BaseGraphEdge[] {
		const node = this.grid.nodes.get(id);
		if (!node) return [];

		const edges: BaseGraphEdge[] = [];
		const offsets = getMovementOffsets(this.movementModel);

		for (const [dr, dc] of offsets) {
			const r = node.row + dr;
			const c = node.col + dc;

			if (r >= 0 && r < this.grid.rows && c >= 0 && c < this.grid.cols) {
				const neighborId = `${r},${c}`;
				const neighbor = this.grid.nodes.get(neighborId);
				
				if (neighbor && neighbor.walkable) {
					const isDiagonal = Math.abs(dr) === 1 && Math.abs(dc) === 1;
					
					// Block corner cutting
					if (isDiagonal && !this.movementModel?.blockCornerCutting) {
						const adj1 = this.grid.nodes.get(`${node.row + dr},${node.col}`);
						const adj2 = this.grid.nodes.get(`${node.row},${node.col + dc}`);
						if ((adj1 && !adj1.walkable) || (adj2 && !adj2.walkable)) {
							continue;
						}
					}
					
					let cost = this.costModel.cellCost?.(neighbor) ?? neighbor.weight;
					
					if (isDiagonal && this.movementModel?.diagonalCostMultiplier) {
						cost *= this.movementModel.diagonalCostMultiplier;
					}
					
					edges.push({ target: neighborId, weight: cost });
				}
			}
		}

		return edges;
	}

	getHeuristic(nodeA: NodeId, nodeB: NodeId): number {
		const [r1, c1] = nodeA.split(',').map(Number);
		const [r2, c2] = nodeB.split(',').map(Number);
		
		const dr = Math.abs(r1 - r2);
		const dc = Math.abs(c1 - c2);
		
		if (this.movementModel?.type === 'eightWay') {
			// Chebyshev distance or octile distance
			const diagCost = this.movementModel.diagonalCostMultiplier ?? 1;
			return Math.max(dr, dc) + (diagCost - 1) * Math.min(dr, dc);
		}
		
		return dr + dc; // Manhattan distance
	}

	getStart(): NodeId | null {
		return this.grid.start;
	}

	getGoal(): NodeId | null {
		return this.grid.goal;
	}
}
