import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlaybackEngine } from '../player';
import type { AlgorithmEvent } from '../../algorithms/types';
import { applyEvent } from '../trace-reducer';
import {
	createInitialVisualizationState,
	type PlaybackStatus,
	type VisualizationState
} from '../types';

let frames: Map<number, FrameRequestCallback>;
let nextFrameId: number;
let now: number;

beforeEach(() => {
	frames = new Map();
	nextFrameId = 1;
	now = 0;
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
		const id = nextFrameId++;
		frames.set(id, callback);
		return id;
	});
	vi.stubGlobal('cancelAnimationFrame', (id: number) => {
		frames.delete(id);
	});
	vi.spyOn(performance, 'now').mockImplementation(() => now);
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function createHarness() {
	let state = createInitialVisualizationState();
	let status: PlaybackStatus = 'idle';
	let currentStep = 0;
	let totalSteps = 0;
	const engine = new PlaybackEngine({
		onStateChange: (nextState, nextStatus) => {
			state = nextState;
			status = nextStatus;
		},
		onProgress: (current, total) => {
			currentStep = current;
			totalSteps = total;
		}
	});

	return {
		engine,
		get state() { return state; },
		get status() { return status; },
		get currentStep() { return currentStep; },
		get totalSteps() { return totalSteps; }
	};
}

function stateAfter(events: AlgorithmEvent[], step: number): VisualizationState {
	let state = createInitialVisualizationState();
	for (let index = 0; index < step; index++) {
		state = applyEvent(state, events[index]);
	}
	return state;
}

function runNextFrame(timestamp: number): void {
	const entry = frames.entries().next().value as [number, FrameRequestCallback] | undefined;
	if (!entry) return;
	frames.delete(entry[0]);
	now = timestamp;
	entry[1](timestamp);
}

describe('PlaybackEngine', () => {
	it('loads synchronously and pauses after the first step', () => {
		const harness = createHarness();
		harness.engine.loadEvents([
			{ type: 'start', node: 'A' },
			{ type: 'discover', node: 'B' },
			{ type: 'expand', node: 'A' }
		]);

		expect(harness.status).toBe('idle');
		expect(harness.currentStep).toBe(0);
		expect(harness.totalSteps).toBe(3);

		harness.engine.step();
		expect(harness.status).toBe('paused');
		expect(harness.currentStep).toBe(1);

		harness.engine.step();
		expect(harness.status).toBe('paused');
		expect(harness.state.cellStates.get('B')).toBe('discovered');

		harness.engine.step();
		expect(harness.status).toBe('completed');
		expect(harness.currentStep).toBe(3);
	});

	it('keeps empty traces idle and does not schedule animation', () => {
		const harness = createHarness();
		harness.engine.loadEvents([]);

		harness.engine.play();
		harness.engine.step();
		harness.engine.stepBack();
		harness.engine.seek(10);
		harness.engine.reset();

		expect(harness.status).toBe('idle');
		expect(harness.currentStep).toBe(0);
		expect(harness.totalSteps).toBe(0);
		expect(frames.size).toBe(0);
	});

	it('retains loaded events on reset for replay', () => {
		const harness = createHarness();
		harness.engine.loadEvents([
			{ type: 'start', node: 'A' },
			{ type: 'discover', node: 'B' },
			{ type: 'finish', found: true }
		]);
		harness.engine.seek(2);
		harness.engine.reset();

		expect(harness.status).toBe('idle');
		expect(harness.currentStep).toBe(0);
		expect(harness.totalSteps).toBe(3);

		harness.engine.step();
		expect(harness.status).toBe('paused');
		expect(harness.currentStep).toBe(1);
	});

	it('rebuilds exact state for backward seeks and stepBack', () => {
		const events: AlgorithmEvent[] = [
			{ type: 'start', node: 'A' },
			{ type: 'update', node: 'A', g: 10, h: 4, f: 14 },
			{ type: 'update', node: 'A', g: 5, h: 4, f: 9 },
			{ type: 'discover', node: 'B', from: 'A' },
			{ type: 'expand', node: 'A' },
			{ type: 'update', node: 'B', g: 1, h: 2, f: 3 },
			{ type: 'path', nodes: ['A', 'B'] },
			{ type: 'finish', found: true }
		];
		const harness = createHarness();
		harness.engine.loadEvents(events);

		harness.engine.seek(3);
		expect(harness.state).toEqual(stateAfter(events, 3));
		expect(harness.state.costData.get('A')).toEqual({ g: 5, h: 4, f: 9 });

		harness.engine.seek(7);
		harness.engine.stepBack();
		expect(harness.currentStep).toBe(6);
		expect(harness.state).toEqual(stateAfter(events, 6));

		harness.engine.seek(0);
		expect(harness.state).toEqual(createInitialVisualizationState());
	});

	it('cancels stale animation callbacks across pause and replay', () => {
		const harness = createHarness();
		harness.engine.loadEvents([
			{ type: 'start', node: 'A' },
			{ type: 'discover', node: 'B' },
			{ type: 'expand', node: 'A' },
			{ type: 'finish', found: true }
		]);
		harness.engine.setSpeed(50);

		harness.engine.play();
		const staleCallback = frames.values().next().value as FrameRequestCallback;
		harness.engine.pause();
		harness.engine.play();

		staleCallback(1000);
		expect(harness.currentStep).toBe(0);
		expect(frames.size).toBe(1);

		runNextFrame(20);
		expect(harness.currentStep).toBe(1);
		expect(frames.size).toBe(1);
	});

	it('stops scheduling frames when playback completes', () => {
		const harness = createHarness();
		harness.engine.loadEvents([
			{ type: 'start', node: 'A' },
			{ type: 'discover', node: 'B' },
			{ type: 'expand', node: 'A' },
			{ type: 'finish', found: true }
		]);
		harness.engine.setSpeed(50);
		harness.engine.play();

		runNextFrame(20);
		runNextFrame(40);
		runNextFrame(60);
		runNextFrame(80);

		expect(harness.status).toBe('completed');
		expect(harness.currentStep).toBe(4);
		expect(frames.size).toBe(0);
	});
});
