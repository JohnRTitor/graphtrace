import { describe, it, expect, vi } from 'vitest';
import { PlaybackEngine } from '../../visualization/player';
import type { AlgorithmEvent } from '../../algorithms/types';

describe('PlaybackEngine equivalence invariants', () => {
	it('guarantees state equivalence after stepForward() -> stepBack() and seek() operations', () => {
		let currentState: any = null;
		
		const engine = new PlaybackEngine({
			onStateChange: (state) => {
				currentState = state;
			},
			onProgress: () => {}
		});

		// A trace for a 3-node graph with 2 steps.
		const mockTrace: AlgorithmEvent[] = [
			{
				type: 'discover',
				node: 'A',
				timestamp: 100,
				stateSnapshot: null as any
			},
			{
				type: 'expand',
				node: 'A',
				timestamp: 200,
				stateSnapshot: null as any
			}
		];

		// Load and reset
		engine.loadEvents(mockTrace);
		engine.reset();
		const initialState = structuredClone(currentState);

		// 1. stepForward() to end, then stepBack() to beginning
		engine.step(); // discover A
		engine.step(); // expand A
		expect(currentState.cellStates.get('A')).toBe('current');
		
		engine.stepBack();
		engine.stepBack();
		expect(currentState).toEqual(initialState);

		// 2. seek(1) then seek(0)
		engine.seek(1);
		expect(currentState.cellStates.get('A')).toBe('discovered');
		
		engine.seek(0);
		expect(currentState).toEqual(initialState);

		// 3. seek to end then seek to 0
		engine.seek(2);
		expect(currentState.cellStates.get('A')).toBe('current');
		engine.seek(0);
		expect(currentState).toEqual(initialState);
	});
});
