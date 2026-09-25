import type { Algorithm, AlgorithmSummary } from './types';
import { bfs } from './bfs';
import { dfs } from './dfs';
import { astar } from './astar';
import { gameSearchAlgorithms } from './adversarial';

/** Pathfinding-family algorithms. Ids are referenced by the family registry. */
export const algorithms: Record<string, Algorithm> = {
	bfs,
	dfs,
	astar
};

export function getAlgorithm(id: string): Algorithm | undefined {
	return algorithms[id];
}

/**
 * Every algorithm across every family, in one flat map with a uniform summary
 * shape. The command palette groups these by `familyId`; nothing else in the app
 * needs to know which family an algorithm belongs to.
 */
export function allAlgorithmSummaries(): AlgorithmSummary[] {
	const pathfinding: AlgorithmSummary[] = Object.entries(algorithms).map(([id, algo]) => ({
		id,
		name: algo.name,
		description: algo.description,
		complexity: algo.complexity,
		properties: algo.properties,
		supportsWeights: algo.supportsWeights,
		supportsPruning: false,
		familyId: 'pathfinding'
	}));

	const adversarial: AlgorithmSummary[] = Object.values(gameSearchAlgorithms).map((algo) => ({
		id: algo.id,
		name: algo.name,
		description: algo.description,
		complexity: algo.complexity,
		properties: algo.properties,
		// A game tree has no edge weights; "weights" here means leaf utilities.
		supportsWeights: true,
		supportsPruning: algo.supportsPruning,
		familyId: 'adversarial'
	}));

	return [...pathfinding, ...adversarial];
}

const summaryCache = new Map<string, AlgorithmSummary>();

/** Memoised single-algorithm summary lookup, for palette rendering. */
export function getAlgorithmSummary(id: string): AlgorithmSummary | undefined {
	const cached = summaryCache.get(id);
	if (cached) return cached;
	const found = allAlgorithmSummaries().find((summary) => summary.id === id);
	if (found) summaryCache.set(id, found);
	return found;
}

export * from './types';
export * from './bfs';
export * from './dfs';
export * from './astar';
export * from './heap';
export * from './adversarial';
