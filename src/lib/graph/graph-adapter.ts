import type { BaseGraph, BaseGraphEdge, BaseGraphNode, Grid, NodeId } from './types';
import { type MovementModel, getMovementOffsets } from '../domain/movement-model';
import { type CostModel, defaultGridCostModel } from '../domain/cost-model';

export class GridAdapter implements BaseGraph {
	private readonly minimumCellCost: number;

	constructor(
		private grid: Grid,
		private movementModel?: MovementModel,
		private costModel: CostModel = defaultGridCostModel
	) {
		this.minimumCellCost = this.computeMinimumCellCost();
	}

	getNode(id: NodeId): BaseGraphNode | undefined {
		const node = this.grid.nodes.get(id);
		return node ? { id: node.id } : undefined;
	}

	getNeighbors(id: NodeId): BaseGraphEdge[] {
		const node = this.grid.nodes.get(id);
		if (!node) return [];

		const edges: BaseGraphEdge[] = [];
		const offsets = getMovementOffsets(this.movementModel);
		const diagonalMultiplier = this.getDiagonalMultiplier();

		for (const [dr, dc] of offsets) {
			const r = node.row + dr;
			const c = node.col + dc;

			if (r >= 0 && r < this.grid.rows && c >= 0 && c < this.grid.cols) {
				const neighborId = `${r},${c}`;
				const neighbor = this.grid.nodes.get(neighborId);

				if (neighbor && neighbor.walkable) {
					const isDiagonal = Math.abs(dr) === 1 && Math.abs(dc) === 1;

					if (isDiagonal && this.movementModel?.blockCornerCutting) {
						const adj1 = this.grid.nodes.get(`${node.row + dr},${node.col}`);
						const adj2 = this.grid.nodes.get(`${node.row},${node.col + dc}`);
						if ((adj1 && !adj1.walkable) || (adj2 && !adj2.walkable)) {
							continue;
						}
					}

					let cost = this.costModel.cellCost?.(neighbor) ?? neighbor.cost;
					if (isDiagonal) {
						cost *= diagonalMultiplier;
					}
					if (!Number.isFinite(cost) || cost < 0) continue;

					edges.push({ target: neighborId, weight: cost });
				}
			}
		}

		return edges;
	}

	getHeuristic(nodeA: NodeId, nodeB: NodeId): number {
		const [r1, c1] = nodeA.split(',').map(Number);
		const [r2, c2] = nodeB.split(',').map(Number);
		if (![r1, c1, r2, c2].every(Number.isFinite)) return 0;

		const dr = Math.abs(r1 - r2);
		const dc = Math.abs(c1 - c2);
		const minimumCost = this.minimumCellCost;
		if (this.movementModel?.type === 'eightWay') {
			const diagonalMultiplier = this.getDiagonalMultiplier();
			return minimumCost * (Math.min(dr, dc) * diagonalMultiplier + Math.abs(dr - dc));
		}

		return minimumCost * (dr + dc);
	}

	private getDiagonalMultiplier(): number {
		const multiplier = this.movementModel?.diagonalCostMultiplier;
		return multiplier !== undefined && Number.isFinite(multiplier) && multiplier >= 0 ? multiplier : 1;
	}

	private computeMinimumCellCost(): number {
		let minimum = Infinity;
		for (const cell of this.grid.nodes.values()) {
			if (!cell.walkable) continue;
			const cost = this.costModel.cellCost?.(cell) ?? cell.cost;
			if (Number.isFinite(cost) && cost >= 0) {
				minimum = Math.min(minimum, cost);
			}
		}
		return Number.isFinite(minimum) ? minimum : 1;
	}

	getStart(): NodeId | null {
		return this.grid.start;
	}

	getGoal(): NodeId | null {
		return this.grid.goal;
	}
}
