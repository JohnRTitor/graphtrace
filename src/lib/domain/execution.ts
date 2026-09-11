import type { ProblemVersionId } from './problem';
import type { AlgorithmEvent, AlgorithmMetrics, AlgorithmResult } from '../algorithms/types';

export type ExecutionId = string;

export type Execution = {
	id: ExecutionId;
	problemSnapshot: ProblemVersionId; // Points to the problem state at the time of execution
	algorithmId: string;
	algorithmConfig?: any; // For future when algorithms have configurable params
	seed?: number;
	trace: AlgorithmEvent[];
	metrics: AlgorithmMetrics;
	result: AlgorithmResult;
	createdAt: number;
};
