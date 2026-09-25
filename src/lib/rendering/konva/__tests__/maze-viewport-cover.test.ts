import { describe, expect, it } from 'vitest';
import { viewportCoverRect } from '../maze-coords';

/** Mirrors `MazeViewport.fitToView`. */
function fitToView(
	viewportW: number,
	viewportH: number,
	cols: number,
	rows: number,
	cellSize: number,
	padding = 20
) {
	const contentW = cols * cellSize;
	const contentH = rows * cellSize;
	const scale = Math.min(
		(viewportW - padding * 2) / contentW,
		(viewportH - padding * 2) / contentH
	);
	return {
		scale,
		x: (viewportW - contentW * scale) / 2,
		y: (viewportH - contentH * scale) / 2
	};
}

const VIEWPORTS: Array<[number, number]> = [
	[1920, 1080],
	[1200, 700],
	[800, 600],
	[400, 300],
	[320, 240]
];

describe('viewport cover rect', () => {
	/**
	 * The hit rect is a child of the stage, so it inherits the stage's scale and
	 * pan. Sizing it in screen pixels therefore does not make it cover the screen:
	 * once `fitToView` scales the stage down, a rect left at the origin collapses
	 * into a corner and pointer events stop reaching most of the maze.
	 */
	it.each(VIEWPORTS)(
		'covers every screen pixel at %ix%i, however the stage is scaled and panned',
		(vw, vh) => {
			const { scale, x, y } = fitToView(vw, vh, 40, 30, 20);
			const rect = viewportCoverRect(x, y, scale, scale, vw, vh);

			// Sample the viewport, including the far corners, and check each point
			// maps inside the rect once the stage transform is applied. The tolerance
			// absorbs the last-bit rounding of a point landing exactly on the edge.
			const eps = 1e-6;
			for (const [cx, cy] of [
				[0, 0],
				[vw, 0],
				[0, vh],
				[vw, vh],
				[vw / 2, vh / 2],
				[vw - 1, vh - 1],
				[1, vh / 2],
				[vw / 2, 1]
			]) {
				const localX = (cx - x) / scale;
				const localY = (cy - y) / scale;
				expect(
					localX >= rect.x - eps && localX <= rect.x + rect.width + eps,
					`x ${cx} -> ${localX} outside [${rect.x}, ${rect.x + rect.width}]`
				).toBe(true);
				expect(
					localY >= rect.y - eps && localY <= rect.y + rect.height + eps,
					`y ${cy} -> ${localY} outside [${rect.y}, ${rect.y + rect.height}]`
				).toBe(true);
			}
		}
	);

	it('shrinks in local units as the stage scales down, so it still covers the screen', () => {
		// A rect sized in screen pixels would be 400x300 here and cover only the
		// top-left corner; the corrected rect is larger in local units by 1/scale.
		const rect = viewportCoverRect(26.8, 20, 0.433, 0.433, 400, 300);
		expect(rect.width).toBeCloseTo(400 / 0.433, 6);
		expect(rect.height).toBeCloseTo(300 / 0.433, 6);
		expect(rect.x).toBeCloseTo(-26.8 / 0.433, 6);
	});

	it('survives a degenerate stage instead of producing NaN geometry', () => {
		for (const [x, y, sx, sy] of [
			[0, 0, 0, 0],
			[0, 0, -1, -1],
			[NaN, NaN, NaN, NaN]
		]) {
			const rect = viewportCoverRect(x, y, sx, sy, 800, 600);
			expect(Number.isFinite(rect.x)).toBe(true);
			expect(Number.isFinite(rect.y)).toBe(true);
			expect(Number.isFinite(rect.width)).toBe(true);
			expect(Number.isFinite(rect.height)).toBe(true);
			expect(rect.width).toBeGreaterThan(0);
		}
	});

	it('treats a negative stage offset correctly', () => {
		// Panning past the origin moves the local origin above/left of zero; a rect
		// hard-coded at 0 would then miss the top-left of the viewport.
		const rect = viewportCoverRect(-100, -50, 2, 2, 800, 600);
		expect(rect.x).toBe(50);
		expect(rect.y).toBe(25);
		expect(rect.width).toBe(400);
	});
});
