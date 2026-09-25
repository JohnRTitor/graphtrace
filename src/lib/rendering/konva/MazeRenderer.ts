import Konva from 'konva';
import type { Grid, NodeId } from '$lib/graph/types';
import type { CellVisualState, VisualizationState } from '$lib/visualization/types';
import { MazeViewport } from './maze-viewport';
import { MazeInteraction } from './maze-interaction';
import type { EditorState } from '$lib/state/editor.svelte';
import type { EnvironmentState } from '$lib/state/environment.svelte';
import { stageToCellId } from './maze-coords';

type InputEvent = MouseEvent | TouchEvent | PointerEvent;

function isNonPrimaryButton(event: InputEvent) {
	return 'button' in event && event.button !== 0;
}

function isPanInput(event: InputEvent) {
	const touchCount = 'touches' in event ? event.touches.length : 0;
	return touchCount > 1 || ('button' in event && event.button === 1);
}

export class MazeRenderer {
	private stage: Konva.Stage;
	private backgroundLayer: Konva.Layer;
	private backgroundRect: Konva.Rect;
	private environmentLayer: Konva.Layer;
	private algorithmLayer: Konva.Layer;
	private interactionLayer: Konva.Layer;

	private viewport: MazeViewport;
	private interaction: MazeInteraction;

	private cellSize = 20;
	private gridGroup: Konva.Group;
	private algoGroup: Konva.Group;
	
	// Object pooling for algo cells
	private algoCellRects: Map<NodeId, Konva.Rect> = new Map();

	private hoverRect: Konva.Rect;
	private selectionRect: Konva.Rect;
	private hitRect: Konva.Rect;

	private currentGrid: Grid | null = null;
	private currentVizState: VisualizationState | null = null;
	private currentTheme: 'light' | 'dark' = 'dark';
	private showCosts: boolean = true;

	constructor(container: HTMLDivElement) {
		this.stage = new Konva.Stage({
			container,
			width: container.clientWidth,
			height: container.clientHeight,
			pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
		});

		this.viewport = new MazeViewport(this.stage);
		this.interaction = new MazeInteraction(this.cellSize);

		this.backgroundLayer = new Konva.Layer({ listening: false });
		this.backgroundRect = new Konva.Rect({
			x: 0,
			y: 0,
			width: this.stage.width(),
			height: this.stage.height(),
			fill: this.getColors().bg,
			listening: false,
		});
		this.backgroundLayer.add(this.backgroundRect);
		this.environmentLayer = new Konva.Layer({ listening: false });
		this.algorithmLayer = new Konva.Layer({ listening: false });
		this.interactionLayer = new Konva.Layer();

		this.gridGroup = new Konva.Group();
		this.environmentLayer.add(this.gridGroup);

		this.algoGroup = new Konva.Group();
		this.algorithmLayer.add(this.algoGroup);

		this.hoverRect = new Konva.Rect({
			x: -100, y: -100,
			width: this.cellSize, height: this.cellSize,
			fill: this.getColors().hover,
			listening: false,
			visible: false,
		});
		
		this.selectionRect = new Konva.Rect({
			x: -100,
			y: -100,
			width: this.cellSize,
			height: this.cellSize,
			stroke: '#eab308',
			lineWidth: 2,
			listening: false,
			visible: false
		});

		this.hitRect = new Konva.Rect({
			x: 0, y: 0,
			width: 0, height: 0,
			fill: 'transparent',
			listening: true,
		});

		this.interactionLayer.add(this.hitRect);
		this.interactionLayer.add(this.hoverRect);
		this.interactionLayer.add(this.selectionRect);

		this.stage.add(this.backgroundLayer);
		this.stage.add(this.environmentLayer);
		this.stage.add(this.algorithmLayer);
		this.stage.add(this.interactionLayer);

		this.setupEvents();
	}

	private editorStateRef: EditorState | null = null;
	private envStateRef: EnvironmentState | null = null;
	private contextMenuHandler: ((cellId: NodeId | null) => void) | null = null;

	public setContext(editorState: EditorState, environmentState: EnvironmentState) {
		this.editorStateRef = editorState;
		this.envStateRef = environmentState;
	}

	/**
	 * Registers a callback invoked with the cell id under the pointer whenever
	 * the user right-clicks the maze (or `null` if the click landed outside
	 * the grid). Used to drive the context menu's typed target - the renderer
	 * itself has no opinion about menu contents.
	 */
	public setContextMenuHandler(handler: (cellId: NodeId | null) => void) {
		this.contextMenuHandler = handler;
	}

	private setupEvents() {
		let isPanning = false;
		let panPointerId: number | null = null;
		let lastPos = { x: 0, y: 0 };

		const beginPan = (e: Konva.KonvaEventObject<InputEvent>) => {
			if (!isPanInput(e.evt)) return;
			if ('button' in e.evt) e.evt.preventDefault();
			if (isPanning && panPointerId === e.pointerId) return;
			if (this.editorStateRef) {
				this.interaction.handlePointerCancel(this.editorStateRef);
			}
			isPanning = true;
			panPointerId = e.pointerId;
			const pos = this.stage.getPointerPosition();
			if (pos) lastPos = { x: pos.x, y: pos.y };
		};

		const endPan = (_e?: Konva.KonvaEventObject<InputEvent>) => {
			isPanning = false;
			panPointerId = null;
		};

		this.stage.on('wheel', (e) => {
			this.viewport.handleWheel(e);
			this.updateBackground();
		});

		this.hitRect.on('pointerdown', (e) => {
			if (isPanInput(e.evt)) {
				beginPan(e);
				return;
			}
			if (isNonPrimaryButton(e.evt)) {
				if (this.editorStateRef) {
					this.interaction.handlePointerCancel(this.editorStateRef);
				}
				return;
			}
			if (!this.editorStateRef || !this.envStateRef) return;
			this.interaction.handlePointerDown(e, this.editorStateRef, this.envStateRef);
		});

		this.hitRect.on('pointermove', (e) => {
			if (isPanning) return;
			this.updateHoverHighlight();
			if (!this.editorStateRef || !this.envStateRef) return;
			this.interaction.handlePointerMove(e, this.editorStateRef, this.envStateRef);
		});

		this.hitRect.on('pointerup', (e) => {
			if (isPanInput(e.evt) || isPanning) {
				endPan(e);
				return;
			}
			if (isNonPrimaryButton(e.evt)) return;
			if (this.editorStateRef) {
				this.interaction.handlePointerUp(this.editorStateRef);
			}
		});

		this.hitRect.on('pointercancel', (e) => {
			endPan(e);
			if (this.editorStateRef) {
				this.interaction.handlePointerCancel(this.editorStateRef);
			}
			this.clearHover();
		});

		this.hitRect.on('pointerout', () => {
			if (this.editorStateRef) {
				this.interaction.handlePointerCancel(this.editorStateRef);
			}
			this.clearHover();
		});

		this.stage.on('pointerdown', (e) => {
			if (isPanInput(e.evt)) {
				beginPan(e);
			}
		});

		this.stage.on('pointermove', (e) => {
			if (!isPanning) return;
			if (panPointerId !== null && e.pointerId !== panPointerId) return;
			const pos = this.stage.getPointerPosition();
			if (!pos) return;
			const dx = pos.x - lastPos.x;
			const dy = pos.y - lastPos.y;
			this.stage.x(this.stage.x() + dx);
			this.stage.y(this.stage.y() + dy);
			lastPos = { x: pos.x, y: pos.y };
			this.updateBackground();
		});

		this.stage.on('pointerup', (e) => {
			if (isNonPrimaryButton(e.evt) && this.editorStateRef) {
				this.interaction.handlePointerCancel(this.editorStateRef);
			}
			endPan(e);
		});

		this.stage.on('pointercancel', (e) => {
			endPan(e);
			if (this.editorStateRef) {
				this.interaction.handlePointerCancel(this.editorStateRef);
			}
			this.clearHover();
		});

		this.stage.on('lostpointercapture', (e) => {
			endPan(e);
			if (this.editorStateRef) {
				this.interaction.handlePointerCancel(this.editorStateRef);
			}
			this.clearHover();
		});

		this.stage.on('pointerleave', () => {
			endPan();
			if (this.editorStateRef) {
				this.interaction.handlePointerCancel(this.editorStateRef);
			}
			this.clearHover();
		});

		this.stage.on('contextmenu', (e) => {
			e.evt.preventDefault();
			endPan();
			if (this.editorStateRef) {
				this.interaction.handlePointerUp(this.editorStateRef);
			}
			this.clearHover();

			if (!this.currentGrid) {
				this.contextMenuHandler?.(null);
				return;
			}

			const cellId = stageToCellId(
				this.stage,
				this.cellSize,
				this.currentGrid.rows,
				this.currentGrid.cols
			);
			this.contextMenuHandler?.(cellId);
		});
	}

	private clearHover() {
		this.hoverRect.position({ x: -100, y: -100 });
		this.hoverRect.visible(false);
		this.interactionLayer.batchDraw();
	}

	private updateHoverHighlight() {
		if (!this.currentGrid) {
			this.clearHover();
			return;
		}

		const cellId = stageToCellId(
			this.stage,
			this.cellSize,
			this.currentGrid.rows,
			this.currentGrid.cols
		);
		if (!cellId) {
			this.clearHover();
			return;
		}

		const [row, col] = cellId.split(',').map(Number);
		this.hoverRect.position({
			x: col * this.cellSize,
			y: row * this.cellSize,
		});
		this.hoverRect.visible(true);
		this.interactionLayer.batchDraw();
	}

	public updateSelection(selection: { type: string; id: string } | null, grid: Grid | null): void {
		if (!selection || selection.type !== 'cell' || !grid) {
			this.selectionRect.visible(false);
			this.interactionLayer.batchDraw();
			return;
		}
		const node = grid.nodes.get(selection.id);
		if (!node) {
			this.selectionRect.visible(false);
			this.interactionLayer.batchDraw();
			return;
		}
		this.selectionRect.position({ x: node.col * this.cellSize, y: node.row * this.cellSize });
		this.selectionRect.stroke(this.getColors().path);
		this.selectionRect.visible(true);
		this.interactionLayer.batchDraw();
	}

	public resize(width: number, height: number) {
		this.stage.width(Math.max(0, Number.isFinite(width) ? width : 0));
		this.stage.height(Math.max(0, Number.isFinite(height) ? height : 0));
		this.hitRect.width(this.stage.width());
		this.hitRect.height(this.stage.height());
		this.updateBackground();
		this.stage.batchDraw();
	}

	public fitToView() {
		if (this.currentGrid) {
			this.viewport.fitToView(this.currentGrid.cols, this.currentGrid.rows, this.cellSize);
			this.updateBackground();
		}
	}
	
	public zoomIn() {
		this.viewport.zoomIn();
		this.updateBackground();
	}
	
	public zoomOut() {
		this.viewport.zoomOut();
		this.updateBackground();
	}

	public updateTheme(theme: 'light' | 'dark') {
		this.currentTheme = theme;
		this.hoverRect.fill(this.getColors().hover);
		this.renderEnvironment(this.currentGrid);
		this.renderVisualization(this.currentVizState, this.currentGrid);
	}

	public updateShowCosts(showCosts: boolean) {
		this.showCosts = showCosts;
		this.renderEnvironment(this.currentGrid);
	}

	private updateBackground() {
		const scaleX = Number.isFinite(this.stage.scaleX()) && this.stage.scaleX() > 0
			? this.stage.scaleX()
			: 1;
		const scaleY = Number.isFinite(this.stage.scaleY()) && this.stage.scaleY() > 0
			? this.stage.scaleY()
			: 1;
		const width = Math.max(0, Number.isFinite(this.stage.width()) ? this.stage.width() : 0);
		const height = Math.max(0, Number.isFinite(this.stage.height()) ? this.stage.height() : 0);
		this.backgroundRect.position({
			x: -this.stage.x() / scaleX,
			y: -this.stage.y() / scaleY,
		});
		this.backgroundRect.width(width / scaleX);
		this.backgroundRect.height(height / scaleY);
		this.backgroundRect.fill(this.getColors().bg);
		this.backgroundLayer.batchDraw();
	}

	private getColors() {
		return this.currentTheme === 'dark' ? {
			bg: '#000000',
			wall: '#334155',
			gridLines: '#1e293b',
			weight: '#475569',
			text: '#94a3b8',
			hover: 'rgba(255, 255, 255, 0.18)',
			start: '#22c55e',
			goal: '#ef4444',
			discovered: '#3b82f6',
			expanded: '#6366f1',
			path: '#eab308',
			current: '#d946ef',
		} : {
			bg: '#ffffff',
			wall: '#94a3b8',
			gridLines: '#e2e8f0',
			weight: '#cbd5e1',
			text: '#64748b',
			hover: 'rgba(15, 23, 42, 0.12)',
			start: '#22c55e',
			goal: '#ef4444',
			discovered: '#60a5fa',
			expanded: '#818cf8',
			path: '#facc15',
			current: '#e879f9',
		};
	}

	public renderEnvironment(grid: Grid | null) {
		this.currentGrid = grid;
		this.updateBackground();
		if (!grid) {
			this.gridGroup.destroyChildren();
			this.algoCellRects.forEach((rect) => rect.destroy());
			this.algoCellRects.clear();
			this.hitRect.width(this.stage.width());
			this.hitRect.height(this.stage.height());
			this.selectionRect.visible(false);
			this.clearHover();
			this.environmentLayer.batchDraw();
			return;
		}

		const colors = this.getColors();
		this.gridGroup.destroyChildren();

		const gridWidth = grid.cols * this.cellSize;
		const gridHeight = grid.rows * this.cellSize;

		// Update hit rect size
		this.hitRect.width(this.stage.width());
		this.hitRect.height(this.stage.height());
		this.algoCellRects.forEach((rect, id) => {
			if (!grid.nodes.has(id)) {
				rect.destroy();
				this.algoCellRects.delete(id);
			}
		});

		// Draw walls and weights
		const markersCoincide = grid.start === grid.goal;
		grid.nodes.forEach((cell, id) => {
			if (!cell.walkable || cell.cost !== 1) {
				const rect = new Konva.Rect({
					x: cell.col * this.cellSize,
					y: cell.row * this.cellSize,
					width: this.cellSize,
					height: this.cellSize,
					fill: !cell.walkable ? colors.wall : colors.weight,
				});
				this.gridGroup.add(rect);
				
				if (cell.walkable && cell.cost !== 1 && this.showCosts) {
					const text = new Konva.Text({
						x: cell.col * this.cellSize,
						y: cell.row * this.cellSize + this.cellSize / 2 - 6,
						width: this.cellSize,
						text: cell.cost.toString(),
						fontSize: 10,
						fontFamily: 'sans-serif',
						fill: colors.text,
						align: 'center',
					});
					this.gridGroup.add(text);
				}
			}
			
			// Draw start and goal borders on environment layer so they are always visible
			if (id === grid.start) {
				this.gridGroup.add(new Konva.Rect({
					x: cell.col * this.cellSize,
					y: cell.row * this.cellSize,
					width: this.cellSize,
					height: this.cellSize,
					stroke: colors.start,
					lineWidth: markersCoincide ? 1 : 2,
					dash: markersCoincide ? [4, 2] : undefined,
				}));
			}
			if (id === grid.goal) {
				this.gridGroup.add(new Konva.Rect({
					x: cell.col * this.cellSize,
					y: cell.row * this.cellSize,
					width: this.cellSize,
					height: this.cellSize,
					stroke: colors.goal,
					lineWidth: 2,
				}));
			}
		});

		// Draw grid lines
		const lines = new Konva.Shape({
			sceneFunc: (context, shape) => {
				context.beginPath();
				for (let i = 0; i <= grid.cols; i++) {
					context.moveTo(i * this.cellSize, 0);
					context.lineTo(i * this.cellSize, gridHeight);
				}
				for (let j = 0; j <= grid.rows; j++) {
					context.moveTo(0, j * this.cellSize);
					context.lineTo(gridWidth, j * this.cellSize);
				}
				context.strokeStyle = colors.gridLines;
				context.lineWidth = 1;
				context.stroke();
			},
		});
		this.gridGroup.add(lines);
		
		this.environmentLayer.batchDraw();
	}

	public renderVisualization(vizState: VisualizationState | null, grid: Grid | null) {
		this.currentVizState = vizState;
		if (!grid) return;
		
		const colors = this.getColors();
		
		// If vizState is empty, hide all algo rects
		if (!vizState || vizState.cellStates.size === 0) {
			this.algoCellRects.forEach(rect => rect.hide());
			this.algorithmLayer.batchDraw();
			return;
		}

		// Update or create rects for active cells
		const activeIds = new Set<NodeId>();

		for (const [id, state] of vizState.cellStates.entries()) {
			const node = grid.nodes.get(id);
			if (!node) continue;
			activeIds.add(id);

			const cellState: CellVisualState = state;
			let fill = '';
			if (cellState === 'current') fill = colors.current;
			else if (cellState === 'discovered' || cellState === 'expanded' || cellState === 'path') {
				fill = cellState === 'path' ? colors.path :
							  cellState === 'expanded' ? colors.expanded : colors.discovered;
			}
			
			if (!fill) {
				// Hide if no specific visual state
				if (this.algoCellRects.has(id)) {
					this.algoCellRects.get(id)!.hide();
				}
				continue;
			}

			let rect = this.algoCellRects.get(id);
			if (!rect) {
				rect = new Konva.Rect({
					x: node.col * this.cellSize,
					y: node.row * this.cellSize,
					width: this.cellSize,
					height: this.cellSize,
				});
				this.algoGroup.add(rect);
				this.algoCellRects.set(id, rect);
			}

			rect.fill(fill);
			rect.show();
			
			// If we wanted to show G/H/F costs on the grid, we could do it here
			// But text rendering per cell in large grids can be expensive.
			// Let's skip cost text for maze cells for performance, or only show it on hover.
		}

		// Hide rects that are no longer active
		this.algoCellRects.forEach((rect, id) => {
			if (!activeIds.has(id)) {
				rect.hide();
			}
		});

		this.algorithmLayer.batchDraw();
	}

	public destroy() {
		this.algoCellRects.clear();
		this.currentGrid = null;
		this.currentVizState = null;
		this.stage.destroy();
	}
}
