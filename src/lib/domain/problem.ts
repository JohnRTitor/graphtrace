import type { Grid } from '../graph/types';
import { cloneGrid } from '../graph/grid';
import { cloneManualGraph, type ManualGraph } from '../graph/manual';
import { cloneGameTree, type GameTree } from '../graph/game-tree';
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

/**
 * A game tree, owned by the adversarial family.
 *
 * `type` remains the discriminant across the whole `Problem` union, so the two
 * existing variants keep meaning "pathfinding" and every existing narrowing site
 * compiles and behaves unchanged. A family identifies its problems through
 * `matchProblem`, so registering a family never requires editing the existing
 * members of this union - only genuinely new problem shapes add variants.
 */
export type GameTreeProblem = {
	type: 'game-tree';
	family: 'adversarial';
	tree: GameTree;
	version: ProblemVersionId;
};

export type Problem = GridProblem | GraphProblem | GameTreeProblem;

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
	if (problem.type === 'graph') {
		return {
			type: 'graph',
			graph: cloneManualGraph(problem.graph, problem.costModel),
			costModel: problem.costModel,
			version: problem.version
		};
	}
	return {
		type: 'game-tree',
		family: problem.family,
		tree: cloneGameTree(problem.tree),
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
