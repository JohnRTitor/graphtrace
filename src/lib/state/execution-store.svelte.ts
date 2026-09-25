import { generateId } from '../utils';
import type { AnyExecution, Execution, ExecutionId, GameTreeExecution } from '../domain/execution';
import { cloneProblem, type Problem } from '../domain/problem';
import { getAlgorithm, getGameSearchAlgorithm } from '../algorithms';
import type { BaseGraph } from '../graph/types';
import { GridAdapter } from '../graph/graph-adapter';
import { cloneManualGraph } from '../graph/manual';


/** A comparison pane shows at most this many executions in total. */
export const MAX_COMPARISON_PANES = 4;

export class ExecutionStore {
	private executions = $state<Map<ExecutionId, AnyExecution>>(new Map());
	private _activeId = $state<ExecutionId | null>(null);
	private _compareIds = $state<ExecutionId[]>([]);
	private _isComparing = $state(false);
	/**
	 * How many finished runs to keep.
	 *
	 * Nothing in the app offers a run history - at most four executions are ever
	 * mounted, as comparison panes - so retention is purely a fallback for a pane
	 * that is momentarily empty. Each retained execution holds a full problem
	 * snapshot and a whole event trace, so on a large game tree or grid a high
	 * limit is tens of megabytes retained for executions nothing can reach. Eight
	 * is comfortably more than the four panes need.
	 */
	private readonly maxExecutions = 8;

	/**
	 * Comparison *mode*, independent of how many panes currently hold an
	 * execution. Entering the mode arms the next run to fill a comparison pane;
	 * leaving it clears every pane.
	 */
	get isComparing(): boolean {
		return this._isComparing;
	}

	set isComparing(val: boolean) {
		this._isComparing = val;
		if (!val) {
			this._compareIds = [];
		}
	}

	get compareIds(): ExecutionId[] {
		return this._compareIds;
	}

	set compareIds(ids: ExecutionId[]) {
		const valid = ids
			.filter((id) => this.executions.has(id))
			.slice(0, MAX_COMPARISON_PANES - 1);
		this._compareIds = valid;
	}

	/** First comparison pane. Kept for the existing two-pane call sites. */
	get compareId(): ExecutionId | null {
		return this._compareIds[0] ?? null;
	}

	set compareId(id: ExecutionId | null) {
		this._compareIds = id === null ? [] : [id];
	}

	get compareExecution(): AnyExecution | null {
		return this.compareId === null ? null : (this.executions.get(this.compareId) ?? null);
	}

	/** The execution mounted in pane `index`; pane 0 is the active one. */
	executionAt(index: number): AnyExecution | null {
		const id = index === 0 ? this._activeId : (this._compareIds[index - 1] ?? null);
		return id === null ? null : (this.executions.get(id) ?? null);
	}

	/** Every execution currently mounted, in pane order. */
	get paneExecutions(): AnyExecution[] {
		const panes: AnyExecution[] = [];
		for (let index = 0; index < MAX_COMPARISON_PANES; index++) {
			const execution = this.executionAt(index);
			if (execution) panes.push(execution);
		}
		return panes;
	}

	get paneCount(): number {
		return 1 + this._compareIds.length;
	}

	get activeId(): ExecutionId | null {
		return this._activeId;
	}

	set activeId(id: ExecutionId | null) {
		this._activeId = id;
	}

	get activeExecution(): Execution | null {
		if (!this._activeId) return null;
		return (this.executions.get(this._activeId) as Execution | undefined) ?? null;
	}

	get(id: ExecutionId): AnyExecution | undefined {
		return this.executions.get(id);
	}

	discard(id: ExecutionId): void {
		this.executions.delete(id);
		if (this._activeId === id) {
			this._activeId = null;
		}
		this._compareIds = this._compareIds.filter((compareId) => compareId !== id);
	}

	invalidatePlayback(): void {
		this._activeId = null;
		this._compareIds = [];
		this._isComparing = false;
		this.executions.clear();
	}

	run(problem: Problem, algorithmId: string, config?: Record<string, unknown>): ExecutionId {
		const execution = this.execute(problem, algorithmId, config);
		this.mount(execution.id);
		return execution.id;
	}

	/**
	 * Runs an algorithm and returns the execution without mounting it, so the
	 * comparison view can build a specific pane layout.
	 */
	execute(problem: Problem, algorithmId: string, config?: Record<string, unknown>): AnyExecution {
		const snapshot = cloneProblem(problem);
		const execution =
			snapshot.type === 'game-tree'
				? this.runGameTree(snapshot, algorithmId, config)
				: this.runPathfinding(snapshot, algorithmId, config);

		this.executions.set(execution.id, execution);
		this.evictOverflow();
		return execution;
	}

	/** Mounts an execution: into the active pane, or appended to the comparison panes. */
	mount(id: ExecutionId): void {
		if (this._isComparing && this._activeId !== null) {
			this._compareIds = [...this._compareIds, id].slice(-(MAX_COMPARISON_PANES - 1));
			return;
		}
		this._activeId = id;
		this._compareIds = [];
		this._isComparing = false;
	}

	private runPathfinding(
		snapshot: Exclude<Problem, { type: 'game-tree' }>,
		algorithmId: string,
		config?: Record<string, unknown>
	): Execution {
		const algo = getAlgorithm(algorithmId);
		if (!algo) {
			throw new Error(`Algorithm ${algorithmId} not found`);
		}

		let graphModel: BaseGraph;
		let start;
		let goal;

		if (snapshot.type === 'grid') {
			graphModel = new GridAdapter(snapshot.grid, snapshot.movementModel, snapshot.costModel);
			start = snapshot.grid.start;
			goal = snapshot.grid.goal;
		} else {
			graphModel = cloneManualGraph(snapshot.graph, snapshot.costModel);
			start = snapshot.graph.start;
			goal = snapshot.graph.goal;
		}

		if (!start || !goal || !graphModel.getNode(start) || !graphModel.getNode(goal)) {
			throw new Error('Start or goal node not set');
		}
		if (snapshot.type === 'grid') {
			if (!snapshot.grid.nodes.get(start)?.walkable || !snapshot.grid.nodes.get(goal)?.walkable) {
				throw new Error('Start and goal must be walkable');
			}
		}

		const result = algo.run(graphModel, start, goal);

		return {
			id: generateId(),
			problemSnapshot: snapshot,
			algorithmId,
			algorithmConfig: config,
			familyId: 'pathfinding',
			trace: result.events,
			metrics: result.metrics,
			result,
			createdAt: Date.now()
		};
	}

	private runGameTree(
		snapshot: Extract<Problem, { type: 'game-tree' }>,
		algorithmId: string,
		config?: Record<string, unknown>
	): GameTreeExecution {
		const algo = getGameSearchAlgorithm(algorithmId);
		if (!algo) {
			throw new Error(`Algorithm ${algorithmId} not found`);
		}
		if (snapshot.tree.root === null || snapshot.tree.nodes.size === 0) {
			throw new Error('The game tree is empty');
		}

		// `snapshot` is already a private deep copy made by `cloneProblem`, so the
		// search runs directly on it. Cloning again here doubled the cost of every
		// adversarial run for no isolation benefit.
		const result = algo.run(snapshot.tree);

		return {
			id: generateId(),
			problemSnapshot: snapshot,
			algorithmId,
			algorithmConfig: config,
			familyId: 'adversarial',
			trace: result.events,
			metrics: result.metrics,
			result,
			createdAt: Date.now()
		};
	}

	/**
	 * Evicts the oldest unmounted executions, protecting every mounted pane.
	 * Panes are re-inserted at the front of the output so the active pane is
	 * replaced first, which is the one a user is most likely to have just made.
	 */
	private evictOverflow(): void {
		const mounted = new Set<ExecutionId>([this._activeId, ...this._compareIds].filter(
			(id): id is ExecutionId => id !== null
		));
		const unmounted = Array.from(this.executions.keys()).filter((id) => !mounted.has(id));
		while (this.executions.size > this.maxExecutions && unmounted.length > 0) {
			this.executions.delete(unmounted.shift()!);
		}
	}
}

export const executionStore = new ExecutionStore();
