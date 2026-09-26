import { PlaybackEngine, type TraceCodec } from '../visualization/player';
import type { PlaybackStatus, VisualizationState } from '../visualization/types';
import { executionStore } from './execution-store.svelte';
import type { AnyExecution } from '../domain/execution';
import type { Problem } from '../domain/problem';
import type { ProblemFamily } from '../families/types';
import { getFamily } from '../families/registry';
import type { TraceEvent, TraceState } from '../trace/types';
import { asGameTreeState, asPathfindingState } from '../families/pathfinding/trace';
import type { GameTreeTraceState } from '../families/adversarial/tree-state';
import type { GameTree } from '../graph/game-tree';
import type { MetricsRecord } from '../trace/types';

/**
 * Builds the codec the engine folds a family's events with.
 *
 * `stepInto` is a family's own in-place fast path, and the family declares it.
 * It used to be hardcoded to the game-tree reducer here, which meant a pathfinding
 * trace was folded by a reducer that does not understand its events: the state
 * came back unchanged, `cellStates` stayed empty, and the maze never painted
 * while the playhead advanced - the engine's step counter is independent of the
 * state, so the trace looked like it was playing.
 *
 * The tree snapshot is threaded through for the game-tree family, which needs it
 * to dim a whole pruned subtree and which the engine has no way of knowing about.
 */
function codecFor(family: ProblemFamily | undefined, tree?: GameTree): TraceCodec {
	if (!family) {
		return {
			createState: () => ({} as TraceState),
			reduce: (state) => state
		};
	}
	return {
		createState: () => family.createTraceState(),
		reduce: (state, event) => family.reduce(state, { step: -1, kind: '', payload: event }),
		// A family without a fast path falls back to `reduce`, which is the whole
		// point of it being optional.
		stepInto: family.stepInto
			? (state, event) => family.stepInto!(state, { step: -1, kind: '', payload: event }, tree)
			: undefined
	};
}

/** The game tree a pane's loaded execution was snapshotted with. */
function treeOf(problem: Problem | null): GameTree | undefined {
	return problem?.type === 'game-tree' ? problem.tree : undefined;
}

/**
 * One playback pane.
 *
 * A pane is not bound to a family: the family is a property of the execution it
 * loads, so the same pane plays a grid BFS trace and then a minimax trace. What
 * the pane does know is its *slot*, which is how the comparison view addresses
 * panes 1..N.
 */
export class PlaybackState {
	private engine: PlaybackEngine<TraceState>;

	private _vizState = $state<TraceState>({} as TraceState);
	private _status = $state<PlaybackStatus>('idle');
	private _currentStep = $state(0);
	private _totalSteps = $state(0);
	private _speed = $state(50);
	private _traceEvents = $state<TraceEvent[]>([]);
	private _familyId = $state<string | null>(null);
	/** 'active' is pane 0; 0..MAX-2 are the comparison panes. */
	private _slot: 'active' | number;
	private _loadedExecutionId: string | null = null;

	constructor(slot: 'active' | number = 'active') {
		this._slot = slot;
		this.engine = new PlaybackEngine<TraceState>({
			onStateChange: (state, status) => {
				this._vizState = state;
				this._status = status;
			},
			onProgress: (current, total) => {
				this._currentStep = current;
				this._totalSteps = total;
			}
		});

		this.engine.setSpeed(this._speed);
	}

	public initEffects() {
		$effect.root(() => {
			$effect(() => {
				const execution = this.execution;
				if (execution && this._loadedExecutionId !== execution.id) {
					this.loadExecution(execution);
				} else if (!execution && this._loadedExecutionId !== null) {
					this.invalidate();
				}
			});
		});
	}

	/** The execution this pane is currently responsible for. */
	get execution(): AnyExecution | null {
		return this._slot === 'active'
			? (executionStore.activeExecution as AnyExecution | null)
			: executionStore.executionAt((this._slot as number) + 1);
	}

	/** Family-agnostic view of `vizState`, for chrome that renders no family content. */
	get vizState(): TraceState {
		return this._vizState;
	}

	/** The pathfinding half of the state union, or null when this pane is not pathfinding. */
	get pathfindingState(): VisualizationState | null {
		return asPathfindingState(this._vizState);
	}

	/** The game-tree half of the state union, or null when this pane is not adversarial. */
	get gameTreeState(): GameTreeTraceState | null {
		return asGameTreeState(this._vizState);
	}

	get status(): PlaybackStatus {
		return this._status;
	}
	get currentStep(): number {
		return this._currentStep;
	}
	get totalSteps(): number {
		return this._totalSteps;
	}
	/** The loaded trace as shared envelopes, for the timeline's event-kind markers. */
	get traceEvents(): TraceEvent[] {
		return this._traceEvents;
	}
	get familyId(): string | null {
		return this._familyId;
	}
	get family(): ProblemFamily | undefined {
		return this._familyId ? getFamily(this._familyId) : undefined;
	}
	get metrics(): MetricsRecord | null {
		return this.execution?.metrics ?? null;
	}
	get problem(): Problem | null {
		return this.execution?.problemSnapshot ?? null;
	}
	get speed(): number {
		return this._speed;
	}
	get hasLoadedTrace(): boolean {
		return this._loadedExecutionId !== null;
	}

	get progressPercentage(): number {
		if (this._totalSteps === 0) return 0;
		return (this._currentStep / this._totalSteps) * 100;
	}

	get isRunning(): boolean {
		return this._status === 'running';
	}
	get isPaused(): boolean {
		return this._status === 'paused';
	}
	get isIdle(): boolean {
		return this._status === 'idle';
	}
	get isCompleted(): boolean {
		return this._status === 'completed';
	}

	/** The event kind at the current step, for the timeline's readout. */
	get currentKind(): string | null {
		return this._traceEvents[this._currentStep - 1]?.kind ?? null;
	}

	loadExecution(execution: AnyExecution | null): void {
		if (!execution) {
			this.invalidate();
			return;
		}
		this._loadedExecutionId = execution.id;
		this._familyId = execution.familyId;
		const family = getFamily(execution.familyId);
		this._traceEvents = family ? family.toTraceEvents(execution.trace) : [];
		this.engine.loadEvents(
			execution.trace,
			codecFor(family, treeOf(execution.problemSnapshot))
		);
	}

	invalidate(): void {
		this._loadedExecutionId = null;
		this._familyId = null;
		this._traceEvents = [];
		this.engine.unloadEvents();
	}

	setSpeed(speed: number) {
		this._speed = Number.isFinite(speed) ? Math.max(0.1, speed) : 50;
		this.engine.setSpeed(this._speed);
	}

	play() {
		this.engine.play();
	}

	pause() {
		this.engine.pause();
	}

	togglePlayPause() {
		if (this.isRunning) {
			this.pause();
		} else {
			this.play();
		}
	}

	step() {
		this.engine.step();
	}

	stepBack() {
		this.engine.stepBack();
	}

	reset() {
		this.engine.reset();
	}

	seek(step: number) {
		this.engine.seek(step);
	}

	seekPercentage(percentage: number) {
		const target = stepForPercentage(
			Number.isFinite(percentage) ? percentage : this.progressPercentage,
			this._totalSteps
		);
		this.seek(target);
	}
}

/**
 * The trace step a timeline percentage maps to.
 *
 * Shared with the timeline's scrub guard so the two cannot disagree about which
 * step a given slider position means.
 */
export function stepForPercentage(percentage: number, totalSteps: number): number {
	if (!Number.isFinite(percentage) || !Number.isFinite(totalSteps) || totalSteps <= 0) return 0;
	const clamped = Math.max(0, Math.min(100, percentage));
	return Math.floor((clamped / 100) * totalSteps);
}

/**
 * The step the timeline scrubber moves in. Shared with `quantiseToStep` so the
 * guard mirrors the slider's own rounding instead of guessing at it.
 */
export const TIMELINE_STEP = 0.05;

/** Rounds a value onto the slider's grid, the way the slider itself does. */
export function quantiseToStep(value: number, step: number = TIMELINE_STEP): number {
	if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) return 0;
	return Math.round(value / step) * step;
}

/**
 * Whether a timeline slider emission is the playhead echoing its own position
 * rather than the user scrubbing.
 *
 * The slider is controlled, but its `onValueChange` is called from the value
 * *setter*, so pushing a new position in from outside fires it exactly as a drag
 * does. During playback that happens on every step, and the handler pauses and
 * seeks - so playback stopped itself on its first frame: it ran for a moment and
 * then stopped, leaving the readout at "1 / 36 (3%)" and the trace back at the
 * start.
 *
 * The comparison is on the quantised value rather than on the step it maps to.
 * Deriving the step instead does not work: the slider rounds to its 0.05 grid, so
 * for a 36-event trace step 2 sits at 5.5555…% and rounds down to 5.55%, which
 * floors back to step 1. That is one step away from where the playhead actually
 * is, and it is enough to look like a drag.
 */
export function isPlaybackEcho(emitted: number, currentProgress: number): boolean {
	return Number.isFinite(emitted) && quantiseToStep(currentProgress) === emitted;
}

export const playbackState = new PlaybackState('active');

/** Comparison panes, in slot order. Pane `n` shows the `n`th comparison execution. */
export const comparePlaybackStates: PlaybackState[] = [0, 1, 2].map(
	(slot) => new PlaybackState(slot)
);

/** First comparison pane, for the call sites that only ever need two panes. */
export const comparePlaybackState = comparePlaybackStates[0];

playbackState.initEffects();
for (const pane of comparePlaybackStates) pane.initEffects();
