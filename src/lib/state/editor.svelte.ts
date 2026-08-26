import type { NodeId } from '../graph/types';
import { environmentState } from './environment.svelte';
import { playbackState } from './playback.svelte';

export type EditMode = 'wall' | 'erase' | 'start' | 'goal' | 'weight' | 'node' | 'edge' | 'remove' | 'move';

export class EditorState {
	private _mode = $state<EditMode>('wall');
	private _weightValue = $state(5); // Default weight for weighted mode
	private _isDrawing = $state(false);

	// Graph mode specific states
	private _dragStartNode = $state<string | null>(null);
	private _edgePreviewTo = $state<{x: number, y: number} | null>(null);
	private _nodeCount = 0;

	get mode() { return this._mode; }
	set mode(m: EditMode) { 
		this._mode = m; 
		this._dragStartNode = null;
		this._edgePreviewTo = null;
		this._isDrawing = false;
	}
	
	get weightValue() { return this._weightValue; }
	set weightValue(w: number) { this._weightValue = Math.max(1, w); }

	get isDrawing() { return this._isDrawing; }

	// Graph mode properties
	get dragStartNode() { return this._dragStartNode; }
	get edgePreviewTo() { return this._edgePreviewTo; }

	// Canvas Interaction Handlers
	
	onPointerDown(id: NodeId | null, x: number, y: number) {
		if (!playbackState.isIdle) {
			playbackState.reset();
		}
		
		this._isDrawing = true;

		if (environmentState.environmentType === 'graph') {
			this.applyGraphEditDown(id, x, y);
		} else {
			if (id) this.applyGridEdit(id);
		}
	}
	
	onPointerMove(id: NodeId | null, x: number, y: number) {
		if (environmentState.environmentType === 'graph') {
			this.applyGraphEditMove(id, x, y);
		} else {
			if (!this._isDrawing) return;
			if (id) this.applyGridEdit(id);
		}
	}
	
	onPointerUp(id: NodeId | null) {
		if (environmentState.environmentType === 'graph') {
			this.applyGraphEditUp(id);
		}
		this._isDrawing = false;
		this._dragStartNode = null;
		this._edgePreviewTo = null;
	}
	
	onPointerLeave() {
		this._isDrawing = false;
		this._dragStartNode = null;
		this._edgePreviewTo = null;
	}

	private applyGridEdit(id: NodeId) {
		switch (this._mode) {
			case 'wall':
				environmentState.setGridWall(id, true);
				break;
			case 'erase':
				environmentState.setGridWall(id, false);
				environmentState.setGridWeight(id, 1);
				break;
			case 'start':
				environmentState.setGridStart(id);
				break;
			case 'goal':
				environmentState.setGridGoal(id);
				break;
			case 'weight':
				environmentState.setGridWall(id, false);
				environmentState.setGridWeight(id, this._weightValue);
				break;
		}
	}

	private applyGraphEditDown(id: NodeId | null, x: number, y: number) {
		switch (this._mode) {
			case 'node':
				if (!id) {
					this._nodeCount++;
					environmentState.addGraphNode(x, y, `N${this._nodeCount}`);
				}
				break;
			case 'edge':
				if (id) {
					this._dragStartNode = id;
					this._edgePreviewTo = { x, y };
				}
				break;
			case 'remove':
				if (id) {
					// Hack: check if it's an edge (edges have format edge-xxxxxx or node id)
					if (id.startsWith('edge-')) {
						environmentState.removeGraphEdge(id);
					} else {
						environmentState.removeGraphNode(id);
					}
				}
				break;
			case 'move':
				if (id && !id.startsWith('edge-')) {
					this._dragStartNode = id;
				}
				break;
			case 'start':
				if (id && !id.startsWith('edge-')) environmentState.setGraphStart(id);
				break;
			case 'goal':
				if (id && !id.startsWith('edge-')) environmentState.setGraphGoal(id);
				break;
			case 'weight':
				if (id && id.startsWith('edge-')) {
					environmentState.setGraphWeight(id, this._weightValue);
				}
				break;
		}
	}

	private applyGraphEditMove(id: NodeId | null, x: number, y: number) {
		if (!this._isDrawing) return;

		switch (this._mode) {
			case 'edge':
				if (this._dragStartNode) {
					this._edgePreviewTo = { x, y };
				}
				break;
			case 'move':
				if (this._dragStartNode) {
					environmentState.moveGraphNode(this._dragStartNode, x, y);
				}
				break;
		}
	}

	private applyGraphEditUp(id: NodeId | null) {
		switch (this._mode) {
			case 'edge':
				if (this._dragStartNode && id && id !== this._dragStartNode && !id.startsWith('edge-')) {
					environmentState.addGraphEdge(this._dragStartNode, id, this._weightValue);
				} else if (this._dragStartNode && id === this._dragStartNode) {
					// Self loop
					environmentState.addGraphEdge(this._dragStartNode, this._dragStartNode, this._weightValue);
				}
				break;
		}
	}
}

export const editorState = new EditorState();
