import type { NodeId } from '../graph/types';
import { environmentState } from './environment.svelte';
import { invalidatePlaybackIfNeeded } from './invalidate';
import { Interactor } from '../interaction/interactor';
import { getNode } from '../graph/grid';
import { getCompatibleEditorMode, isGraphLikeEnvironment, type EditMode } from './editor-modes';

// Re-exported so the tool vocabulary has one definition while existing imports
// (`interactor.ts`, the toolbar, tests) keep working.
export {
	availableEditModes,
	getCompatibleEditorMode,
	isGraphLikeEnvironment,
	type EditMode
} from './editor-modes';

export class EditorState {
	private _mode = $state<EditMode>('wall');
	private _costValue = $state(5); // Default cost for cost mode
	private _isDrawing = $state(false);
	private _interactor = new Interactor(
		(cmd) => environmentState.executeCommand(cmd),
		(cmd) => environmentState.revertGridCommand(cmd)
	);

	// Graph mode specific states
	private _dragStartNode: NodeId | null = $state(null);
	private _edgePreviewTo: { x: number; y: number } | null = $state(null);
	private _graphMoveStart: { id: NodeId; x: number; y: number } | null = null;
	private _lastProcessedCell: NodeId | null = null;
	private _nodeCount = 0;
	
	// Global Selection
	private _selection = $state<{type: 'node' | 'edge' | 'cell', id: string} | null>(null);

	/**
	 * The active tool, guaranteed to be one the current environment handles.
	 *
	 * The invariant is enforced *here*, on read, rather than by reconciling at each
	 * place that changes the environment. Every previous attempt to do that -
	 * including one in the environment dropdown - was a rule some other code path
	 * could forget, and forgetting it is invisible: the tool strip would render
	 * with none of its buttons active, and a click on the canvas would be routed to
	 * a handler that does not exist for that environment and do nothing at all.
	 * Which is indistinguishable, to a user, from a broken wall brush.
	 *
	 * Reconciling on read also means the tool is *restored* rather than lost: a
	 * graph-only tool carried onto a grid reports the grid's default, and comes
	 * back when the graph is shown again.
	 */
	get mode(): EditMode {
		return getCompatibleEditorMode(this._mode, environmentState.environmentType);
	}

	set mode(m: EditMode) {
		this.cancelGraphMove();
		this._mode = m;
		this._dragStartNode = null;
		this._edgePreviewTo = null;
		this._isDrawing = false;
		this._interactor.cancelGridDrag();
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

		if (environmentState.isPathfindingGraph) {
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
		if (environmentState.isPathfindingGraph) {
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
		if (environmentState.isPathfindingGraph) {
			this.applyGraphEditUp(id, x, y);
		} else {
			this._interactor.commitGridDrag();
			this._lastProcessedCell = null;
		}
		this._isDrawing = false;
		this._dragStartNode = null;
		this._edgePreviewTo = null;
		this._graphMoveStart = null;
	}
	
	onPointerLeave() {
		this.cancelGraphMove();
		if (!environmentState.isPathfindingGraph) {
			this._interactor.commitGridDrag();
			this._lastProcessedCell = null;
		} else {
			this._interactor.cancelGesture();
		}
		this._isDrawing = false;
		this._dragStartNode = null;
		this._edgePreviewTo = null;
	}

	onPointerCancel() {
		if (environmentState.isPathfindingGraph) {
			this.cancelGraphMove();
			this._interactor.cancelGesture();
		} else {
			this._interactor.cancelGridDrag();
		}
		this._isDrawing = false;
		this._lastProcessedCell = null;
		this._dragStartNode = null;
		this._edgePreviewTo = null;
	}

	private applyGridEdit(id: NodeId) {
		const node = getNode(environmentState.grid, id);
		if (!node) return;
		this.selection = { type: 'cell', id };
		if (id === environmentState.gridStart || id === environmentState.gridGoal) return;

		// The resolved mode, not the raw one, so what a click does always matches
		// the tool the strip is showing.
		//
		// These go through the *live* setters rather than the raw grid mutators:
		// a drag batches its edits into one history entry and replays them on
		// commit, but the canvas still has to repaint on every cell it crosses.
		// Mutating the grid directly here is what made a dragged wall stay
		// invisible until the mouse came up.
		switch (this.mode) {
			case 'wall':
				this._interactor.recordGridEdit(id, node.walkable, false, node.cost, node.cost);
				environmentState.applyGridCellLive(id, false, node.cost);
				break;
			case 'erase':
				this._interactor.recordGridEdit(id, node.walkable, true, node.cost, 1);
				environmentState.applyGridCellLive(id, true, 1);
				break;
			case 'start':
				if (!node.walkable) {
					this._interactor.recordGridEdit(id, false, true, node.cost, node.cost);
					environmentState.applyGridCellLive(id, true, node.cost);
				}
				this._interactor.setGridStart(id);
				environmentState.setGridStartLive(id);
				break;
			case 'goal':
				if (!node.walkable) {
					this._interactor.recordGridEdit(id, false, true, node.cost, node.cost);
					environmentState.applyGridCellLive(id, true, node.cost);
				}
				this._interactor.setGridGoal(id);
				environmentState.setGridGoalLive(id);
				break;
			case 'cost':
				this._interactor.recordGridEdit(id, node.walkable, true, node.cost, this._costValue);
				environmentState.applyGridCellLive(id, true, this._costValue);
				break;
		}
	}

	private getGraphObjectType(id: NodeId | null): 'node' | 'edge' | null {
		if (id === null) return null;
		if (environmentState.graph.edges.has(id)) return 'edge';
		if (environmentState.graph.nodes.has(id)) return 'node';
		return null;
	}

	private cancelGraphMove() {
		const move = this._graphMoveStart;
		this._graphMoveStart = null;
		if (!move) return;
		environmentState.restoreGraphNodePosition(move.id, move.x, move.y);
	}

	private applyGraphEditDown(id: NodeId | null, x: number = 0, y: number = 0) {
		const objectType = this.getGraphObjectType(id);
		if (id !== null && objectType) {
			this.selection = { type: objectType, id };
		} else {
			this.selection = null;
		}
		
		// The resolved mode, not the raw one, so what a click does always matches
		// the tool the strip is showing.
		switch (this.mode) {
			case 'node':
				if (id === null) {
					this._nodeCount++;
					environmentState.addGraphNode(x, y, `N${this._nodeCount}`);
				}
				break;
			case 'edge':
				if (id !== null && objectType === 'node') {
					this._dragStartNode = id;
					this._edgePreviewTo = { x, y };
				}
				break;
			case 'remove':
				if (id !== null && objectType === 'edge') {
					environmentState.removeGraphEdge(id);
				} else if (id !== null && objectType === 'node') {
					environmentState.removeGraphNode(id);
				}
				break;
			case 'move':
				if (id !== null && objectType === 'node') {
					const node = environmentState.graph.nodes.get(id);
					if (node) {
						this._dragStartNode = id;
						this._graphMoveStart = { id, x: node.x, y: node.y };
						this._interactor.beginGraphMove(id, node.x, node.y);
					}
				}
				break;
			case 'start':
				if (id !== null && objectType === 'node') environmentState.setGraphStart(id);
				break;
			case 'goal':
				if (id !== null && objectType === 'node') environmentState.setGraphGoal(id);
				break;
			case 'cost':
				if (id !== null && objectType === 'edge') {
					environmentState.setGraphWeight(id, this._costValue);
				}
				break;
		}
	}

	private applyGraphEditMove(id: NodeId | null, x: number, y: number) {
		if (!this._isDrawing) return;

		// The resolved mode, not the raw one, so what a click does always matches
		// the tool the strip is showing.
		switch (this.mode) {
			case 'edge':
				if (this._dragStartNode) {
					this._edgePreviewTo = { x, y };
				}
				break;
			case 'move':
				if (this._dragStartNode && this._graphMoveStart?.id === this._dragStartNode) {
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
		// The resolved mode, not the raw one, so what a click does always matches
		// the tool the strip is showing.
		switch (this.mode) {
			case 'edge': {
				const source = this._dragStartNode;
				if (
					source !== null &&
					id !== null &&
					source !== id &&
					this.getGraphObjectType(source) === 'node' &&
					this.getGraphObjectType(id) === 'node'
				) {
					environmentState.addGraphEdge(source, id, this._costValue);
				}
				break;
			}
			case 'move':
				if (this._dragStartNode) {
					const node = environmentState.graph.nodes.get(this._dragStartNode);
					this._interactor.commitGraphMove(
						this._dragStartNode,
						node?.x ?? x,
						node?.y ?? y
					);
				}
				this._graphMoveStart = null;
				break;
		}
	}
}

export const editorState = new EditorState();
