import type { GridCell, NodeId } from './types';

export type GridCellEdit = {
	id: NodeId;
	oldWalkable: boolean;
	newWalkable: boolean;
	oldCost: number;
	newCost: number;
};

export type GridSnapshot = {
	rows: number;
	cols: number;
	nodes: GridCell[];
	start: NodeId | null;
	goal: NodeId | null;
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
			type: 'replace';
			oldGrid: GridSnapshot;
			newGrid: GridSnapshot;
	  };
