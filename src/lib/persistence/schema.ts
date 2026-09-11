import type { CostModel } from '../domain/cost-model';
import type { MovementModel } from '../domain/movement-model';
import type { NodeId, GridCell } from '../graph/types';
import type { GraphNode, GraphEdge } from '../graph/manual';
import type { EnvironmentType } from '../generators/types';

export type SchemaVersion = '1.0';

export type SerializedGrid = {
	rows: number;
	cols: number;
	nodes: [NodeId, GridCell][];
	start: NodeId | null;
	goal: NodeId | null;
};

export type SerializedGraph = {
	nodes: [string, GraphNode][];
	edges: [string, GraphEdge][];
	start: NodeId | null;
	goal: NodeId | null;
};

export type SerializedWorkspace = {
	schemaVersion: SchemaVersion;
	environmentType: EnvironmentType;
	environmentSeed: number;
	grid?: {
		data: SerializedGrid;
		movementModel: MovementModel;
		costModel: CostModel;
	};
	graph?: {
		data: SerializedGraph;
		costModel: CostModel;
	};
};
