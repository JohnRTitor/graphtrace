import { PlaybackEngine } from '../visualization/player';
import { createInitialVisualizationState, type PlaybackStatus, type VisualizationState } from '../visualization/types';
import { executionStore } from './execution-store.svelte';
import type { AlgorithmMetrics } from '../algorithms/types';
import type { Execution } from '../domain/execution';
import type { Problem } from '../domain/problem';

export class PlaybackState {
	private engine: PlaybackEngine;
	
	private _vizState = $state<VisualizationState>(createInitialVisualizationState());
	private _status = $state<PlaybackStatus>('idle');
	private _currentStep = $state(0);
	private _totalSteps = $state(0);
	private _speed = $state(50);
	private _executionType: 'active' | 'compare';
	private _loadedExecutionId: string | null = null;

	constructor(executionType: 'active' | 'compare' = 'active') {
		this._executionType = executionType;
		this.engine = new PlaybackEngine({
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
				const exec = this._executionType === 'active'
					? executionStore.activeExecution
					: executionStore.isComparing ? executionStore.compareExecution : null;
				if (exec && this._loadedExecutionId !== exec.id) {
					this.loadExecution(exec);
				} else if (!exec && this._loadedExecutionId !== null) {
					this.invalidate();
				}
			});
		});
	}

	get vizState() { return this._vizState; }
	get status() { return this._status; }
	get currentStep() { return this._currentStep; }
	get totalSteps() { return this._totalSteps; }
	get metrics(): AlgorithmMetrics | null {
		const execution = this._executionType === 'active'
			? executionStore.activeExecution
			: executionStore.compareExecution;
		return execution?.metrics || null;
	}
	get problem(): Problem | null {
		const execution = this._executionType === 'active'
			? executionStore.activeExecution
			: executionStore.compareExecution;
		return execution?.problemSnapshot ?? null;
	}
	get speed() { return this._speed; }
	get hasLoadedTrace() { return this._loadedExecutionId !== null; }
	
	get progressPercentage() {
		if (this._totalSteps === 0) return 0;
		return (this._currentStep / this._totalSteps) * 100;
	}

	get isRunning() { return this._status === 'running'; }
	get isPaused() { return this._status === 'paused'; }
	get isIdle() { return this._status === 'idle'; }
	get isCompleted() { return this._status === 'completed'; }

	loadExecution(execution: Execution | null): void {
		if (!execution) {
			this.invalidate();
			return;
		}
		this._loadedExecutionId = execution.id;
		this.engine.loadEvents(execution.trace);
	}

	invalidate(): void {
		this._loadedExecutionId = null;
		this.engine.unloadEvents();
	}

	setSpeed(speed: number) {
		this._speed = speed;
		this.engine.setSpeed(speed);
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
		const targetStep = Math.floor((percentage / 100) * this._totalSteps);
		this.seek(targetStep);
	}
}

export const playbackState = new PlaybackState('active');
export const comparePlaybackState = new PlaybackState('compare');

playbackState.initEffects();
comparePlaybackState.initEffects();
