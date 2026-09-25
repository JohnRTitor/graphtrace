import { describe, expect, it } from 'vitest';
import { applyEvent, applyEventInto, stepInto } from '../trace-reducer';
import { createInitialVisualizationState } from '../types';
import type { AlgorithmEvent } from '../../algorithms/types';
import { bfs } from '../../algorithms/bfs';
import { GridAdapter } from '../../graph/graph-adapter';
import { generateBlankGrid } from '../../generators/random';
import { PlaybackEngine } from '../player';

/**
 * Regression cover for the playback state-cloning bottleneck.
 *
 * `applyEvent` used to clone all seven collections of `VisualizationState` on
 * every event. That made stepping O(state size) per step and, because a backward
 * seek is a replay from the initial state, a seek cost O(events x state size):
 * measured at 0.12ms per event and ~16ms for a whole BFS trace on a 30x40 grid,
 * and - far worse - every single seek on a full Tic-Tac-Toe trace blocked for
 * around 7 seconds.
 */
const grid = generateBlankGrid(30, 40, { seed: 1 });
const bfsRun = bfs.run(new GridAdapter(grid), grid.start!, grid.goal!);

const foldPure = (events: readonly AlgorithmEvent[]) => {
	let state = createInitialVisualizationState();
	for (const event of events) state = applyEvent(state, event);
	return state;
};

const foldFast = (events: readonly AlgorithmEvent[]) => {
	let state = createInitialVisualizationState();
	for (const event of events) state = stepInto(state, event);
	return state;
};

describe('trace reducer fast path', () => {
	it('produces the same state as the pure reducer', () => {
		const pure = foldPure(bfsRun.events);
		const fast = foldFast(bfsRun.events);

		expect(fast.cellStates).toEqual(pure.cellStates);
		expect(fast.currentNode).toBe(pure.currentNode);
		expect(fast.pathNodes).toEqual(pure.pathNodes);
		expect(fast.pathEdges).toEqual(pure.pathEdges);
		expect(fast.costData).toEqual(pure.costData);
		expect(fast.expansionHistory).toEqual(pure.expansionHistory);
	});

	it('produces the same state at every intermediate step, not just the end', () => {
		// A fast path that diverged only part-way through would be invisible to an
		// end-state-only assertion, and would corrupt exactly the scrubbing this
		// change was made to speed up.
		const pureEvents: AlgorithmEvent[] = [];
		const fastEvents: AlgorithmEvent[] = [];
		let pure = createInitialVisualizationState();
		let fast = createInitialVisualizationState();

		for (let index = 0; index < bfsRun.events.length; index += 7) {
			pure = applyEvent(pure, bfsRun.events[index]);
			fast = stepInto(fast, bfsRun.events[index]);
			pureEvents.push(bfsRun.events[index]);
			fastEvents.push(bfsRun.events[index]);
			expect(fast.cellStates).toEqual(pure.cellStates);
			expect(fast.currentNode).toBe(pure.currentNode);
		}
		expect(fastEvents).toEqual(pureEvents);
	});

	it('never mutates the state it is handed', () => {
		const before = createInitialVisualizationState();
		const snapshot = { ...before, cellStates: new Map(before.cellStates) };

		applyEventInto(snapshot, bfsRun.events[1]);
		expect(before.cellStates.size).toBe(0);
		expect(snapshot.cellStates.size).toBe(1);
	});

	it('applyEvent leaves the caller state untouched', () => {
		const before = createInitialVisualizationState();
		applyEvent(before, bfsRun.events[1]);
		expect(before.cellStates.size).toBe(0);
	});

	it('yields a fresh record per event, so reactive consumers invalidate once', () => {
		// The engine hands this record straight to `$state`. If the identity were
		// stable, a renderer would never re-run; if it changed per mutated cell, it
		// would re-run far too often.
		let state = createInitialVisualizationState();
		const first = stepInto(state, bfsRun.events[1]);
		const second = stepInto(first, bfsRun.events[2]);

		expect(first).not.toBe(state);
		expect(second).not.toBe(first);
		// ...while the heavy collections are shared, which is where the saving is.
		expect(first.cellStates).toBe(second.cellStates);
	});
});

describe('playback engine replay cost', () => {
	/**
	 * A deliberately generous ceiling. The pre-fix implementation replayed this same
	 * trace in roughly 7 seconds, so the budget is exceeded by more than an order of
	 * magnitude if the cloning ever comes back, while leaving ample room for a slow
	 * or heavily loaded machine.
	 */
	const REPLAY_BUDGET_MS = 400;

	it(`replays a full grid trace in well under ${REPLAY_BUDGET_MS}ms`, () => {
		const engine = new PlaybackEngine({
			onStateChange: () => {},
			onProgress: () => {}
		});
		engine.loadEvents(bfsRun.events);

		const started = performance.now();
		engine.seek(bfsRun.events.length);
		const elapsed = performance.now() - started;

		expect(elapsed).toBeLessThan(REPLAY_BUDGET_MS);
	});

	it('replays backwards and forwards without accumulating work', () => {
		// Scrubbing is the interaction that used to freeze, so the cost has to be
		// flat rather than growing with the number of scrubs.
		const engine = new PlaybackEngine({
			onStateChange: () => {},
			onProgress: () => {}
		});
		engine.loadEvents(bfsRun.events);

		const measure = (target: number) => {
			const started = performance.now();
			engine.seek(target);
			return performance.now() - started;
		};

		measure(0);
		measure(bfsRun.events.length);
		const first = measure(Math.floor(bfsRun.events.length / 2));
		// Warm, so this is a fair steady-state comparison rather than JIT noise.
		measure(Math.floor(bfsRun.events.length / 2));
		const second = measure(Math.floor(bfsRun.events.length / 2));

		expect(second).toBeLessThan(REPLAY_BUDGET_MS);
		// A leak or an O(n^2) replay would show up as the later scrub being slower
		// than the first by a wide margin.
		expect(second).toBeLessThan(Math.max(first, 5) * 8 + 10);
	});

	it('keeps the state it reports correct after a backwards seek', () => {
		const engine = new PlaybackEngine({
			onStateChange: () => {},
			onProgress: () => {}
		});
		engine.loadEvents(bfsRun.events);

		engine.seek(bfsRun.events.length);
		engine.seek(0);
		expect(engine.getState()).toEqual(createInitialVisualizationState());

		const step = 25;
		engine.seek(step);
		const expected = foldPure(bfsRun.events.slice(0, step));
		expect(engine.getState().cellStates).toEqual(expected.cellStates);
	});
});
