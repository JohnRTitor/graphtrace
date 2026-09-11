import { describe, it, expect } from 'vitest';
import { defaultGridCostModel, defaultGraphCostModel } from '../cost-model';
import type { GridCell } from '../../graph/types';
import type { GraphNode, GraphEdge } from '../../graph/manual';

describe('CostModel', () => {
	it('defaultGridCostModel entering-cell-cost matches old neighbor.weight behavior', () => {
		const cell: GridCell = {
			id: '1,1',
			row: 1,
			col: 1,
			walkable: true,
			cost: 5
		};
		
		expect(defaultGridCostModel.cellCost?.(cell)).toBe(5);
	});

	it('defaultGraphCostModel edge weight is standard, node cost is additive and defaults to no-op', () => {
		const edge: GraphEdge = {
			id: 'e1',
			source: 'A',
			target: 'B',
			weight: 10, directed: false 
		};
		
		expect(defaultGraphCostModel.edgeCost?.(edge)).toBe(10);
		
		const nodeWithoutCost: GraphNode = {
			id: 'A',
			x: 0,
			y: 0,
			label: 'A'
		};
		expect(defaultGraphCostModel.nodeCost?.(nodeWithoutCost)).toBe(0);
		
		const nodeWithCost: GraphNode = {
			id: 'B',
			x: 10,
			y: 10,
			label: 'B',
			cost: 15
		};
		expect(defaultGraphCostModel.nodeCost?.(nodeWithCost)).toBe(15);
	});
});
