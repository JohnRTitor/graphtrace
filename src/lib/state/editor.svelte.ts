import type { NodeId } from '../graph/types';
import { gridState } from './grid.svelte';
import { playbackState } from './playback.svelte';

export type EditMode = 'wall' | 'erase' | 'start' | 'goal' | 'weight';

export class EditorState {
	private _mode = $state<EditMode>('wall');
	private _weightValue = $state(5); // Default weight for weighted mode
	private _isDrawing = $state(false);

	get mode() { return this._mode; }
	set mode(m: EditMode) { this._mode = m; }
	
	get weightValue() { return this._weightValue; }
	set weightValue(w: number) { this._weightValue = Math.max(1, w); }

	get isDrawing() { return this._isDrawing; }

	// Canvas Interaction Handlers
	
	onPointerDown(id: NodeId) {
		this._isDrawing = true;
		this.applyEdit(id);
	}
	
	onPointerMove(id: NodeId) {
		if (!this._isDrawing) return;
		this.applyEdit(id);
	}
	
	onPointerUp() {
		this._isDrawing = false;
	}
	
	onPointerLeave() {
		this._isDrawing = false;
	}

	private applyEdit(id: NodeId) {
		// If playback is not idle, editing should reset it
		if (!playbackState.isIdle) {
			playbackState.reset();
		}

		switch (this._mode) {
			case 'wall':
				gridState.setWall(id, true);
				break;
			case 'erase':
				gridState.setWall(id, false);
				gridState.setWeight(id, 1);
				break;
			case 'start':
				gridState.setStart(id);
				break;
			case 'goal':
				gridState.setGoal(id);
				break;
			case 'weight':
				gridState.setWall(id, false); // weights imply walkable
				gridState.setWeight(id, this._weightValue);
				break;
		}
	}
}

export const editorState = new EditorState();
