import type Konva from 'konva';

function finiteOr(value: number, fallback: number) {
	return Number.isFinite(value) ? value : fallback;
}

export class MazeViewport {
	private stage: Konva.Stage;
	private minScale = 0.1;
	private maxScale = 5;

	constructor(stage: Konva.Stage) {
		this.stage = stage;
	}

	private clampScale(scale: number) {
		return Math.max(this.minScale, Math.min(finiteOr(scale, this.minScale), this.maxScale));
	}

	public fitToView(gridCols: number, gridRows: number, cellSize: number, padding: number = 20) {
		const width = Math.max(0, finiteOr(this.stage.width(), 0));
		const height = Math.max(0, finiteOr(this.stage.height(), 0));
		// A zero-sized stage cannot be fitted to anything. Clamping instead would
		// produce a 0.1-scale stage with a negative offset - a canvas that looks
		// broken rather than one that waits - and the size arrives on the next
		// ResizeObserver tick, which re-fits anyway.
		if (width <= 0 || height <= 0) return false;

		const safeCellSize = Number.isFinite(cellSize) && cellSize > 0 ? cellSize : 1;
		const safeCols = Number.isFinite(gridCols) && gridCols > 0 ? gridCols : 1;
		const safeRows = Number.isFinite(gridRows) && gridRows > 0 ? gridRows : 1;
		const contentWidth = Math.max(1, finiteOr(safeCols * safeCellSize, Number.MAX_SAFE_INTEGER));
		const contentHeight = Math.max(1, finiteOr(safeRows * safeCellSize, Number.MAX_SAFE_INTEGER));
		const safePadding = Math.max(0, finiteOr(padding, 0));
		const effectivePadding = Math.min(safePadding, width / 2, height / 2);
		const availableWidth = Math.max(0, width - effectivePadding * 2);
		const availableHeight = Math.max(0, height - effectivePadding * 2);
		const scale = this.clampScale(Math.min(availableWidth / contentWidth, availableHeight / contentHeight));

		this.stage.scale({ x: scale, y: scale });

		const offsetX = (width - contentWidth * scale) / 2;
		const offsetY = (height - contentHeight * scale) / 2;

		this.stage.position({ x: offsetX, y: offsetY });
		this.stage.batchDraw();
		return true;
	}

	public handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
		const event = e.evt;
		if (!event.ctrlKey && !event.metaKey) return;
		event.preventDefault();

		const oldScale = this.clampScale(this.stage.scaleX());
		const pointer = this.stage.getPointerPosition();
		if (!pointer || !Number.isFinite(event.deltaY) || event.deltaY === 0) return;

		const mousePointTo = {
			x: (pointer.x - this.stage.x()) / oldScale,
			y: (pointer.y - this.stage.y()) / oldScale,
		};
		const direction = event.deltaY > 0 ? -1 : 1;
		const newScale = this.clampScale(direction > 0 ? oldScale * 1.05 : oldScale / 1.05);

		this.stage.scale({ x: newScale, y: newScale });

		this.stage.position({
			x: pointer.x - mousePointTo.x * newScale,
			y: pointer.y - mousePointTo.y * newScale,
		});
		this.stage.batchDraw();
	}

	/**
	 * Pinch to zoom about the midpoint of two touches.
	 *
	 * The only way to change scale on a touch device: a `wheel` event is never
	 * synthesised, so without this a phone is locked at whatever scale
	 * `fitToView` chose - unusable for painting walls in a 30x40 maze, where
	 * fit lands near 13px per cell.
	 */
	public handlePinch(scaleFactor: number, center: { x: number; y: number }) {
		if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) return;

		const oldScale = this.clampScale(this.stage.scaleX());
		const newScale = this.clampScale(oldScale * scaleFactor);
		if (newScale === oldScale) return;

		const pointTo = {
			x: (center.x - this.stage.x()) / oldScale,
			y: (center.y - this.stage.y()) / oldScale,
		};

		this.stage.scale({ x: newScale, y: newScale });
		this.stage.position({
			x: center.x - pointTo.x * newScale,
			y: center.y - pointTo.y * newScale,
		});
		this.stage.batchDraw();
	}

	public zoomIn() {
		this.zoomByCenter(1.2);
	}

	public zoomOut() {
		this.zoomByCenter(1 / 1.2);
	}

	private zoomByCenter(factor: number) {
		const oldScale = this.clampScale(this.stage.scaleX());
		const newScale = this.clampScale(oldScale * factor);
		const center = {
			x: Math.max(0, finiteOr(this.stage.width(), 0)) / 2,
			y: Math.max(0, finiteOr(this.stage.height(), 0)) / 2,
		};

		const mousePointTo = {
			x: (center.x - this.stage.x()) / oldScale,
			y: (center.y - this.stage.y()) / oldScale,
		};

		this.stage.scale({ x: newScale, y: newScale });
		this.stage.position({
			x: center.x - mousePointTo.x * newScale,
			y: center.y - mousePointTo.y * newScale,
		});
		this.stage.batchDraw();
	}
}
