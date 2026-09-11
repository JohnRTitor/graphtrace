import type { AlgorithmEvent } from '../algorithms/types';
import { applyEvent, invertEvent } from './trace-reducer';
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
	
	private options: PlayerOptions;

	constructor(options: PlayerOptions) {
		this.options = options;
	}

	loadEvents(events: AlgorithmEvent[]): void {
		this.pause();
		this.events = events;
		this.reset();
	}

	setSpeed(eventsPerSecond: number): void {
		this.speed = Math.max(0.1, eventsPerSecond);
	}

	play(): void {
		if (this.status === 'running' || this.events.length === 0) return;
		
		if (this.currentStep >= this.events.length) {
			this.reset();
		}

		this.status = 'running';
		this.lastFrameTime = performance.now();
		this.timeAccumulator = 0;
		this.tick(this.lastFrameTime);
		this.notify();
	}

	pause(): void {
		if (this.status !== 'running') return;
		
		this.status = 'paused';
		if (this.animationFrameId !== null) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
		this.notify();
	}

	step(): void {
		this.pause();
		
		if (this.currentStep < this.events.length) {
			this.processNextEvent();
			
			if (this.currentStep >= this.events.length) {
				this.status = 'completed';
			}
			this.notify();
		}
	}

	stepBack(): void {
		this.pause();
		if (this.currentStep > 0) {
			this.processPrevEvent();
			this.status = 'paused';
			this.notify();
		}
	}

	reset(): void {
		this.pause();
		this.currentStep = 0;
		this.state = createInitialVisualizationState();
		this.status = 'idle';
		this.notify();
	}

	seek(stepIndex: number): void {
		this.pause();
		
		const targetStep = Math.max(0, Math.min(stepIndex, this.events.length));
		
		// Optimization: if seeking forward or backward, just apply/invert the delta
		// If seeking backward from very far, it might be faster to rebuild, but 
		// for true bidirectional we just step backward.
		if (targetStep < this.currentStep && (this.currentStep - targetStep > targetStep)) {
			// It's faster to rebuild from 0 if target is closer to 0 than to current
			this.state = createInitialVisualizationState();
			this.currentStep = 0;
		}

		while (this.currentStep < targetStep) {
			this.processNextEvent();
		}

		while (this.currentStep > targetStep) {
			this.processPrevEvent();
		}

		this.status = targetStep >= this.events.length ? 'completed' : 'paused';
		this.notify();
	}

	getStatus(): PlaybackStatus {
		return this.status;
	}

	private tick = (timestamp: number): void => {
		if (this.status !== 'running') return;

		const deltaTime = timestamp - this.lastFrameTime;
		this.lastFrameTime = timestamp;
		
		if (deltaTime > 100) {
			this.animationFrameId = requestAnimationFrame(this.tick);
			return;
		}

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

		this.animationFrameId = requestAnimationFrame(this.tick);
	};

	private processNextEvent(): void {
		if (this.currentStep < this.events.length) {
			const event = this.events[this.currentStep];
			this.state = applyEvent(this.state, event);
			this.currentStep++;
		}
	}

	private processPrevEvent(): void {
		if (this.currentStep > 0) {
			this.currentStep--;
			const event = this.events[this.currentStep];
			this.state = invertEvent(this.state, event);
		}
	}

	private notify(): void {
		this.options.onStateChange(this.state, this.status);
		this.options.onProgress(this.currentStep, this.events.length);
	}
}
