import Konva from 'konva';
import type { Grid, NodeId } from '$lib/graph/types';
import type { CellVisualState, VisualizationState } from '$lib/visualization/types';
import { MazeViewport } from './maze-viewport';
import { MazeInteraction } from './maze-interaction';
import type { EditorState } from '$lib/state/editor.svelte';
import type { EnvironmentState } from '$lib/state/environment.svelte';
import { stageToCellId, viewportCoverRect } from './maze-coords';
import { tracePaletteFor } from '$lib/theme/tokens';

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
	/**
	 * The colour currently painted on each pooled rect, and the set of cells
	 * active in the latest `renderVisualization`. Both exist so a step can skip
	 * cells whose colour has not changed instead of reassigning every fill.
	 */
	private paintedStates = new Map<NodeId, string>();
	private activeCellIds = new Set<NodeId>();

	/**
	 * The Konva nodes currently drawn for each cell that has a wall or a cost.
	 *
	 * Painting a wall now repaints on every cell the pointer crosses, so this
	 * function cannot rebuild the grid each time - on a 31x41 maze that is
	 * several hundred nodes per pointermove. Instead each cell's nodes are
	 * created once and then updated in place, and a cell is only touched when
	 * its own appearance actually differs.
	 */
	private cellChrome = new Map<NodeId, { wall: Konva.Rect; cost: Konva.Text | null }>();
	private cellGroup: Konva.Group;
	private markerGroup: Konva.Group;
	private gridLines: Konva.Shape | null = null;
	private gridLinesKey = '';
	/** Which cell the start/goal outlines were last drawn for. */
	private markerStartId: NodeId | null = null;
	private markerGoalId: NodeId | null = null;

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
			fill: this.getColors().background,
			listening: false,
		});
		this.backgroundLayer.add(this.backgroundRect);
		this.environmentLayer = new Konva.Layer({ listening: false });
		this.algorithmLayer = new Konva.Layer({ listening: false });
		this.interactionLayer = new Konva.Layer();

		this.gridGroup = new Konva.Group();
		this.cellGroup = new Konva.Group();
		this.markerGroup = new Konva.Group();
		this.gridGroup.add(this.cellGroup);
		this.gridGroup.add(this.markerGroup);
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
			stroke: this.getColors().selection,
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
		// A start or goal cell already carries an outline that *means* something.
		// The selection is a cursor, not a marker, and it lives in the topmost
		// layer - so drawing it there would paint over the marker and, if it shared
		// its colour, be mistaken for one.
		if (selection.id === grid.start || selection.id === grid.goal) {
			this.selectionRect.visible(false);
			this.interactionLayer.batchDraw();
			return;
		}
		this.selectionRect.position({ x: node.col * this.cellSize, y: node.row * this.cellSize });
		// `selection`, not `path`: in both themes `path` is the solution-path green
		// and is the exact same value as `start`, so a selection drawn in it reads
		// as a start marker.
		this.selectionRect.stroke(this.getColors().selection);
		this.selectionRect.visible(true);
		this.interactionLayer.batchDraw();
	}

	public resize(width: number, height: number) {
		this.stage.width(Math.max(0, Number.isFinite(width) ? width : 0));
		this.stage.height(Math.max(0, Number.isFinite(height) ? height : 0));
		// `updateBackground` owns the hit rect's geometry: it has to be in stage-local
		// space to span the viewport, not in screen pixels.
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
		// Every painted colour is now wrong, so the diff caches have to be dropped
		// or the incremental repaint would correctly - and wrongly - skip them.
		this.paintedStates.clear();
		this.resetCellChrome();
		this.markerGroup.destroyChildren();
		this.markerStartId = null;
		this.markerGoalId = null;
		this.gridLinesKey = '';
		this.renderEnvironment(this.currentGrid);
		this.renderVisualization(this.currentVizState, this.currentGrid);
	}

	/** Throws away the drawn cell nodes so the next repaint rebuilds them. */
	private resetCellChrome() {
		for (const entry of this.cellChrome.values()) {
			entry.wall.destroy();
			entry.cost?.destroy();
		}
		this.cellChrome.clear();
	}

	public updateShowCosts(showCosts: boolean) {
		this.showCosts = showCosts;
		this.renderEnvironment(this.currentGrid);
	}

	private updateBackground() {
		const cover = viewportCoverRect(
			this.stage.x(),
			this.stage.y(),
			this.stage.scaleX(),
			this.stage.scaleY(),
			this.stage.width(),
			this.stage.height()
		);

		this.backgroundRect.position({ x: cover.x, y: cover.y });
		this.backgroundRect.width(cover.width);
		this.backgroundRect.height(cover.height);
		this.backgroundRect.fill(this.getColors().background);

		// The hit surface has to span the viewport for the same reason. Left at the
		// origin in stage-local coordinates it shrinks to a corner as soon as
		// `fitToView` scales the stage down, so pointer events stop reaching the
		// editor over most of the maze - painting looks broken while the cells
		// nearest the top-left still work.
		this.hitRect.position({ x: cover.x, y: cover.y });
		this.hitRect.width(cover.width);
		this.hitRect.height(cover.height);

		this.backgroundLayer.batchDraw();
	}

	private getColors() {
		// Konva cannot read CSS custom properties, so the canvas takes its colours
		// from the one place they are defined. See src/lib/theme/tokens.ts.
		return tracePaletteFor(this.currentTheme);
	}

	public renderEnvironment(grid: Grid | null) {
		this.currentGrid = grid;
		this.updateBackground();
		if (!grid) {
			// Empty the *contents* of the groups rather than destroying the groups:
			// `cellGroup`/`markerGroup` are long-lived and reused by the next grid.
			this.resetCellChrome();
			this.markerGroup.destroyChildren();
			this.markerStartId = null;
			this.markerGoalId = null;
			this.gridLines?.destroy();
			this.gridLines = null;
			this.gridLinesKey = '';
			this.algoCellRects.forEach((rect) => rect.destroy());
			this.algoCellRects.clear();
			// A new grid invalidates every painted colour, so the diff cache has to be
			// dropped with the rects it describes.
			this.paintedStates.clear();
			this.activeCellIds.clear();
			this.selectionRect.visible(false);
			this.clearHover();
			this.environmentLayer.batchDraw();
			return;
		}

		const colors = this.getColors();

		// Update hit rect size
		this.algoCellRects.forEach((rect, id) => {
			if (!grid.nodes.has(id)) {
				rect.destroy();
				this.algoCellRects.delete(id);
				this.paintedStates.delete(id);
			}
		});

		// Draw walls and weights, diffed against what is already on the canvas.
		// A drag repaints per cell, so rebuilding every node here would make
		// painting feel like dragging through treacle.
		const cs = this.cellSize;
		const chrome = this.cellChrome;

		for (const [id, cell] of grid.nodes) {
			const needsFill = !cell.walkable || cell.cost !== 1;
			let entry = chrome.get(id);

			if (!needsFill) {
				if (entry) {
					entry.wall.destroy();
					entry.cost?.destroy();
					chrome.delete(id);
				}
				continue;
			}

			if (!entry) {
				entry = { wall: new Konva.Rect({ width: cs, height: cs }), cost: null };
				this.cellGroup.add(entry.wall);
				chrome.set(id, entry);
			}

			entry.wall.position({ x: cell.col * cs, y: cell.row * cs });
			const fill = cell.walkable ? colors.surface : colors.barrier;
			if (entry.wall.fill() !== fill) entry.wall.fill(fill);

			const wantCost = cell.walkable && cell.cost !== 1 && this.showCosts;
			if (wantCost) {
				if (!entry.cost) {
					entry.cost = new Konva.Text({
						x: cell.col * cs,
						y: cell.row * cs + cs / 2 - 6,
						width: cs,
						fontSize: 10,
						fontFamily: 'sans-serif',
						align: 'center',
					});
					this.cellGroup.add(entry.cost);
				}
				const label = cell.cost.toString();
				if (entry.cost.text() !== label) entry.cost.text(label);
				if (entry.cost.fill() !== colors.mutedText) entry.cost.fill(colors.mutedText);
			} else if (entry.cost) {
				entry.cost.destroy();
				entry.cost = null;
			}
		}

		// Cells that no longer exist (a resize, or a clear).
		for (const [id, entry] of chrome) {
			if (!grid.nodes.has(id)) {
				entry.wall.destroy();
				entry.cost?.destroy();
				chrome.delete(id);
			}
		}

		// Start and goal outlines live in their own group so moving a marker
		// re-draws two nodes rather than the whole grid.
		if (this.markerStartId !== grid.start || this.markerGoalId !== grid.goal) {
			this.markerGroup.destroyChildren();
			this.markerStartId = grid.start;
			this.markerGoalId = grid.goal;
			const markersCoincide = grid.start === grid.goal;

			if (grid.start !== null) {
				const cell = grid.nodes.get(grid.start);
				if (cell) {
					this.markerGroup.add(
						new Konva.Rect({
							x: cell.col * cs,
							y: cell.row * cs,
							width: cs,
							height: cs,
							stroke: colors.start,
							lineWidth: markersCoincide ? 1 : 2,
							dash: markersCoincide ? [4, 2] : undefined,
						})
					);
				}
			}
			if (grid.goal !== null) {
				const cell = grid.nodes.get(grid.goal);
				if (cell) {
					this.markerGroup.add(
						new Konva.Rect({
							x: cell.col * cs,
							y: cell.row * cs,
							width: cs,
							height: cs,
							stroke: colors.goal,
							lineWidth: 2,
						})
					);
				}
			}
		}

		// Grid lines depend only on the dimensions and the theme.
		const linesKey = `${grid.rows}x${grid.cols}x${cs}x${this.currentTheme}`;
		if (linesKey !== this.gridLinesKey) {
			this.gridLinesKey = linesKey;
			this.gridLines?.destroy();
			const gridWidth = grid.cols * cs;
			const gridHeight = grid.rows * cs;
			this.gridLines = new Konva.Shape({
				sceneFunc: (context, shape) => {
					context.beginPath();
					for (let i = 0; i <= grid.cols; i++) {
						context.moveTo(i * cs, 0);
						context.lineTo(i * cs, gridHeight);
					}
					for (let j = 0; j <= grid.rows; j++) {
						context.moveTo(0, j * cs);
						context.lineTo(gridWidth, j * cs);
					}
					context.strokeStyle = colors.structure;
					context.lineWidth = 1;
					context.stroke();
				},
			});
			this.gridGroup.add(this.gridLines);
		}

		this.environmentLayer.batchDraw();
	}

	public renderVisualization(vizState: VisualizationState | null, grid: Grid | null) {
		this.currentVizState = vizState;
		if (!grid) return;

		const colors = this.getColors();
		const painted = this.paintedStates;
		const activeIds = this.activeCellIds;
		activeIds.clear();

		// If vizState is empty, hide all algo rects
		if (!vizState || vizState.cellStates.size === 0) {
			this.algoCellRects.forEach((rect) => rect.hide());
			painted.clear();
			this.algorithmLayer.batchDraw();
			return;
		}

		/*
		 * Diff against what is already on the canvas.
		 *
		 * The previous version walked every entry in `cellStates` on every step and
		 * reassigned `fill` on each rect, which dirties Konva's scene graph whether or
		 * not the colour actually changed. On a 30x40 grid that is ~700 string
		 * assignments and a layer redraw per step, at up to 2000 steps/second. A
		 * typical step changes one to three cells, so the diff turns a per-step
		 * O(cells) redraw into an O(changed) one.
		 */
		for (const [id, state] of vizState.cellStates) {
			const node = grid.nodes.get(id);
			if (!node) continue;
			activeIds.add(id);

			const cellState: CellVisualState = state;
			let fill = '';
			if (cellState === 'current') fill = colors.current;
			else if (cellState === 'discovered' || cellState === 'expanded' || cellState === 'path') {
				fill =
					cellState === 'path'
						? colors.path
						: cellState === 'expanded'
							? colors.visited
							: colors.frontier;
			}

			if (!fill) {
				// No visual state for this cell: hide it without touching anything else.
				const existing = this.algoCellRects.get(id);
				if (existing && existing.isVisible()) existing.hide();
				painted.delete(id);
				continue;
			}

			// Already painted with exactly this colour: nothing to do at all.
			if (painted.get(id) === fill) continue;
			painted.set(id, fill);

			let rect = this.algoCellRects.get(id);
			if (!rect) {
				rect = new Konva.Rect({
					x: node.col * this.cellSize,
					y: node.row * this.cellSize,
					width: this.cellSize,
					height: this.cellSize
				});
				this.algoGroup.add(rect);
				this.algoCellRects.set(id, rect);
			}

			rect.fill(fill);
			rect.show();
		}

		// Hide rects that are no longer active
		for (const [id, rect] of this.algoCellRects) {
			if (!activeIds.has(id) && rect.isVisible()) {
				rect.hide();
				painted.delete(id);
			}
		}

		this.algorithmLayer.batchDraw();
	}

	public destroy() {
		this.algoCellRects.clear();
		this.paintedStates.clear();
		this.activeCellIds.clear();
		this.resetCellChrome();
		this.currentGrid = null;
		this.currentVizState = null;
		this.stage.destroy();
	}
}
