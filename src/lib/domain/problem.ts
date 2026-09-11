import type { Grid } from '../graph/types';
import type { ManualGraph } from '../graph/manual';
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

export function createProblemVersion(): ProblemVersionId {
	return crypto.randomUUID();
}
