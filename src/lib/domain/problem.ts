import type { Grid } from '../graph/types';
import type { ManualGraph } from '../graph/manual';

export type ProblemVersionId = string;

export type GridProblem = {
	type: 'grid';
	grid: Grid;
	version: ProblemVersionId;
};

export type GraphProblem = {
	type: 'graph';
	graph: ManualGraph;
	version: ProblemVersionId;
};

export type Problem = GridProblem | GraphProblem;

export function createProblemVersion(): ProblemVersionId {
	return crypto.randomUUID();
}
