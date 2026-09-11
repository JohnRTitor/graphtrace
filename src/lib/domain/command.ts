import type { NodeId } from '../graph/types';
import type { GraphCommand } from '../graph/manual';

export type GridCellEdit = {
	id: NodeId;
	oldWalkable: boolean;
	newWalkable: boolean;
	oldCost: number;
	newCost: number;
};

export type GridBatchCommand = {
	type: 'grid-batch';
	edits: GridCellEdit[];
	oldStart: NodeId | null;
	newStart: NodeId | null;
	oldGoal: NodeId | null;
	newGoal: NodeId | null;
};

export type GridResizeCommand = {
	type: 'grid-resize';
	oldRows: number;
	oldCols: number;
	newRows: number;
	newCols: number;
	// When resizing we basically clear the grid, so we might need to store the whole old grid state
	// For simplicity, let's just store the old dimensions.
};

export type GridClearCommand = {
	type: 'grid-clear';
	// To undo a clear, we'd need to store the old grid state.
	// We can store a snapshot of the grid before clear.
	oldGridSnapshot: any; 
};

export type EnvCommand = 
	| { type: 'graph'; cmd: GraphCommand }
	| GridBatchCommand
	| GridResizeCommand
	| GridClearCommand;
