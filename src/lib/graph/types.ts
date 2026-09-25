export type NodeId = string;

export type GridCell = {
	id: NodeId;
	row: number;
	col: number;
	walkable: boolean;
	cost: number;
};



export type Grid = {
	rows: number;
	cols: number;
	nodes: Map<NodeId, GridCell>;
	start: NodeId | null;
	goal: NodeId | null;
};

export enum NeighborDirection {
	Up = 0,
	Right = 1,
	Down = 2,
	Left = 3
}

// Common graph abstractions for algorithms
export type BaseGraphNode = {
	id: NodeId;
};

export type BaseGraphEdge = {
	id?: string;
	target: NodeId;
	weight: number;
};

export type BaseGraph = {
	getNode: (id: NodeId) => BaseGraphNode | undefined;
	getNeighbors: (id: NodeId) => BaseGraphEdge[];
	getHeuristic: (nodeA: NodeId, nodeB: NodeId) => number;
	getStart: () => NodeId | null;
	getGoal: () => NodeId | null;
};
