import { describe, it, expect, beforeEach, vi } from 'vitest';
import { environmentState } from '../environment.svelte';
import { playbackState } from '../playback.svelte';
import { invalidatePlaybackIfNeeded } from '../invalidate';

// The playback engine schedules its ticking via requestAnimationFrame, which
// isn't present in the default (non-jsdom) vitest environment. Polyfilling
// it lets us drive playback into a non-idle state the same way the app does,
// without pulling in a full DOM environment for these otherwise-pure tests.
beforeEach(() => {
	vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
		return setTimeout(() => cb(performance.now()), 0) as unknown as number;
	});
	vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
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

describe('invalidatePlaybackIfNeeded', () => {
	it('resets a running/completed playback but leaves an idle one alone', async () => {
		expect(playbackState.isIdle).toBe(true);

		// No-op on an already-idle playback.
		invalidatePlaybackIfNeeded();
		expect(playbackState.isIdle).toBe(true);

		(playbackState as any).engine.loadEvents(
			[{ type: 'expand', nodeId: 'x' } as any]
		);
		playbackState.play();
		expect(playbackState.isIdle).toBe(false);

		invalidatePlaybackIfNeeded();
		expect(playbackState.isIdle).toBe(true);
	});
});
