import { describe, it, expect } from 'vitest';
import { astar } from '../astar';
import { createGrid, setStart, setGoal, setWall, setCost } from '../../graph/grid';
import { GridAdapter } from '../../graph/graph-adapter';
import { ManualGraph } from '../../graph/manual';
import type { CostModel } from '../../domain/cost-model';

describe('A* Algorithm', () => {
	it('should find the shortest path in an empty grid', () => {
		const grid = createGrid(5, 5);
		setStart(grid, '0,0');
		setGoal(grid, '4,4');
		
		const adapter = new GridAdapter(grid);
		const result = astar.run(adapter, grid.start!, grid.goal!);
		
		expect(result.metrics.pathLength).toBe(9);
		expect(result.metrics.pathCost).toBe(8); 
		expect(result.events.length).toBeGreaterThan(0);
	});

	it('should prefer lower cost paths with weights', () => {
		const grid = createGrid(3, 3);
		setStart(grid, '0,0');
		setGoal(grid, '0,2');
		
		// Direct path has high weight
		setCost(grid, '0,1', 10);
		
		const adapter = new GridAdapter(grid);
		const result = astar.run(adapter, grid.start!, grid.goal!);
		
		// Should go around (0,0 -> 1,0 -> 1,1 -> 1,2 -> 0,2) cost = 4
		expect(result.metrics.pathLength).toBe(5);
		expect(result.metrics.pathCost).toBe(4);
	});

	it('should work on a manual graph with heuristics', () => {
		const graph = new ManualGraph();
		graph.execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
		graph.execute({ type: 'add-node', node: { id: 'B', x: 10, y: 0, label: 'B' } });
		graph.execute({ type: 'add-node', node: { id: 'C', x: 20, y: 0, label: 'C' } });
		
		graph.execute({ type: 'add-edge', edge: { id: 'e1', source: 'A', target: 'B', weight: 5, directed: false  } });
		graph.execute({ type: 'add-edge', edge: { id: 'e2', source: 'B', target: 'C', weight: 5, directed: false  } });
		graph.execute({ type: 'add-edge', edge: { id: 'e3', source: 'A', target: 'C', weight: 15, directed: false  } });
		
		const result = astar.run(graph, 'A', 'C');
		expect(result.metrics.pathLength).toBe(3);
		expect(result.metrics.pathCost).toBe(10); // A -> B -> C is 10, A -> C is 15
	});

	it('charges entered node costs without charging the start node', () => {
		const costModel: CostModel = {
			edgeCost: (edge) => edge.weight,
			nodeCost: (node) => node.cost ?? 0
		};
		const graph = new ManualGraph(costModel);
		graph.execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A', cost: 100 } });
		graph.execute({ type: 'add-node', node: { id: 'B', x: 10, y: 0, label: 'B', cost: 3 } });
		graph.execute({ type: 'add-node', node: { id: 'C', x: 20, y: 0, label: 'C', cost: 4 } });
		graph.execute({ type: 'add-edge', edge: { id: 'ab', source: 'A', target: 'B', weight: 2, directed: true } });
		graph.execute({ type: 'add-edge', edge: { id: 'bc', source: 'B', target: 'C', weight: 3, directed: true } });

		const result = astar.run(graph, 'A', 'C');

		expect(result.metrics.pathCost).toBe(12);
		expect(result.metrics.pathLength).toBe(3);
	});

	it('reports a one-node zero-cost path when start equals goal', () => {
		const graph = new ManualGraph({ nodeCost: () => 100 });
		graph.execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A', cost: 100 } });

		const result = astar.run(graph, 'A', 'A');

		expect(result.metrics.pathLength).toBe(1);
		expect(result.metrics.pathCost).toBe(0);
	});

	it('measures maximum frontier size by unique pending nodes', () => {
		const graph = new ManualGraph();
		for (const id of ['S', 'A', 'B', 'C']) {
			graph.execute({ type: 'add-node', node: { id, x: 0, y: 0, label: id } });
		}

		const edges = [
			['SA', 'S', 'A', 1],
			['SB', 'S', 'B', 1],
			['AC-expensive', 'A', 'C', 10],
			['AC-cheap', 'A', 'C', 1]
		] as const;
		for (const [id, source, target, weight] of edges) {
			graph.execute({ type: 'add-edge', edge: { id, source, target, weight, directed: true } });
		}

		const result = astar.run(graph, 'S', 'C');

		expect(result.metrics.maxFrontierSize).toBe(2);
	});
});
