import type { BaseGraph, NodeId } from '../graph/types';

export type AlgorithmEvent =
	| { type: 'start'; node: NodeId }
	| { type: 'discover'; node: NodeId; from?: NodeId; edge?: string }
	| { type: 'expand'; node: NodeId }
	| { type: 'update'; node: NodeId; parent?: NodeId; edge?: string; g?: number; h?: number; f?: number }
	| { type: 'skip'; node: NodeId }
	| { type: 'path'; nodes: NodeId[]; edges?: string[] }
	| { type: 'no-path' }
	| { type: 'finish'; found: boolean };

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
	run(graph: BaseGraph, start: NodeId, goal: NodeId): AlgorithmResult;
};
