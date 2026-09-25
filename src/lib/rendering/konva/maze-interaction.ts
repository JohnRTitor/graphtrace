import type { KonvaEventObject } from 'konva/lib/Node';
import type { NodeId } from '$lib/graph/types';
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

export class MazeInteraction {
	private isDragging = false;
	private lastProcessedCell: NodeId | null = null;
	private cellSize: number;

	constructor(cellSize: number = 20) {
		this.cellSize = cellSize;
	}

	private getCellIdFromEvent(
		e: KonvaEventObject<InputEvent>,
		environmentState: EnvironmentState
	): NodeId | null {
		const stage = e.target.getStage();
		if (!stage) return null;

		return stageToCellId(
			stage,
			this.cellSize,
			environmentState.gridRows,
			environmentState.gridCols
		);
	}

	public handlePointerDown(
		e: KonvaEventObject<InputEvent>,
		editorState: EditorState,
		environmentState: EnvironmentState
	) {
		if (isNonPrimaryButton(e.evt) || isPanInput(e.evt)) return;

		const cellId = this.getCellIdFromEvent(e, environmentState);
		this.isDragging = true;
		this.lastProcessedCell = cellId;
		editorState.onPointerDown(cellId);
	}

	public handlePointerMove(
		e: KonvaEventObject<InputEvent>,
		editorState: EditorState,
		environmentState: EnvironmentState
	) {
		if (!this.isDragging || isPanInput(e.evt)) return;

		const cellId = this.getCellIdFromEvent(e, environmentState);
		if (!cellId) {
			editorState.onPointerMove(null);
			return;
		}
		if (cellId === this.lastProcessedCell) return;

		this.lastProcessedCell = cellId;
		editorState.onPointerMove(cellId);
	}

	public handlePointerUp(editorState: EditorState) {
		if (!this.isDragging) return;

		this.resetDrag();
		editorState.onPointerUp(null);
	}

	public handlePointerCancel(editorState: EditorState) {
		if (!this.isDragging) return;

		this.resetDrag();
		editorState.onPointerCancel();
	}

	private resetDrag() {
		this.isDragging = false;
		this.lastProcessedCell = null;
	}
}
