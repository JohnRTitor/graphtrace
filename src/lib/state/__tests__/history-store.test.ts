import { describe, it, expect, vi } from 'vitest';
import { HistoryStore } from '../history-store.svelte';

describe('HistoryStore', () => {
	it('supports execute, undo, and redo', () => {
		let state = 0;
		const apply = vi.fn((cmd: number, isRedo: boolean) => { state += cmd; });
		const invert = vi.fn((cmd: number) => { state -= cmd; });

		const store = new HistoryStore<number>(apply, invert);

		expect(store.canUndo).toBe(false);
		expect(store.canRedo).toBe(false);

		// Execute
		store.execute(5);
		expect(state).toBe(5);
		expect(store.canUndo).toBe(true);
		expect(store.canRedo).toBe(false);
		expect(apply).toHaveBeenCalledWith(5, false);

		// Undo
		store.undo();
		expect(state).toBe(0);
		expect(store.canUndo).toBe(false);
		expect(store.canRedo).toBe(true);
		expect(invert).toHaveBeenCalledWith(5);

		// Redo
		store.redo();
		expect(state).toBe(5);
		expect(store.canUndo).toBe(true);
		expect(store.canRedo).toBe(false);
		expect(apply).toHaveBeenCalledWith(5, true);
	});

	it('supports skipApply in execute', () => {
		let state = 0;
		const apply = vi.fn((cmd: number, isRedo: boolean) => { state += cmd; });
		const invert = vi.fn((cmd: number) => { state -= cmd; });

		const store = new HistoryStore<number>(apply, invert);

		// Execute with skipApply (e.g. for gestures already applied visually)
		store.execute(10, true);
		expect(state).toBe(0); // apply wasn't called
		expect(apply).not.toHaveBeenCalled();
		expect(store.canUndo).toBe(true);

		// But undo still works normally
		store.undo();
		expect(state).toBe(-10); // inverted
		expect(invert).toHaveBeenCalledWith(10);
	});
});
