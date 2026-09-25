import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { environmentState } from '../environment.svelte';
import { comparePlaybackState, playbackState } from '../playback.svelte';
import { executionStore } from '../execution-store.svelte';
import { invalidatePlaybackIfNeeded } from '../invalidate';

let frames: Map<number, FrameRequestCallback>;
let nextFrameId: number;

beforeEach(() => {
	frames = new Map();
	nextFrameId = 1;
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
		const id = nextFrameId++;
		frames.set(id, callback);
		return id;
	});
	vi.stubGlobal('cancelAnimationFrame', (id: number) => {
		frames.delete(id);
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('EnvironmentState - maze context menu commands', () => {
	beforeEach(() => {
		environmentState.resizeGrid(5, 5);
	});

	it('clearGridStart / clearGridGoal clear only the relevant field', () => {
		environmentState.setGridStart('0,0');
		environmentState.setGridGoal('4,4');

		environmentState.clearGridStart();
		expect(environmentState.gridStart).toBeNull();
		expect(environmentState.gridGoal).toBe('4,4');

		environmentState.clearGridGoal();
		expect(environmentState.gridGoal).toBeNull();
	});

	it('clearGridCell resets walls and weight on a plain cell', () => {
		environmentState.setGridWall('2,2', true);
		environmentState.clearGridCell('2,2');

		const node = environmentState.grid.nodes.get('2,2');
		expect(node?.walkable).toBe(true);
		expect(node?.cost).toBe(1);
	});

	it('clearGridCell refuses to act on the start/goal cell (avoids a contradictory state)', () => {
		environmentState.setGridStart('1,1');
		environmentState.clearGridCell('1,1');

		// Cell is untouched - still walkable (it was never a wall), and still start.
		expect(environmentState.gridStart).toBe('1,1');
	});

	it('start and goal may coincide on the same cell, matching the underlying grid model', () => {
		environmentState.setGridStart('2,2');
		environmentState.setGridGoal('2,2');
		expect(environmentState.gridStart).toBe('2,2');
		expect(environmentState.gridGoal).toBe('2,2');

		environmentState.clearGridStart();
		expect(environmentState.gridStart).toBeNull();
		expect(environmentState.gridGoal).toBe('2,2');
	});
});

describe('EnvironmentState - manual graph context menu commands', () => {
	beforeEach(() => {
		environmentState.clearGraph();
	});

	it('renameGraphNode updates the label through the undo-able command path', () => {
		const id = environmentState.addGraphNode(0, 0, 'N1');

		environmentState.setGraphLabel(id, 'Origin');
		expect(environmentState.graph.nodes.get(id)?.label).toBe('Origin');

		environmentState.undo();
		expect(environmentState.graph.nodes.get(id)?.label).toBe('N1');

		environmentState.redo();
		expect(environmentState.graph.nodes.get(id)?.label).toBe('Origin');
	});

	it('renameGraphNode ignores blank labels', () => {
		const id = environmentState.addGraphNode(0, 0, 'N1');
		environmentState.setGraphLabel(id, '   ');
		expect(environmentState.graph.nodes.get(id)?.label).toBe('N1');
	});


});

describe('playback execution lifecycle', () => {
	beforeEach(() => {
		invalidatePlaybackIfNeeded();
		environmentState.resizeGrid(5, 5);
	});

	it('loads a new trace synchronously without autoplay', () => {
		const executionId = environmentState.runAlgorithm();

		expect(executionId).toBe(executionStore.activeId);
		expect(playbackState.hasLoadedTrace).toBe(true);
		expect(playbackState.isIdle).toBe(true);
		expect(playbackState.currentStep).toBe(0);
		expect(playbackState.totalSteps).toBe(executionStore.activeExecution?.trace.length);
		expect(frames.size).toBe(0);

		playbackState.step();
		expect(playbackState.currentStep).toBe(1);
		expect(playbackState.isPaused).toBe(true);
	});

	it('supports explicit autoplay and step modes', () => {
		environmentState.runAlgorithm('autoplay');
		expect(playbackState.isRunning).toBe(true);
		expect(frames.size).toBe(1);

		invalidatePlaybackIfNeeded();
		expect(playbackState.isIdle).toBe(true);
		expect(playbackState.hasLoadedTrace).toBe(false);
		expect(frames.size).toBe(0);

		environmentState.runAlgorithm('step');
		expect(playbackState.currentStep).toBe(1);
		expect(playbackState.isPaused).toBe(true);
		expect(frames.size).toBe(0);
	});

	it('keeps comparison playback synchronized and reset replayable', () => {
		environmentState.runAlgorithm();
		executionStore.isComparing = true;
		environmentState.runAlgorithm('step');

		expect(playbackState.currentStep).toBe(1);
		expect(comparePlaybackState.currentStep).toBe(1);
		expect(playbackState.isPaused).toBe(true);
		expect(comparePlaybackState.isPaused).toBe(true);

		playbackState.play();
		comparePlaybackState.play();
		expect(playbackState.isRunning).toBe(true);
		expect(comparePlaybackState.isRunning).toBe(true);
		playbackState.pause();
		comparePlaybackState.pause();
		expect(playbackState.isPaused).toBe(true);
		expect(comparePlaybackState.isPaused).toBe(true);

		const activeTotal = playbackState.totalSteps;
		const compareTotal = comparePlaybackState.totalSteps;
		playbackState.reset();
		comparePlaybackState.reset();
		expect(playbackState.isIdle).toBe(true);
		expect(comparePlaybackState.isIdle).toBe(true);
		expect(playbackState.totalSteps).toBe(activeTotal);
		expect(comparePlaybackState.totalSteps).toBe(compareTotal);
		expect(frames.size).toBe(0);

		invalidatePlaybackIfNeeded();
		expect(playbackState.hasLoadedTrace).toBe(false);
		expect(comparePlaybackState.hasLoadedTrace).toBe(false);
		expect(executionStore.activeId).toBeNull();
		expect(executionStore.compareId).toBeNull();
		expect(executionStore.isComparing).toBe(false);
		expect(frames.size).toBe(0);
	});

	it('invalidates active and comparison traces on environment changes', () => {
		environmentState.runAlgorithm('step');
		executionStore.isComparing = true;
		environmentState.runAlgorithm('step');
		expect(playbackState.hasLoadedTrace).toBe(true);
		expect(comparePlaybackState.hasLoadedTrace).toBe(true);

		environmentState.environmentType = 'blank';

		expect(playbackState.hasLoadedTrace).toBe(false);
		expect(comparePlaybackState.hasLoadedTrace).toBe(false);
		expect(playbackState.isIdle).toBe(true);
		expect(comparePlaybackState.isIdle).toBe(true);
		expect(executionStore.activeId).toBeNull();
		expect(executionStore.compareId).toBeNull();
	});

	it('invalidates traces on algorithm changes', () => {
		environmentState.runAlgorithm('step');
		expect(playbackState.hasLoadedTrace).toBe(true);

		environmentState.selectedAlgorithmId = 'astar';

		expect(playbackState.hasLoadedTrace).toBe(false);
		expect(playbackState.isIdle).toBe(true);
		expect(executionStore.activeId).toBeNull();
	});
});
