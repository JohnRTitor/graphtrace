export type RenderConfig = {
	cellSize: number;
	offsetX: number;
	offsetY: number;
	width: number;
	height: number;
};

export function getRenderConfig(
	canvasWidth: number,
	canvasHeight: number,
	gridRows: number,
	gridCols: number
): RenderConfig {
	// Add a little padding so grid doesn't touch the very edges
	const padding = 20; 
	const availableWidth = Math.max(1, canvasWidth - padding * 2);
	const availableHeight = Math.max(1, canvasHeight - padding * 2);

	const cellWidth = availableWidth / gridCols;
	const cellHeight = availableHeight / gridRows;
	
	// Use the smaller dimension to keep cells square
	const cellSize = Math.floor(Math.min(cellWidth, cellHeight));
	
	// Center the grid in the canvas
	const gridPixelWidth = cellSize * gridCols;
	const gridPixelHeight = cellSize * gridRows;
	
	const offsetX = Math.floor((canvasWidth - gridPixelWidth) / 2);
	const offsetY = Math.floor((canvasHeight - gridPixelHeight) / 2);

	return {
		cellSize,
		offsetX,
		offsetY,
		width: canvasWidth,
		height: canvasHeight
	};
}

export function pixelToGrid(
	x: number,
	y: number,
	config: RenderConfig
): { row: number; col: number } | null {
	const { cellSize, offsetX, offsetY } = config;
	
	// Subtract offset
	const gridX = x - offsetX;
	const gridY = y - offsetY;
	
	// If outside the grid bounds
	if (gridX < 0 || gridY < 0) return null;
	
	const col = Math.floor(gridX / cellSize);
	const row = Math.floor(gridY / cellSize);
	
	return { row, col };
}

export function gridToPixel(
	row: number,
	col: number,
	config: RenderConfig
): { x: number; y: number } {
	const { cellSize, offsetX, offsetY } = config;
	
	return {
		x: offsetX + col * cellSize,
		y: offsetY + row * cellSize
	};
}
