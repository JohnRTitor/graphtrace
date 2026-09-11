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
		
		const cellId = this.getCellIdFromEvent(e);
		editorState.onPointerDown(cellId);
	}

	public handlePointerMove(e: KonvaEventObject<MouseEvent | TouchEvent>, editorState: EditorState, environmentState: EnvironmentState) {
		const cellId = this.getCellIdFromEvent(e);
		editorState.onPointerMove(cellId);
	}

	public handlePointerUp(editorState: EditorState) {
		editorState.onPointerUp(null); // The actual id doesn't matter for grid up
	}


}
