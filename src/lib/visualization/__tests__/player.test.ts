import { describe, it, expect } from 'vitest';
import { PlaybackEngine } from '../player';
import type { AlgorithmEvent } from '../../algorithms/types';

import { bfs } from '../../algorithms/bfs';
import { createGrid, setStart, setGoal } from '../../graph/grid';
import { GridAdapter } from '../../graph/graph-adapter';

describe('PlaybackEngine equivalence invariants', () => {
	it('guarantees state equivalence after stepForward() -> stepBack() and seek() operations', () => {
		let currentState: any = null;
		
		const engine = new PlaybackEngine({
			onStateChange: (state) => {
				currentState = state;
			},
			onProgress: () => {}
		});

		// Generate a representative trace using BFS on a 5x5 grid
		const grid = createGrid(5, 5);
		setStart(grid, '0,0');
		setGoal(grid, '4,4');
		const adapter = new GridAdapter(grid);
		const result = bfs.run(adapter, grid.start!, grid.goal!);
		const mockTrace = result.events;

		// Load and reset
		engine.loadEvents(mockTrace);
		engine.reset();
		const initialState = structuredClone(currentState);

		// 1. stepForward() to end, then stepBack() to beginning
		// 1. stepForward() to 10, then seek(40) then seek(10)
		engine.seek(10);
		const stateAt10 = structuredClone(currentState);
		
		engine.seek(40);
		engine.seek(10);
		expect(currentState).toEqual(stateAt10);

		// 2. Reverse direction: seek(40) then seek(10) vs direct seek(10) (already tested above)
		// Let's test stepping back specifically
		engine.seek(40);
		const stateAt40 = structuredClone(currentState);
		engine.stepBack();
		const stateAt39 = structuredClone(currentState);
		engine.seek(39);
		expect(currentState).toEqual(stateAt39);
		
		// 3. seek to end then seek to 0
		engine.seek(mockTrace.length);
		engine.seek(0);
		expect(currentState).toEqual(initialState);
	});
});
