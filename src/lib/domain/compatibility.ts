import type { Problem } from './problem';
import { getAlgorithm } from '../algorithms/index';

export type CompatibilityWarningType = 'ignores-weights' | 'no-heuristic';

export interface CompatibilityWarning {
	type: CompatibilityWarningType;
	message: string;
}

export function checkCompatibility(problem: Problem, algorithmId: string): CompatibilityWarning[] {
	const warnings: CompatibilityWarning[] = [];
	const algo = getAlgorithm(algorithmId);
	if (!algo) return warnings;

	// Check for ignored weights
	if (!algo.supportsWeights) {
		const isWeighted = isProblemWeighted(problem);
		if (isWeighted) {
			warnings.push({
				type: 'ignores-weights',
				message: `${algo.name} ignores cell/edge costs and finds paths based only on the number of steps.`
			});
		}
	}

	// Check for missing heuristic
	if (algorithmId === 'astar') {
		if (problem.type === 'graph') {
			warnings.push({
				type: 'no-heuristic',
				message: `No coordinate heuristic available for manual graphs — A* behaves identically to Dijkstra.`
			});
		}
	}

	return warnings;
}

function isProblemWeighted(problem: Problem): boolean {
	if (problem.type === 'grid') {
		// Check if any cell has a cost > 1
		for (const node of problem.grid.nodes.values()) {
			if (node.walkable && (problem.costModel.cellCost?.(node) ?? 1) > 1) {
				return true;
			}
		}
		return false;
	} else if (problem.type === 'graph') {
		// Check edges
		for (const edge of problem.graph.edges.values()) {
			if ((problem.costModel.edgeCost?.(edge) ?? 1) > 1) {
				return true;
			}
		}
		// Check nodes
		for (const node of problem.graph.nodes.values()) {
			if ((problem.costModel.nodeCost?.(node) ?? 0) > 0) { // Default additive cost is usually 0
				return true;
			}
		}
		return false;
	}
	return false;
}
