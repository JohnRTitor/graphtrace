import type { GameSearchAlgorithm } from './types';
import { minimax } from './minimax';
import { alphabeta } from './alphabeta';

export const gameSearchAlgorithms: Record<string, GameSearchAlgorithm> = {
	minimax,
	alphabeta
};

export function getGameSearchAlgorithm(id: string): GameSearchAlgorithm | undefined {
	return gameSearchAlgorithms[id];
}

export * from './types';
export { minimax } from './minimax';
export { alphabeta } from './alphabeta';
export { runSearch } from './search-core';
export { SearchTrace, extractPrincipalVariation } from './search-trace';
