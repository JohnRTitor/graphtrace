import { applyEvent, stepInto } from './trace-reducer';
import type { AlgorithmEvent } from '../algorithms/types';
import { createInitialVisualizationState, type PlaybackStatus, type VisualizationState } from './types';
import type { TraceState } from '../trace/types';

/**
 * How the engine folds a family's native events into that family's trace state.
 *
 * `state` is a pure function, which is the whole reason a backward seek is just
 * a replay from the initial state: nothing needs to be invertible.
 */
export type TraceCodec<TState = TraceState> = {
	createState: () => TState;
	reduce: (state: TState, event: unknown) => TState;
	/**
	 * Optional in-place fast path.
	 *
	 * `stepInto` mutates the state it is handed and returns a fresh record that
	 * shares the mutated collections. The engine uses it for stepping and for
	 * replay, which is where the cost concentrates:
	 *
	 * - `reduce` clones the whole state per event, so a replay of an n-event
	 *   trace costs O(n x state size). Measured at 0.12ms per event on a 30x40
	 *   grid, a single seek across a BFS trace blocked for ~160ms.
	 * - `stepInto` is O(1) per event, which brings any replay in this app under
	 *   a frame.
	 *
	 * Omitting it is always correct, just slower, so a family does not have to
	 * provide one.
	 */
	stepInto?: (state: TState, event: unknown) => TState;
};

/** Default codec: the pre-existing pathfinding reducer, unchanged. */
export const pathfindingCodec: TraceCodec<VisualizationState> = {
	createState: createInitialVisualizationState,
	// The engine works in `unknown` events because it is family-agnostic; the
	// default codec is the pathfinding family, whose event type this is.
	reduce: (state, event) => applyEvent(state, event as AlgorithmEvent),
	stepInto: (state, event) => stepInto(state, event as AlgorithmEvent)
};

export type PlayerOptions<TState = VisualizationState> = {
	onStateChange: (state: TState, status: PlaybackStatus) => void;
	onProgress: (currentStep: number, totalSteps: number) => void;
	/** Family reducer. Defaults to pathfinding so existing callers are unchanged. */
	codec?: TraceCodec<TState>;
};

/**
 * The default type parameter is the pathfinding state, because the default codec
 * is the pathfinding reducer. A family-agnostic caller (`PlaybackState`) opts
 * into `TraceState` explicitly and supplies its own codec.
 */
export class PlaybackEngine<TState = VisualizationState> {
	private events: unknown[] = [];
	private codec: TraceCodec<TState>;
	private state: TState;
	private status: PlaybackStatus = 'idle';

	private currentStep = 0;
	private speed = 50;

	private lastFrameTime = 0;
	private timeAccumulator = 0;
	private animationFrameId: number | null = null;
	private animationGeneration = 0;

	private options: PlayerOptions<TState>;

	constructor(options: PlayerOptions<TState>) {
		this.options = options;
		this.codec = (options.codec ?? pathfindingCodec) as TraceCodec<TState>;
		this.state = this.codec.createState();
	}

	/**
	 * Loads a trace and resets to step zero.
	 *
	 * `codec` is supplied at load time rather than construction time because the
	 * family is a property of the *execution* being loaded, not of the player: a
	 * single pane can play a pathfinding trace and then an adversarial one.
	 */
	loadEvents(events: readonly unknown[], codec?: TraceCodec<TState>): void {
		this.cancelAnimation();
		if (codec) this.codec = codec;
		this.events = [...events];
		this.currentStep = 0;
		this.state = this.codec.createState();
		this.status = 'idle';
		this.notify();
	}

	unloadEvents(): void {
		this.loadEvents([]);
	}

	setSpeed(eventsPerSecond: number): void {
		this.speed = Number.isFinite(eventsPerSecond) ? Math.max(0.1, eventsPerSecond) : 50;
	}

	play(): void {
		if (this.status === 'running' || this.events.length === 0) return;

		this.cancelAnimation();
		if (this.currentStep >= this.events.length) {
			this.rebuildTo(0);
		}

		this.status = 'running';
		this.lastFrameTime = performance.now();
		this.timeAccumulator = 0;
		const generation = this.animationGeneration;
		this.scheduleAnimation(generation);
		this.notify();
	}

	pause(): void {
		if (this.status !== 'running') return;
		
		this.status = 'paused';
		this.cancelAnimation();
		this.notify();
	}

	step(): void {
		if (this.events.length === 0) return;
		this.pause();
		
		if (this.currentStep < this.events.length) {
			this.processNextEvent();
			this.status = this.currentStep >= this.events.length ? 'completed' : 'paused';
			this.notify();
		}
	}

	stepBack(): void {
		if (this.events.length === 0) return;
		this.pause();
		if (this.currentStep > 0) {
			const targetStep = this.currentStep - 1;
			this.rebuildTo(targetStep);
			this.status = targetStep >= this.events.length ? 'completed' : 'paused';
			this.notify();
		}
	}

	reset(): void {
		this.cancelAnimation();
		this.currentStep = 0;
		this.state = this.codec.createState();
		this.status = 'idle';
		this.notify();
	}

	seek(stepIndex: number): void {
		this.pause();
		const safeStep = Number.isFinite(stepIndex) ? stepIndex : this.currentStep;
		const targetStep = Math.max(0, Math.min(safeStep, this.events.length));
		this.rebuildTo(targetStep);
		this.status = this.events.length === 0
			? 'idle'
			: targetStep >= this.events.length ? 'completed' : 'paused';
		this.notify();
	}

	getStatus(): PlaybackStatus {
		return this.status;
	}

	/**
	 * The state at the current step.
	 *
	 * Read-only by contract: the engine owns the collections, and the record it
	 * hands out is shared with the reducer's fast path, so a caller must not
	 * mutate it. Exposed so tests can assert on what a seek produced.
	 */
	getState(): TState {
		return this.state;
	}

	private tick = (timestamp: number, generation: number): void => {
		if (generation !== this.animationGeneration || this.status !== 'running') return;
		this.animationFrameId = null;

		const deltaTime = timestamp - this.lastFrameTime;
		this.lastFrameTime = timestamp;
		
		if (deltaTime <= 100) {
			this.timeAccumulator += deltaTime;
			const msPerEvent = 1000 / this.speed;
			let processedAny = false;

			while (this.timeAccumulator >= msPerEvent && this.currentStep < this.events.length) {
				this.processNextEvent();
				this.timeAccumulator -= msPerEvent;
				processedAny = true;
			}

			if (this.currentStep >= this.events.length) {
				this.status = 'completed';
				this.notify();
				return;
			}

			if (processedAny) {
				this.notify();
			}
		}

		this.scheduleAnimation(generation);
	};

	private scheduleAnimation(generation: number): void {
		if (generation !== this.animationGeneration || this.status !== 'running') return;
		this.animationFrameId = requestAnimationFrame((timestamp) => this.tick(timestamp, generation));
	}

	private cancelAnimation(): void {
		this.animationGeneration++;
		if (this.animationFrameId !== null) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
	}

	private rebuildTo(stepIndex: number): void {
		// A backward seek is a replay from the initial state rather than an
		// inversion, which is why every family's reducer only has to be pure.
		//
		// The replay is the single most latency-sensitive operation in the app: it
		// runs synchronously in one task, and a user dragging the timeline fires it
		// on every pointer move. `stepInto` is used in preference to `reduce` when
		// the family provides it, so the cost is O(events) rather than
		// O(events x state size).
		this.state = this.codec.createState();
		for (let index = 0; index < stepIndex; index++) {
			this.state = this.fold(this.state, this.events[index]);
		}
		this.currentStep = stepIndex;
	}

	/** One fold, using the in-place fast path when the family provides one. */
	private fold(state: TState, event: unknown): TState {
		return this.codec.stepInto
			? this.codec.stepInto(state, event)
			: this.codec.reduce(state, event);
	}

	private processNextEvent(): void {
		if (this.currentStep < this.events.length) {
			this.state = this.fold(this.state, this.events[this.currentStep]);
			this.currentStep++;
		}
	}

	private notify(): void {
		this.options.onStateChange(this.state, this.status);
		this.options.onProgress(this.currentStep, this.events.length);
	}
}
