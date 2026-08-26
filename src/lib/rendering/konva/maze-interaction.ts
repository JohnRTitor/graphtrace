import type { KonvaEventObject } from 'konva/lib/Node';
import type { NodeId } from '$lib/graph/types';
import type { EditorState } from '$lib/state/editor.svelte';
import type { EnvironmentState } from '$lib/state/environment.svelte';

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

		const pointerPosition = stage.getPointerPosition();
		if (!pointerPosition) return null;

		const transform = stage.getAbsoluteTransform().copy();
		transform.invert();
		const pos = transform.point(pointerPosition);

		const col = Math.floor(pos.x / this.cellSize);
		const row = Math.floor(pos.y / this.cellSize);

		// Boundaries are checked inside environment state methods, but we can do a quick check
		return `${row},${col}`;
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

		if (mode === 'wall') {
			environmentState.setGridWall(cellId, true);
		} else if (mode === 'erase') {
			environmentState.setGridWall(cellId, false);
		} else if (mode === 'start') {
			environmentState.setGridStart(cellId);
		} else if (mode === 'goal') {
			environmentState.setGridGoal(cellId);
		} else if (mode === 'weight') {
			environmentState.setGridWeight(cellId, editorState.weightValue);
		}
	}
}
