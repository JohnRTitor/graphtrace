import type { NodeId } from '../graph/types';
import { environmentState } from './environment.svelte';
import { invalidatePlaybackIfNeeded } from './invalidate';
import { Interactor } from '../interaction/interactor';
import { getNode, setWall, setCost, setStart, setGoal } from '../graph/grid';

export type EditMode = 'wall' | 'erase' | 'start' | 'goal' | 'cost' | 'node' | 'edge' | 'remove' | 'move';

export class EditorState {
	private _mode = $state<EditMode>('wall');
	private _costValue = $state(5); // Default cost for cost mode
	private _isDrawing = $state(false);
	
	private _interactor = new Interactor((cmd) => environmentState.executeCommand(cmd));

	// Graph mode specific states
	private _dragStartNode: NodeId | null = $state(null);
	private _edgePreviewTo: { x: number; y: number } | null = $state(null);
	private _lastProcessedCell: NodeId | null = null;
	private _nodeCount = 0;
	
	// Global Selection
	private _selection = $state<{type: 'node' | 'edge' | 'cell', id: string} | null>(null);

	get mode() { return this._mode; }
	set mode(m: EditMode) { 
		this._mode = m; 
		this._dragStartNode = null;
		this._edgePreviewTo = null;
		this._isDrawing = false;
		this._interactor.cancelGesture();
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
	
	onPointerDown(id: NodeId | null, x: number = 0, y: number = 0) {
		invalidatePlaybackIfNeeded();
		
		this._isDrawing = true;

		if (environmentState.environmentType === 'graph') {
			this.applyGraphEditDown(id, x, y);
		} else {
			this._interactor.beginGridDrag(environmentState.gridStart, environmentState.gridGoal);
			this._lastProcessedCell = null;
			if (id) {
				this._lastProcessedCell = id;
				this.applyGridEdit(id);
			}
		}
	}
	
	onPointerMove(id: NodeId | null, x: number = 0, y: number = 0) {
		if (environmentState.environmentType === 'graph') {
			this.applyGraphEditMove(id, x, y);
		} else {
			if (!this._isDrawing) return;
			if (id && id !== this._lastProcessedCell) {
				this._lastProcessedCell = id;
				this.applyGridEdit(id);
			}
		}
	}
	
	onPointerUp(id: NodeId | null, x: number = 0, y: number = 0) {
		if (environmentState.environmentType === 'graph') {
			this.applyGraphEditUp(id, x, y);
		} else {
			this._interactor.commitGridDrag();
			this._lastProcessedCell = null;
		}
		this._isDrawing = false;
		this._dragStartNode = null;
		this._edgePreviewTo = null;
	}
	
	onPointerLeave() {
		if (environmentState.environmentType !== 'graph') {
			this._interactor.commitGridDrag();
			this._lastProcessedCell = null;
		} else {
			this._interactor.cancelGesture();
		}
		this._isDrawing = false;
		this._dragStartNode = null;
		this._edgePreviewTo = null;
	}

	private applyGridEdit(id: NodeId) {
		this.selection = { type: 'cell', id };
		const node = getNode(environmentState.grid, id);
		if (!node) return;
		if (id === environmentState.gridStart || id === environmentState.gridGoal) return;

		switch (this._mode) {
			case 'wall':
				this._interactor.recordGridEdit(id, node.walkable, false, node.cost, node.cost);
				setWall(environmentState.grid, id, false);
				break;
			case 'erase':
				this._interactor.recordGridEdit(id, node.walkable, true, node.cost, 1);
				setWall(environmentState.grid, id, true);
				setCost(environmentState.grid, id, 1);
				break;
			case 'start':
				if (!node.walkable) {
					this._interactor.recordGridEdit(id, false, true, node.cost, node.cost);
					setWall(environmentState.grid, id, true);
				}
				this._interactor.setGridStart(id);
				setStart(environmentState.grid, id);
				break;
			case 'goal':
				if (!node.walkable) {
					this._interactor.recordGridEdit(id, false, true, node.cost, node.cost);
					setWall(environmentState.grid, id, true);
				}
				this._interactor.setGridGoal(id);
				setGoal(environmentState.grid, id);
				break;
			case 'cost':
				this._interactor.recordGridEdit(id, node.walkable, true, node.cost, this._costValue);
				setWall(environmentState.grid, id, true);
				setCost(environmentState.grid, id, this._costValue);
				break;
		}
	}

	private applyGraphEditDown(id: NodeId | null, x: number = 0, y: number = 0) {

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
					const node = environmentState.graph.nodes.get(id);
					if (node) this._interactor.beginGraphMove(id, node.x, node.y);
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
					// update visual state but don't record history yet
					const node = environmentState.graph.nodes.get(this._dragStartNode);
					if (node) {
						node.x = x;
						node.y = y;
					}
				}
				break;
		}
	}

	private applyGraphEditUp(id: NodeId | null, x: number, y: number) {
		switch (this._mode) {
			case 'edge':
				if (this._dragStartNode && id && id !== this._dragStartNode && !id.startsWith('edge-')) {
					environmentState.addGraphEdge(this._dragStartNode, id, this._costValue);
				} else {
					// Dragged to empty space - just connect to same node (self-loop) for now or do nothing
					environmentState.addGraphEdge(this._dragStartNode!, this._dragStartNode!, this._costValue);
				}
				break;
			case 'move':
				if (this._dragStartNode) {
					this._interactor.commitGraphMove(this._dragStartNode, x, y);
				}
				break;
		}
	}
}

export const editorState = new EditorState();
