import type { KonvaEventObject } from 'konva/lib/Node';
import type { NodeId } from '$lib/graph/types';
import type { EditorState } from '$lib/state/editor.svelte';
import type { EnvironmentState } from '$lib/state/environment.svelte';
import { stageToCellIdUnchecked } from './maze-coords';

export class MazeInteraction {
	private isDragging = false;
	private lastProcessedCell: NodeId | null = null;
	private cellSize: number;

	constructor(cellSize: number = 20) {
		this.cellSize = cellSize;
	}

	public setCellSize(size: number) {
		this.cellSize = size;
	}

	private getCellIdFromEvent(e: KonvaEventObject<MouseEvent | TouchEvent>): NodeId | null {
		const stage = e.target.getStage();
		if (!stage) return null;

		// Shared with the context menu and hover highlight - do not duplicate
		// this screen -> grid transform elsewhere.
		return stageToCellIdUnchecked(stage, this.cellSize);
	}

	public handlePointerDown(e: KonvaEventObject<MouseEvent | TouchEvent>, editorState: EditorState, environmentState: EnvironmentState) {
		// Only handle left click or touch
		if (e.evt instanceof MouseEvent && e.evt.button !== 0) return;
		
		this.isDragging = true;
		this.lastProcessedCell = null;
		
		this.processInteraction(e, editorState, environmentState);
	}

	public handlePointerMove(e: KonvaEventObject<MouseEvent | TouchEvent>, editorState: EditorState, environmentState: EnvironmentState) {
		if (!this.isDragging) return;
		this.processInteraction(e, editorState, environmentState);
	}

	public handlePointerUp() {
		this.isDragging = false;
		this.lastProcessedCell = null;
	}

	private processInteraction(e: KonvaEventObject<MouseEvent | TouchEvent>, editorState: EditorState, environmentState: EnvironmentState) {
		const cellId = this.getCellIdFromEvent(e);
		if (!cellId) return;

		// Only process each cell once per drag to prevent rapid toggling
		if (this.lastProcessedCell === cellId) return;
		this.lastProcessedCell = cellId;

		const mode = editorState.mode;
		
		// Update selection
		editorState.selection = { type: 'cell', id: cellId };

		if (mode === 'wall') {
			environmentState.setGridWall(cellId, true);
		} else if (mode === 'erase') {
			environmentState.setGridWall(cellId, false);
		} else if (mode === 'start') {
			environmentState.setGridStart(cellId);
		} else if (mode === 'goal') {
			environmentState.setGridGoal(cellId);
		} else if (mode === 'cost') {
			environmentState.setGridCost(cellId, editorState.costValue);
		}
	}
}
