import type { AlgorithmEvent } from '../algorithms/types';
import { applyEvent } from './trace-reducer';
import { createInitialVisualizationState, type PlaybackStatus, type VisualizationState } from './types';

export type PlayerOptions = {
	onStateChange: (state: VisualizationState, status: PlaybackStatus) => void;
	onProgress: (currentStep: number, totalSteps: number) => void;
};

export class PlaybackEngine {
	private events: AlgorithmEvent[] = [];
	private state: VisualizationState = createInitialVisualizationState();
	private status: PlaybackStatus = 'idle';
	
	private currentStep = 0;
	private speed = 50;
	
	private lastFrameTime = 0;
	private timeAccumulator = 0;
	private animationFrameId: number | null = null;
	private animationGeneration = 0;
	
	private options: PlayerOptions;

	constructor(options: PlayerOptions) {
		this.options = options;
	}

	loadEvents(events: AlgorithmEvent[]): void {
		this.cancelAnimation();
		this.events = [...events];
		this.currentStep = 0;
		this.state = createInitialVisualizationState();
		this.status = 'idle';
		this.notify();
	}

	unloadEvents(): void {
		this.loadEvents([]);
	}

	setSpeed(eventsPerSecond: number): void {
		this.speed = Math.max(0.1, eventsPerSecond);
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
		this.state = createInitialVisualizationState();
		this.status = 'idle';
		this.notify();
	}

	seek(stepIndex: number): void {
		this.pause();
		const targetStep = Math.max(0, Math.min(stepIndex, this.events.length));
		this.rebuildTo(targetStep);
		this.status = this.events.length === 0
			? 'idle'
			: targetStep >= this.events.length ? 'completed' : 'paused';
		this.notify();
	}

	getStatus(): PlaybackStatus {
		return this.status;
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
		this.state = createInitialVisualizationState();
		for (let index = 0; index < stepIndex; index++) {
			this.state = applyEvent(this.state, this.events[index]);
		}
		this.currentStep = stepIndex;
	}

	private processNextEvent(): void {
		if (this.currentStep < this.events.length) {
			this.state = applyEvent(this.state, this.events[this.currentStep]);
			this.currentStep++;
		}
	}

	private notify(): void {
		this.options.onStateChange(this.state, this.status);
		this.options.onProgress(this.currentStep, this.events.length);
	}
}
