import type { NodeId } from './types';

export type GridCellEdit = {
	id: NodeId;
	oldWalkable: boolean;
	newWalkable: boolean;
	oldCost: number;
	newCost: number;
};

export type GridCommand =
	| {
			type: 'paint-cells';
			edits: GridCellEdit[];
			oldStart: NodeId | null;
			newStart: NodeId | null;
			oldGoal: NodeId | null;
			newGoal: NodeId | null;
	  }
	| {
			type: 'resize';
			oldRows: number;
			oldCols: number;
			newRows: number;
			newCols: number;
	  }
	| {
			type: 'clear';
			oldGridSnapshot: any;
	  };
