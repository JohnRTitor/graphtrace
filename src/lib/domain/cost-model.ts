import type { GridNode } from '../graph/types';
import type { GraphNode, GraphEdge } from '../graph/manual';

export interface CostModel {
	cellCost?(cell: GridNode): number;
	nodeCost?(node: GraphNode): number;
	edgeCost?(edge: GraphEdge): number;
	movementCost?(fromId: string, toId: string): number;
}

export const defaultGridCostModel: CostModel = {
	cellCost: (cell: GridNode) => cell.weight,
};

export const defaultGraphCostModel: CostModel = {
	nodeCost: (node: GraphNode) => node.cost ?? 0,
	edgeCost: (edge: GraphEdge) => edge.weight,
};
