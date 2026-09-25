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
