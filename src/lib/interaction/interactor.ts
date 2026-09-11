import type { EditMode } from '../state/editor.svelte';
import type { NodeId } from '../graph/types';
import type { EnvCommand } from '../domain/command';
import type { GraphCommand } from '../graph/manual';

export class Interactor {
	private _activeGridBatch: (EnvCommand & { type: 'grid' }) | null = null;
	
	// Graph drag states
	private _dragStartNode: NodeId | null = null;
	private _dragStartPos: { x: number, y: number } | null = null;
	
	constructor(
		private commitCommand: (cmd: EnvCommand) => void
	) {}

	beginGridDrag(oldStart: NodeId | null, oldGoal: NodeId | null) {
		this._activeGridBatch = {
			type: 'grid',
			cmd: {
				type: 'paint-cells',
				edits: [],
				oldStart,
				newStart: oldStart,
				oldGoal,
				newGoal: oldGoal
			}
		};
	}

	recordGridEdit(
		id: NodeId, 
		oldWalkable: boolean, newWalkable: boolean,
		oldCost: number, newCost: number
	) {
		if (!this._activeGridBatch || this._activeGridBatch.cmd.type !== 'paint-cells') return;
		
		const existing = this._activeGridBatch.cmd.edits.find((e: any) => e.id === id);
		if (existing) {
			existing.newWalkable = newWalkable;
			existing.newCost = newCost;
		} else {
			this._activeGridBatch.cmd.edits.push({
				id,
				oldWalkable, newWalkable,
				oldCost, newCost
			});
		}
	}

	setGridStart(id: NodeId | null) {
		if (this._activeGridBatch && this._activeGridBatch.cmd.type === 'paint-cells') {
			this._activeGridBatch.cmd.newStart = id;
		}
	}

	setGridGoal(id: NodeId | null) {
		if (this._activeGridBatch && this._activeGridBatch.cmd.type === 'paint-cells') {
			this._activeGridBatch.cmd.newGoal = id;
		}
	}

	commitGridDrag() {
		if (this._activeGridBatch && this._activeGridBatch.cmd.type === 'paint-cells') {
			if (
				this._activeGridBatch.cmd.edits.length > 0 ||
				this._activeGridBatch.cmd.oldStart !== this._activeGridBatch.cmd.newStart ||
				this._activeGridBatch.cmd.oldGoal !== this._activeGridBatch.cmd.newGoal
			) {
				this.commitCommand(this._activeGridBatch);
			}
			this._activeGridBatch = null;
		}
	}

	beginGraphMove(id: NodeId, startX: number, startY: number) {
		this._dragStartNode = id;
		this._dragStartPos = { x: startX, y: startY };
	}

	commitGraphMove(id: NodeId, endX: number, endY: number) {
		if (this._dragStartNode === id && this._dragStartPos) {
			if (this._dragStartPos.x !== endX || this._dragStartPos.y !== endY) {
				this.commitCommand({
					type: 'graph',
					cmd: {
						type: 'move-node',
						id,
						from: this._dragStartPos,
						to: { x: endX, y: endY }
					}
				});
			}
		}
		this._dragStartNode = null;
		this._dragStartPos = null;
	}
	
	cancelGesture() {
		this._activeGridBatch = null;
		this._dragStartNode = null;
		this._dragStartPos = null;
	}
}
