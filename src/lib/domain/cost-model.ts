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
