import type { GridCell } from '../graph/types';
import type { GraphNode, GraphEdge } from '../graph/manual';

export interface CostModel {
	cellCost?(cell: GridCell): number;
	nodeCost?(node: GraphNode): number;
	edgeCost?(edge: GraphEdge): number;
	movementCost?(fromId: string, toId: string): number;
}

export const defaultGridCostModel: CostModel = {
	cellCost: (cell: GridCell) => cell.cost,
};

export const defaultGraphCostModel: CostModel = {
	nodeCost: (node: GraphNode) => node.cost ?? 0,
	edgeCost: (edge: GraphEdge) => edge.weight,
};

export function isValidCost(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function getGraphEntryCost(
	costModel: CostModel,
	fromId: string,
	edge: GraphEdge,
	enteredNode: GraphNode
): number {
	if (costModel.movementCost) {
		return costModel.movementCost(fromId, enteredNode.id);
	}

	const edgeCost = costModel.edgeCost?.(edge) ?? edge.weight;
	const nodeCost = costModel.nodeCost?.(enteredNode) ?? 0;
	return edgeCost + nodeCost;
}
