import type { Problem } from './problem';
import { getAlgorithm } from '../algorithms/index';
import { getGraphEntryCost } from './cost-model';

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
				message: `${algo.name} ignores cell, node, and edge costs and finds paths based only on the number of steps.`
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
		for (const node of problem.grid.nodes.values()) {
			if (node.walkable && (problem.costModel.cellCost?.(node) ?? node.cost) !== 1) {
				return true;
			}
		}
		return problem.movementModel.type === 'eightWay' &&
			problem.movementModel.diagonalCostMultiplier !== undefined &&
			problem.movementModel.diagonalCostMultiplier !== 1;
	} else if (problem.type === 'graph') {
		for (const edge of problem.graph.edges.values()) {
			const source = problem.graph.nodes.get(edge.source);
			const target = problem.graph.nodes.get(edge.target);
			if (!source || !target) continue;

			if (getGraphEntryCost(problem.costModel, source.id, edge, target) !== 1) {
				return true;
			}
			if (
				!edge.directed &&
				getGraphEntryCost(problem.costModel, target.id, edge, source) !== 1
			) {
				return true;
			}
		}
		if (!problem.costModel.movementCost) {
			for (const node of problem.graph.nodes.values()) {
				if ((problem.costModel.nodeCost?.(node) ?? 0) !== 0) {
					return true;
				}
			}
		}
		return false;
	}
	return false;
}
