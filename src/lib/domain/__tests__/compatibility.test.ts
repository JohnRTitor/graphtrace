import { describe, it, expect } from 'vitest';
import { checkCompatibility } from '../compatibility';
import { createGrid } from '../../graph/grid';
import { ManualGraph } from '../../graph/manual';
import { defaultGridCostModel, defaultGraphCostModel } from '../cost-model';
import { defaultMovementModel } from '../movement-model';
import type { GridProblem, GraphProblem } from '../problem';

describe('checkCompatibility', () => {
	it('returns no warnings for unweighted grid with BFS', () => {
		const grid = createGrid(5, 5);
		const problem: GridProblem = {
			type: 'grid',
			grid,
			movementModel: defaultMovementModel,
			costModel: defaultGridCostModel,
			version: '1'
		};
		const warnings = checkCompatibility(problem, 'bfs');
		expect(warnings).toHaveLength(0);
	});

	it('returns warning for weighted grid with BFS', () => {
		const grid = createGrid(5, 5);
		const node = grid.nodes.get('2,2')!;
		node.cost = 5;
		const problem: GridProblem = {
			type: 'grid',
			grid,
			movementModel: defaultMovementModel,
			costModel: defaultGridCostModel,
			version: '1'
		};
		const warnings = checkCompatibility(problem, 'bfs');
		expect(warnings).toHaveLength(1);
		expect(warnings[0].type).toBe('ignores-weights');
	});

	it('returns warning for manual graph with A*', () => {
		const graph = new ManualGraph();
		const problem: GraphProblem = {
			type: 'graph',
			graph,
			costModel: defaultGraphCostModel,
			version: '1'
		};
		const warnings = checkCompatibility(problem, 'astar');
		expect(warnings).toHaveLength(1);
		expect(warnings[0].type).toBe('no-heuristic');
	});

	it('returns multiple warnings if applicable (e.g., weighted graph + BFS)', () => {
		const graph = new ManualGraph();
		graph.execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		graph.execute({ type: 'add-node', node: { id: 'B', x: 10, y: 10, label: 'B' } });
		graph.execute({ type: 'add-edge', edge: { id: 'e1', source: 'A', target: 'B', weight: 5, directed: false  } });
		const problem: GraphProblem = {
			type: 'graph',
			graph,
			costModel: defaultGraphCostModel,
			version: '1'
		};
		const warnings = checkCompatibility(problem, 'bfs');
		expect(warnings).toHaveLength(1);
		expect(warnings[0].type).toBe('ignores-weights');
	});
});
