import Konva from 'konva';
import type { Grid, GridCell, NodeId } from '$lib/graph/types';
import type { VisualizationState } from '$lib/visualization/types';
import { MazeViewport } from './maze-viewport';
import { MazeInteraction } from './maze-interaction';
import type { EditorState } from '$lib/state/editor.svelte';
import type { EnvironmentState } from '$lib/state/environment.svelte';
import { stageToCellId } from './maze-coords';

export class MazeRenderer {
	private stage: Konva.Stage;
	private backgroundLayer: Konva.Layer;
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
		});

		this.viewport = new MazeViewport(this.stage);
		this.interaction = new MazeInteraction(this.cellSize);

		this.backgroundLayer = new Konva.Layer();
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
			fill: 'rgba(255, 255, 255, 0.2)',
			listening: false,
		});
		
		this.hitRect = new Konva.Rect({
			x: 0, y: 0,
			width: 0, height: 0,
			fill: 'transparent',
			listening: true,
		});

		this.interactionLayer.add(this.hitRect);
		this.interactionLayer.add(this.hoverRect);

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
		this.stage.on('wheel', (e) => {
			this.viewport.handleWheel(e);
		});

		this.hitRect.on('pointerdown', (e) => {
			if (!this.editorStateRef || !this.envStateRef) return;
			this.interaction.handlePointerDown(e, this.editorStateRef, this.envStateRef);
		});

		this.hitRect.on('pointermove', (e) => {
			this.updateHoverHighlight(e);
			if (!this.editorStateRef || !this.envStateRef) return;
			this.interaction.handlePointerMove(e, this.editorStateRef, this.envStateRef);
		});

		this.hitRect.on('pointerup', () => {
			this.interaction.handlePointerUp();
		});

		this.hitRect.on('pointerout', () => {
			this.interaction.handlePointerUp();
			this.hoverRect.position({ x: -100, y: -100 });
			this.interactionLayer.batchDraw();
		});
		
		// Pan logic (middle click). Right click is reserved for the context
		// menu and must never start a pan or paint - see setupContextMenu().
		let isPanning = false;
		let lastPos = { x: 0, y: 0 };
		
		this.stage.on('pointerdown', (e) => {
			if (e.evt instanceof MouseEvent && e.evt.button === 1) {
				isPanning = true;
				const pos = this.stage.getPointerPosition();
				if (pos) lastPos = pos;
			}
		});

		this.stage.on('pointermove', (e) => {
			if (isPanning) {
				const pos = this.stage.getPointerPosition();
				if (!pos) return;
				const dx = pos.x - lastPos.x;
				const dy = pos.y - lastPos.y;
				this.stage.x(this.stage.x() + dx);
				this.stage.y(this.stage.y() + dy);
				this.stage.batchDraw();
				lastPos = pos;
			}
		});

		this.stage.on('pointerup', () => {
			isPanning = false;
		});

		this.stage.on('contextmenu', (e) => {
			// Suppress the native browser menu and stop the pan/paint logic
			// above from reacting to this pointer sequence; the shadcn-svelte
			// ContextMenu, wired up by the wrapping Trigger in MazeCanvas.svelte,
			// owns the resulting UI.
			e.evt.preventDefault();
			isPanning = false;

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

	private updateHoverHighlight(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
		const stage = e.target.getStage();
		if (!stage || !this.currentGrid) return;
		const pointerPosition = stage.getPointerPosition();
		if (!pointerPosition) return;

		const transform = stage.getAbsoluteTransform().copy();
		transform.invert();
		const pos = transform.point(pointerPosition);

		const col = Math.floor(pos.x / this.cellSize);
		const row = Math.floor(pos.y / this.cellSize);

		if (row >= 0 && row < this.currentGrid.rows && col >= 0 && col < this.currentGrid.cols) {
			this.hoverRect.position({
				x: col * this.cellSize,
				y: row * this.cellSize,
			});
			this.interactionLayer.batchDraw();
		}
	}

	public resize(width: number, height: number) {
		this.stage.width(width);
		this.stage.height(height);
		this.stage.batchDraw();
	}

	public fitToView() {
		if (this.currentGrid) {
			this.viewport.fitToView(this.currentGrid.cols, this.currentGrid.rows, this.cellSize);
		}
	}
	
	public zoomIn() {
		this.viewport.zoomIn();
	}
	
	public zoomOut() {
		this.viewport.zoomOut();
	}

	public updateTheme(theme: 'light' | 'dark') {
		this.currentTheme = theme;
		this.renderEnvironment(this.currentGrid);
		this.renderVisualization(this.currentVizState, this.currentGrid);
	}

	public updateShowCosts(showCosts: boolean) {
		this.showCosts = showCosts;
		// Re-render visualization to show/hide costs
		this.renderVisualization(this.currentVizState, this.currentGrid);
	}

	private getColors() {
		return this.currentTheme === 'dark' ? {
			bg: '#000000',
			wall: '#334155',
			gridLines: '#1e293b',
			weight: '#475569',
			text: '#94a3b8',
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
		if (!grid) {
			this.gridGroup.destroyChildren();
			this.environmentLayer.batchDraw();
			return;
		}

		const colors = this.getColors();
		this.gridGroup.destroyChildren();

		const gridWidth = grid.cols * this.cellSize;
		const gridHeight = grid.rows * this.cellSize;

		// Update hit rect size
		this.hitRect.width(gridWidth);
		this.hitRect.height(gridHeight);

		// Draw walls and weights
		grid.nodes.forEach((cell, id) => {
			if (!cell.walkable || cell.cost > 1) {
				const rect = new Konva.Rect({
					x: cell.col * this.cellSize,
					y: cell.row * this.cellSize,
					width: this.cellSize,
					height: this.cellSize,
					fill: !cell.walkable ? colors.wall : colors.weight,
				});
				this.gridGroup.add(rect);
				
				if (cell.walkable && cell.cost > 1 && this.showCosts) {
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
					lineWidth: 2,
				}));
			} else if (id === grid.goal) {
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
			activeIds.add(id);
			const node = grid.nodes.get(id);
			if (!node) continue;

			const cellState = state as any;
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
		this.stage.destroy();
	}
}
