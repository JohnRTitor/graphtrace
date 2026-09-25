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
});
