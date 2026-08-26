import Konva from 'konva';

export class MazeViewport {
	private stage: Konva.Stage;
	private minScale = 0.1;
	private maxScale = 5;

	constructor(stage: Konva.Stage) {
		this.stage = stage;
	}

	public fitToView(gridCols: number, gridRows: number, cellSize: number, padding: number = 20) {
		const width = this.stage.width();
		const height = this.stage.height();

		const contentWidth = gridCols * cellSize;
		const contentHeight = gridRows * cellSize;

		const scaleX = (width - padding * 2) / contentWidth;
		const scaleY = (height - padding * 2) / contentHeight;
		const scale = Math.min(scaleX, scaleY, this.maxScale); // Cap max scale at initial zoom

		this.stage.scale({ x: scale, y: scale });

		const offsetX = (width - contentWidth * scale) / 2;
		const offsetY = (height - contentHeight * scale) / 2;

		this.stage.position({ x: offsetX, y: offsetY });
		this.stage.batchDraw();
	}

	public handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
		e.evt.preventDefault();
		
		// Only zoom on Ctrl+Wheel or Pinch-to-zoom (which often maps to Ctrl+Wheel in browsers)
		// Or if we want default wheel to zoom:
		
		const scaleBy = 1.05;
		const oldScale = this.stage.scaleX();

		const pointer = this.stage.getPointerPosition();
		if (!pointer) return;

		const mousePointTo = {
			x: (pointer.x - this.stage.x()) / oldScale,
			y: (pointer.y - this.stage.y()) / oldScale,
		};

		let direction = e.evt.deltaY > 0 ? -1 : 1;
		if (e.evt.ctrlKey) {
			direction = -direction;
		}

		let newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
		
		newScale = Math.max(this.minScale, Math.min(newScale, this.maxScale));

		this.stage.scale({ x: newScale, y: newScale });

		const newPos = {
			x: pointer.x - mousePointTo.x * newScale,
			y: pointer.y - mousePointTo.y * newScale,
		};
		this.stage.position(newPos);
		this.stage.batchDraw();
	}

	public zoomIn() {
		this.zoomByCenter(1.2);
	}

	public zoomOut() {
		this.zoomByCenter(1 / 1.2);
	}

	private zoomByCenter(factor: number) {
		const oldScale = this.stage.scaleX();
		let newScale = oldScale * factor;
		newScale = Math.max(this.minScale, Math.min(newScale, this.maxScale));

		const center = {
			x: this.stage.width() / 2,
			y: this.stage.height() / 2,
		};

		const mousePointTo = {
			x: (center.x - this.stage.x()) / oldScale,
			y: (center.y - this.stage.y()) / oldScale,
		};

		this.stage.scale({ x: newScale, y: newScale });

		const newPos = {
			x: center.x - mousePointTo.x * newScale,
			y: center.y - mousePointTo.y * newScale,
		};
		this.stage.position(newPos);
		this.stage.batchDraw();
	}

	public getTransform() {
		return {
			x: this.stage.x(),
			y: this.stage.y(),
			scale: this.stage.scaleX()
		};
	}
}
