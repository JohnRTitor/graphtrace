import type { NodeId } from '../graph/types';
import { environmentState } from './environment.svelte';
import { playbackState } from './playback.svelte';

export type EditMode = 'wall' | 'erase' | 'start' | 'goal' | 'cost' | 'node' | 'edge' | 'remove' | 'move';

export class EditorState {
	private _mode = $state<EditMode>('wall');
	private _costValue = $state(5); // Default cost for cost mode
	private _isDrawing = $state(false);

	// Graph mode specific states
	private _dragStartNode = $state<string | null>(null);
	private _edgePreviewTo = $state<{x: number, y: number} | null>(null);
	private _nodeCount = 0;
	
	// Global Selection
	private _selection = $state<{type: 'node' | 'edge' | 'cell', id: string} | null>(null);

	get mode() { return this._mode; }
	set mode(m: EditMode) { 
		this._mode = m; 
		this._dragStartNode = null;
		this._edgePreviewTo = null;
		this._isDrawing = false;
	}
	
	get costValue() { return this._costValue; }
	set costValue(w: number) { this._costValue = Math.max(1, w); }

	get isDrawing() { return this._isDrawing; }
	
	get selection() { return this._selection; }
	set selection(s) { this._selection = s; }

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
			environmentState.beginGridBatch();
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
		} else {
			environmentState.commitGridBatch();
		}
		this._isDrawing = false;
		this._dragStartNode = null;
		this._edgePreviewTo = null;
	}
	
	onPointerLeave() {
		if (environmentState.environmentType !== 'graph') {
			environmentState.commitGridBatch();
		}
		this._isDrawing = false;
		this._dragStartNode = null;
		this._edgePreviewTo = null;
	}

	private applyGridEdit(id: NodeId) {
		this.selection = { type: 'cell', id };
		switch (this._mode) {
			case 'wall':
				environmentState.setGridWall(id, true);
				break;
			case 'erase':
				environmentState.setGridWall(id, false);
				environmentState.setGridCost(id, 1);
				break;
			case 'start':
				environmentState.setGridStart(id);
				break;
			case 'goal':
				environmentState.setGridGoal(id);
				break;
			case 'cost':
				environmentState.setGridWall(id, false);
				environmentState.setGridCost(id, this._costValue);
				break;
		}
	}

	private applyGraphEditDown(id: NodeId | null, x: number, y: number) {
		if (id) {
			this.selection = { type: id.startsWith('edge-') ? 'edge' : 'node', id };
		} else {
			this.selection = null;
		}
		
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
			case 'cost':
				if (id && id.startsWith('edge-')) {
					environmentState.setGraphWeight(id, this._costValue);
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
					environmentState.addGraphEdge(this._dragStartNode, id, this._costValue);
				} else {
					// Dragged to empty space - just connect to same node (self-loop) for now or do nothing
					environmentState.addGraphEdge(this._dragStartNode!, this._dragStartNode!, this._costValue);
				}
				break;
		}
	}
}

export const editorState = new EditorState();
