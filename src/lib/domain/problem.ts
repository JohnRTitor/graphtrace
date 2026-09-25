import type { Grid } from '../graph/types';
import { cloneGrid } from '../graph/grid';
import { cloneManualGraph, type ManualGraph } from '../graph/manual';
import type { CostModel } from './cost-model';
import type { MovementModel } from './movement-model';

export type ProblemVersionId = string;

export type GridProblem = {
	type: 'grid';
	grid: Grid;
	movementModel: MovementModel;
	costModel: CostModel;
	version: ProblemVersionId;
};

export type GraphProblem = {
	type: 'graph';
	graph: ManualGraph;
	costModel: CostModel;
	version: ProblemVersionId;
};

export type Problem = GridProblem | GraphProblem;

export function cloneProblem(problem: Problem): Problem {
	if (problem.type === 'grid') {
		return {
			type: 'grid',
			grid: cloneGrid(problem.grid),
			movementModel: { ...problem.movementModel },
			costModel: problem.costModel,
			version: problem.version
		};
	}
	return {
		type: 'graph',
		graph: cloneManualGraph(problem.graph, problem.costModel),
		costModel: problem.costModel,
		version: problem.version
	};
}

let fallbackVersion = 0;

export function createProblemVersion(): ProblemVersionId {
	if (typeof globalThis.crypto?.randomUUID === 'function') {
		return globalThis.crypto.randomUUID();
	}
	fallbackVersion++;
	return `problem-${Date.now()}-${fallbackVersion}`;
}
