import type { Problem } from './problem';
import type { AlgorithmEvent, AlgorithmMetrics, AlgorithmResult } from '../algorithms/types';
import type { GameTreeEvent, GameTreeResult } from '../algorithms/adversarial/types';
import type { MetricsRecord } from '../trace/types';

export type ExecutionId = string;

/**
 * One run of one algorithm over one problem snapshot.
 *
 * Generic with pathfinding defaults so every existing read site keeps its exact
 * current type (`Execution.trace` is still `AlgorithmEvent[]`), while the store
 * is free to hold adversarial executions in the same map. `familyId` records
 * which family's vocabulary and renderer the trace belongs to.
 */
export type Execution<
	TTrace = AlgorithmEvent,
	TMetrics extends MetricsRecord = AlgorithmMetrics,
	TResult extends { events: TTrace[]; metrics: TMetrics } = {
		events: TTrace[];
		metrics: TMetrics;
	}
> = {
	id: ExecutionId;
	problemSnapshot: Problem;
	algorithmId: string;
	algorithmConfig?: Record<string, unknown>;
	seed?: number;
	/** The family that owns this execution's event vocabulary and renderer. */
	familyId: string;
	trace: TTrace[];
	metrics: TMetrics;
	result: TResult;
	createdAt: number;
};

/** Any execution, regardless of family. Used for the store's internal map. */
export type AnyExecution = Execution<any, any, any>;

export type GameTreeExecution = Execution<
	GameTreeEvent,
	Record<string, number>,
	GameTreeResult & { events: GameTreeEvent[]; metrics: Record<string, number> }
>;

