import type { Algorithm } from './types';
import { bfs } from './bfs';
import { dfs } from './dfs';
import { astar } from './astar';

export const algorithms: Record<string, Algorithm> = {
	bfs,
	dfs,
	astar
};

export const algorithmList = Object.entries(algorithms).map(([id, algo]) => ({
	id,
	name: algo.name,
	description: algo.description,
	supportsWeights: algo.supportsWeights
}));

export function getAlgorithm(id: string): Algorithm | undefined {
	return algorithms[id];
}

export * from './types';
export * from './bfs';
export * from './dfs';
export * from './astar';
export * from './heap';
