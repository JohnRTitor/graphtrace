import { generateId } from '../utils';
import type { Execution, ExecutionId } from '../domain/execution';
import type { Problem } from '../domain/problem';
import { getAlgorithm } from '../algorithms';
import type { BaseGraph } from '../graph/types';
import { GridAdapter } from '../graph/graph-adapter';
import { cloneManualGraph } from '../graph/manual';

export class ExecutionStore {
	private executions = $state<Map<ExecutionId, Execution>>(new Map());
	private _activeId = $state<ExecutionId | null>(null);
	private _compareId = $state<ExecutionId | null>(null);
	private _isComparing = $state<boolean>(false);
	private readonly maxExecutions = 20;

	get isComparing(): boolean {
		return this._isComparing;
	}

	set isComparing(val: boolean) {
		this._isComparing = val;
		if (!val) {
			this._compareId = null;
		}
	}

	get compareId(): ExecutionId | null {
		return this._compareId;
	}

	set compareId(id: ExecutionId | null) {
		this._compareId = id;
	}

	get compareExecution(): Execution | null {
		if (!this._compareId) return null;
		return this.executions.get(this._compareId) || null;
	}

	get activeId(): ExecutionId | null {
		return this._activeId;
	}

	set activeId(id: ExecutionId | null) {
		this._activeId = id;
	}

	get activeExecution(): Execution | null {
		if (!this._activeId) return null;
		return this.executions.get(this._activeId) || null;
	}

	get(id: ExecutionId): Execution | undefined {
		return this.executions.get(id);
	}

	discard(id: ExecutionId): void {
		this.executions.delete(id);
		if (this._activeId === id) {
			this._activeId = null;
		}
		if (this._compareId === id) {
			this._compareId = null;
			this._isComparing = false;
		}
	}

	invalidatePlayback(): void {
		this._activeId = null;
		this._compareId = null;
		this._isComparing = false;
		this.executions.clear();
	}

	run(problem: Problem, algorithmId: string, config?: any): ExecutionId {
		const algo = getAlgorithm(algorithmId);
		if (!algo) {
			throw new Error(`Algorithm ${algorithmId} not found`);
		}

		let graphModel: BaseGraph;
		let start;
		let goal;

		if (problem.type === 'grid') {
			graphModel = new GridAdapter(problem.grid, problem.movementModel, problem.costModel);
			start = problem.grid.start;
			goal = problem.grid.goal;
		} else {
			graphModel = cloneManualGraph(problem.graph, problem.costModel);
			start = problem.graph.start;
			goal = problem.graph.goal;
		}

		if (!start || !goal || !graphModel.getNode(start) || !graphModel.getNode(goal)) {
			throw new Error("Start or goal node not set");
		}
		if (problem.type === 'grid') {
			if (!problem.grid.nodes.get(start)?.walkable || !problem.grid.nodes.get(goal)?.walkable) {
				throw new Error("Start and goal must be walkable");
			}
		}

		const result = algo.run(graphModel, start, goal);
		
		const id = generateId();
		
		const execution: Execution = {
			id,
			problemSnapshot: problem.version,
			algorithmId,
			algorithmConfig: config,
			trace: result.events,
			metrics: result.metrics,
			result,
			createdAt: Date.now()
		};

		this.executions.set(id, execution);
		while (this.executions.size > this.maxExecutions) {
			const oldest = Array.from(this.executions.keys()).find(
				(executionId) => executionId !== this._activeId && executionId !== this._compareId
			);
			if (!oldest) break;
			this.executions.delete(oldest);
		}
		
		if (this._isComparing && this._activeId) {
			this._compareId = id;
		} else {
			this._activeId = id;
			this._compareId = null;
			this._isComparing = false;
		}
		
		return id;
	}

	getAllExecutions(): Execution[] {
		return Array.from(this.executions.values());
	}
}

export const executionStore = new ExecutionStore();
