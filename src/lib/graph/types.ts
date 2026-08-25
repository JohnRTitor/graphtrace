export type NodeId = string;

export type GridNode = {
	id: NodeId;
	row: number;
	col: number;
	walkable: boolean;
	weight: number;
};

export type Grid = {
	rows: number;
	cols: number;
	nodes: Map<NodeId, GridNode>;
	start: NodeId | null;
	goal: NodeId | null;
};

export enum NeighborDirection {
	Up = 0,
	Right = 1,
	Down = 2,
	Left = 3
}
