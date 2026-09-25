import type { Problem } from './problem';
import type { AlgorithmEvent, AlgorithmMetrics, AlgorithmResult } from '../algorithms/types';

export type ExecutionId = string;

export type Execution = {
	id: ExecutionId;
	problemSnapshot: Problem;
	algorithmId: string;
	algorithmConfig?: any; // For future when algorithms have configurable params
	seed?: number;
	trace: AlgorithmEvent[];
	metrics: AlgorithmMetrics;
	result: AlgorithmResult;
	createdAt: number;
};
