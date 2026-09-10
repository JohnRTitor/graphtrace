import { describe, it, expect } from 'vitest';
import { resolveCellId } from '../maze-coords';

describe('resolveCellId', () => {
	it('resolves a point to its cell id', () => {
		expect(resolveCellId(25, 45, 20, 10, 10)).toBe('2,1');
	});

	it('resolves the top-left cell', () => {
		expect(resolveCellId(0, 0, 20, 10, 10)).toBe('0,0');
	});

	it('returns null when the point is above/left of the grid', () => {
		expect(resolveCellId(-5, 10, 20, 10, 10)).toBeNull();
		expect(resolveCellId(10, -5, 20, 10, 10)).toBeNull();
	});

	it('returns null when the point is beyond the grid bounds', () => {
		// 10 cols * 20px = 200px wide; 205 is just past the last column.
		expect(resolveCellId(205, 10, 20, 10, 10)).toBeNull();
		expect(resolveCellId(10, 205, 20, 10, 10)).toBeNull();
	});

	it('stays correct under different cell sizes (zoom is applied before calling this)', () => {
		// Since callers pass already-unscaled grid-local coordinates, this
		// function itself doesn't need to know about zoom/pan - it only
		// needs to divide by cellSize consistently.
		expect(resolveCellId(99, 99, 50, 5, 5)).toBe('1,1');
	});
});
