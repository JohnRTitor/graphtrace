import type { BaseGraph, NodeId } from '../graph/types';
import type { AlgorithmComplexity, AlgorithmProperties } from './adversarial/types';

export type AlgorithmEvent =
	| { type: 'start'; node: NodeId }
	| { type: 'discover'; node: NodeId; from?: NodeId; edge?: string }
	| { type: 'expand'; node: NodeId }
	| { type: 'update'; node: NodeId; parent?: NodeId; edge?: string; g?: number; h?: number; f?: number }
	| { type: 'skip'; node: NodeId }
	| { type: 'path'; nodes: NodeId[]; edges?: string[] }
	| { type: 'no-path' }
	| { type: 'finish'; found: boolean };

/** Discriminators of the pathfinding family's event vocabulary. */
export const pathfindingEventKinds = [
	'start',
	'discover',
	'expand',
	'update',
	'skip',
	'path',
	'no-path',
	'finish'
] as const;

export type PathfindingEventKind = (typeof pathfindingEventKinds)[number];

export type AlgorithmMetrics = {
	nodesDiscovered: number;
	nodesExpanded: number;
	maxFrontierSize: number;
	pathLength: number;
	pathCost: number;
	executionTimeMs: number;
};

export type AlgorithmResult = {
	events: AlgorithmEvent[];
	metrics: AlgorithmMetrics;
};

export type Algorithm = {
	name: string;
	description: string;
	supportsWeights: boolean;
	complexity: AlgorithmComplexity;
	properties: AlgorithmProperties;
	run(graph: BaseGraph, start: NodeId, goal: NodeId): AlgorithmResult;
};

/**
 * The palette-facing view of an algorithm, shared by both families so the
 * command palette can list pathfinding and adversarial algorithms with the same
 * complexity and property badges.
 */
export type AlgorithmSummary = {
	id: string;
	name: string;
	description: string;
	complexity: AlgorithmComplexity;
	properties: AlgorithmProperties;
	/** Whether the algorithm can use weighted edges / utilities. */
	supportsWeights: boolean;
	/** Whether the search can prune branches, which drives the comparison demo. */
	supportsPruning: boolean;
	familyId: string;
};
