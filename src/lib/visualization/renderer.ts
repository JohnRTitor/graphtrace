import type { Grid } from '../graph/types';
import type { VisualizationState } from './types';
import { getThemePalette, type ColorPalette } from './colors';
import { getRenderConfig, gridToPixel, type RenderConfig } from './coordinates';

export type RendererOptions = {
	showCosts?: boolean;
};

export class CanvasRenderer {
	private ctx: CanvasRenderingContext2D;
	private config: RenderConfig = { cellSize: 0, offsetX: 0, offsetY: 0, width: 0, height: 0 };
	private palette: ColorPalette = getThemePalette();

	constructor(private canvas: HTMLCanvasElement) {
		const context = canvas.getContext('2d', { alpha: false });
		if (!context) throw new Error('Could not get 2D context');
		this.ctx = context;
	}

	resize(width: number, height: number, gridRows: number, gridCols: number): RenderConfig {
		// Handle high-DPI displays
		const dpr = window.devicePixelRatio || 1;
		
		this.canvas.width = width * dpr;
		this.canvas.height = height * dpr;
		this.canvas.style.width = `${width}px`;
		this.canvas.style.height = `${height}px`;
		
		this.ctx.scale(dpr, dpr);
		
		this.config = getRenderConfig(width, height, gridRows, gridCols);
		return this.config;
	}

	render(grid: Grid, state: VisualizationState, options: RendererOptions = {}): void {
		const { rows, cols, start, goal } = grid;
		const { cellSize, offsetX, offsetY, width, height } = this.config;
		
		// Update palette in case theme changed
		this.palette = getThemePalette();

		// Clear background
		this.ctx.fillStyle = this.palette.empty;
		this.ctx.fillRect(0, 0, width, height);

		// Draw grid cells
		for (const node of grid.nodes.values()) {
			const { row, col, id, walkable, weight } = node;
			const { x, y } = gridToPixel(row, col, this.config);
			
			// Determine cell color based on visualization state and grid properties
			let fillColor = this.palette.empty;
			let isSpecial = false;
			
			const visState = state.cellStates.get(id);

			if (id === start) {
				fillColor = this.palette.start;
				isSpecial = true;
			} else if (id === goal) {
				fillColor = this.palette.goal;
				isSpecial = true;
			} else if (!walkable) {
				fillColor = this.palette.wall;
				isSpecial = true;
			} else if (visState === 'path') {
				fillColor = this.palette.path;
			} else if (visState === 'current') {
				fillColor = this.palette.current;
			} else if (visState === 'expanded') {
				fillColor = this.palette.expanded;
			} else if (visState === 'discovered') {
				fillColor = this.palette.discovered;
			} else if (weight > 1) {
				// Base color for weighted cells - slightly darker than empty
				// We can blend it or use a specific color if needed
				// For now, just render the cell normally and we'll draw the text
			}

			// Draw cell fill
			if (fillColor !== this.palette.empty || weight > 1) {
				this.ctx.fillStyle = fillColor;
				
				// Draw slightly smaller to leave a grid line
				// For walls and path, fill the whole thing
				if (isSpecial || visState === 'path') {
					this.ctx.fillRect(x, y, cellSize, cellSize);
				} else {
					this.ctx.fillRect(x + 1, y + 1, cellSize - 1, cellSize - 1);
				}
			}

			// Draw weight text if applicable
			if (weight > 1 && !isSpecial && cellSize > 15) {
				this.ctx.fillStyle = this.palette.weightText;
				this.ctx.font = `${Math.max(8, cellSize * 0.4)}px sans-serif`;
				this.ctx.textAlign = 'center';
				this.ctx.textBaseline = 'middle';
				this.ctx.fillText(weight.toString(), x + cellSize / 2, y + cellSize / 2);
			}

			// Draw A* costs if enabled and cell is large enough
			if (options.showCosts && cellSize > 40 && state.costData.has(id) && !isSpecial && visState !== 'path') {
				const costs = state.costData.get(id)!;
				
				this.ctx.fillStyle = this.palette.weightText;
				
				// f-score (top left)
				if (costs.f !== undefined) {
					this.ctx.font = `bold ${Math.max(8, cellSize * 0.25)}px sans-serif`;
					this.ctx.textAlign = 'left';
					this.ctx.textBaseline = 'top';
					this.ctx.fillText(costs.f.toString(), x + 4, y + 4);
				}
				
				// g-score (bottom left)
				if (costs.g !== undefined) {
					this.ctx.font = `${Math.max(8, cellSize * 0.2)}px sans-serif`;
					this.ctx.textAlign = 'left';
					this.ctx.textBaseline = 'bottom';
					this.ctx.fillText(costs.g.toString(), x + 4, y + cellSize - 4);
				}
				
				// h-score (bottom right)
				if (costs.h !== undefined) {
					this.ctx.font = `${Math.max(8, cellSize * 0.2)}px sans-serif`;
					this.ctx.textAlign = 'right';
					this.ctx.textBaseline = 'bottom';
					this.ctx.fillText(costs.h.toString(), x + cellSize - 4, y + cellSize - 4);
				}
			}
		}

		// Draw grid lines
		this.ctx.strokeStyle = this.palette.gridLine;
		this.ctx.lineWidth = 1;
		this.ctx.beginPath();
		
		const gridPixelWidth = cellSize * cols;
		const gridPixelHeight = cellSize * rows;
		
		for (let r = 0; r <= rows; r++) {
			const y = offsetY + r * cellSize;
			this.ctx.moveTo(offsetX, y);
			this.ctx.lineTo(offsetX + gridPixelWidth, y);
		}
		
		for (let c = 0; c <= cols; c++) {
			const x = offsetX + c * cellSize;
			this.ctx.moveTo(x, offsetY);
			this.ctx.lineTo(x, offsetY + gridPixelHeight);
		}
		
		this.ctx.stroke();

		// Draw path overlay (thicker line connecting centers)
		if (state.pathNodes.size > 1) {
			this.ctx.strokeStyle = this.palette.path;
			this.ctx.lineWidth = Math.max(2, cellSize * 0.2);
			this.ctx.lineCap = 'round';
			this.ctx.lineJoin = 'round';
			this.ctx.beginPath();
			
			let first = true;
			// We need the path in order, which means tracking it properly.
			// Path nodes are added in reverse order in our algos (goal -> start)
			// Wait, the algos emit the whole path array in the 'path' event,
			// but state.pathNodes is a Set. We should iterate the original path array if we want to draw lines,
			// but since we only have the Set in VisualizationState, we can just highlight the cells (already done above).
			// If we want a connected line, we should probably add `pathArray: NodeId[]` to VisualizationState.
			// For now, coloring the cells is sufficient and matches classic visualizers.
		}
	}
}
