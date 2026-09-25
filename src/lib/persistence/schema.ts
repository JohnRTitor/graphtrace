import type { CostModel } from '../domain/cost-model';
import type { MovementModel } from '../domain/movement-model';
import type { NodeId, GridCell } from '../graph/types';
import type { GraphNode, GraphEdge } from '../graph/manual';
import type { SerializedGameTree } from '../graph/game-tree';
import type { EnvironmentType } from '../generators/types';
import { allEnvironmentTypes } from '../generators/types';

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

/**
 * The workspace format.
 *
 * Schema version stays at 1.0 and every new field is optional, so a workspace
 * written by the pre-family build still loads and a workspace written here still
 * loads there (the extra keys are ignored). A game tree is a third payload
 * alongside the grid and the graph rather than a new version, because "which of
 * these is present" is already how the format resolves the environment.
 */
export type SerializedWorkspace = {
	schemaVersion: SchemaVersion;
	environmentType: EnvironmentType;
	environmentSeed: number;
	/** The active family, so a saved adversarial workspace reopens as adversarial. */
	familyId?: string;
	grid?: {
		data: SerializedGrid;
		movementModel: MovementModel;
		costModel: CostModel;
	};
	graph?: {
		data: SerializedGraph;
		costModel: CostModel;
	};
	gameTree?: {
		data: SerializedGameTree;
	};
};

export const isKnownEnvironmentType = (value: unknown): value is EnvironmentType =>
	typeof value === 'string' && allEnvironmentTypes.includes(value as EnvironmentType);
