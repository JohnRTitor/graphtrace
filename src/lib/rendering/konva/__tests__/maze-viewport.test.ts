import { describe, expect, it, vi } from 'vitest';
import type Konva from 'konva';
import { MazeViewport } from '../maze-viewport';

function createStage(width: number, height: number) {
	const state = {
		width,
		height,
		x: 0,
		y: 0,
		scaleX: 1,
		scaleY: 1,
		pointer: { x: 100, y: 100 },
		batchDraw: vi.fn(),
	};
	let stage: Konva.Stage;

	stage = {
		width: () => state.width,
		height: () => state.height,
		x: (value?: number) => {
			if (value === undefined) return state.x;
			state.x = value;
			return stage;
		},
		y: (value?: number) => {
			if (value === undefined) return state.y;
			state.y = value;
			return stage;
		},
		scaleX: () => state.scaleX,
		scaleY: () => state.scaleY,
		scale: ({ x, y }: { x: number; y: number }) => {
			state.scaleX = x;
			state.scaleY = y;
			return stage;
		},
		position: ({ x, y }: { x: number; y: number }) => {
			state.x = x;
			state.y = y;
			return stage;
		},
		getPointerPosition: () => state.pointer,
		batchDraw: state.batchDraw,
	} as unknown as Konva.Stage;

	return { stage, state };
}

function wheelEvent(overrides: Partial<WheelEvent> = {}) {
	return {
		ctrlKey: false,
		metaKey: false,
		deltaY: -1,
		preventDefault: vi.fn(),
		...overrides,
	} as unknown as WheelEvent;
}

describe('MazeViewport', () => {
	it('leaves ordinary wheel scrolling untouched', () => {
		const { stage, state } = createStage(400, 300);
		const viewport = new MazeViewport(stage);
		const event = wheelEvent();

		viewport.handleWheel({ evt: event } as unknown as Konva.KonvaEventObject<WheelEvent>);

		expect(state.scaleX).toBe(1);
		expect(state.x).toBe(0);
		expect(event.preventDefault).not.toHaveBeenCalled();
	});

	it('zooms and prevents scrolling for ctrl and meta wheels', () => {
		for (const modifier of ['ctrlKey', 'metaKey'] as const) {
			const { stage, state } = createStage(400, 300);
			const viewport = new MazeViewport(stage);
			const event = wheelEvent({ [modifier]: true });

			viewport.handleWheel({ evt: event } as unknown as Konva.KonvaEventObject<WheelEvent>);

			expect(state.scaleX).toBeCloseTo(1.05);
			expect(event.preventDefault).toHaveBeenCalledOnce();
		}
	});

	it('keeps fit-to-view finite and within scale bounds', () => {
		const { stage, state } = createStage(10, 10);
		const viewport = new MazeViewport(stage);

		viewport.fitToView(0, 0, 0, 100);

		expect(state.scaleX).toBe(0.1);
		expect(state.scaleY).toBe(0.1);
		expect(Number.isFinite(state.x)).toBe(true);
		expect(Number.isFinite(state.y)).toBe(true);
	});

	it('caps fit-to-view scale at the maximum', () => {
		const { stage, state } = createStage(1000, 1000);
		const viewport = new MazeViewport(stage);

		viewport.fitToView(1, 1, 20);

		expect(state.scaleX).toBe(5);
		expect(state.scaleY).toBe(5);
	});
	describe('resize behaviour on a phone', () => {
		/**
		 * A stage can be measured at zero size: the canvas mounts inside a flex
		 * column that has not been laid out yet, or the surface is momentarily
		 * display:none. Fitting then produced a 0.1-scale stage with a negative
		 * offset - a canvas that looks broken rather than one that waits, and that
		 * stayed broken because the resize path did not re-fit.
		 */
		it('declines to fit a zero-sized stage instead of clamping to the minimum scale', () => {
			const { stage, state } = createStage(0, 0);
			const viewport = new MazeViewport(stage);

			expect(viewport.fitToView(40, 30, 20)).toBe(false);
			expect(state.scaleX).toBe(1);
			expect(state.x).toBe(0);
			expect(state.y).toBe(0);
		});

		it('fits once the stage has a size', () => {
			const { stage, state } = createStage(400, 600);
			const viewport = new MazeViewport(stage);

			expect(viewport.fitToView(40, 30, 20)).toBe(true);
			expect(state.scaleX).toBeGreaterThan(0);
			expect(Number.isFinite(state.x)).toBe(true);
		});

		/**
		 * The only way to change scale on a touch device: no wheel event is ever
		 * synthesised, so without this a phone is locked at whatever scale
		 * fit-to-view chose - about 9px per cell in the default 30x40 grid, which
		 * is not enough to paint a wall accurately.
		 */
		it('scales about the pinch centre so the point under the fingers stays put', () => {
			const { stage, state } = createStage(400, 600);
			const viewport = new MazeViewport(stage);
			viewport.fitToView(40, 30, 20);

			const centre = { x: 200, y: 300 };
			const before = {
				x: (centre.x - state.x) / state.scaleX,
				y: (centre.y - state.y) / state.scaleY,
				scale: state.scaleX
			};

			viewport.handlePinch(2, centre);

			// The content point under the pinch centre is unmoved, and the scale
			// has grown.
			expect(state.scaleX).toBeGreaterThan(before.scale);
			expect((centre.x - state.x) / state.scaleX).toBeCloseTo(before.x, 6);
			expect((centre.y - state.y) / state.scaleY).toBeCloseTo(before.y, 6);
		});

		it('ignores a pinch with a non-positive or non-finite factor', () => {
			const { stage, state } = createStage(400, 600);
			const viewport = new MazeViewport(stage);
			viewport.fitToView(40, 30, 20);
			const scale = state.scaleX;

			viewport.handlePinch(0, { x: 200, y: 300 });
			viewport.handlePinch(-2, { x: 200, y: 300 });
			viewport.handlePinch(Number.NaN, { x: 200, y: 300 });

			expect(state.scaleX).toBe(scale);
		});
	});
});
