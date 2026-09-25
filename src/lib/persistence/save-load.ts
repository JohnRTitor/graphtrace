import type { EnvironmentState } from '../state/environment.svelte';
import type { SerializedWorkspace, SerializedGrid, SerializedGraph } from './schema';
import { defaultGridCostModel, defaultGraphCostModel } from '../domain/cost-model';
import { defaultMovementModel } from '../domain/movement-model';
import type { Grid, GridCell, NodeId } from '../graph/types';
import type { GraphNode, GraphEdge } from '../graph/manual';

const environmentTypes = new Set(['perfect_maze', 'braided_maze', 'random_obstacles', 'blank', 'graph']);

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
	return value !== null && typeof value === 'object';
}

function assertValid(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

function parseGridData(value: unknown): Grid {
	assertValid(isRecord(value), 'Invalid grid data');
	const rows = value.rows;
	const cols = value.cols;
	assertValid(Number.isInteger(rows) && (rows as number) > 0 && (rows as number) <= 100, 'Invalid grid rows');
	assertValid(Number.isInteger(cols) && (cols as number) > 0 && (cols as number) <= 100, 'Invalid grid columns');
	assertValid(Array.isArray(value.nodes), 'Invalid grid nodes');
	const nodes = new Map<NodeId, GridCell>();
	for (const entry of value.nodes as unknown[]) {
		assertValid(Array.isArray(entry) && entry.length === 2, 'Invalid grid node entry');
		const [id, cell] = entry as [unknown, unknown];
		assertValid(typeof id === 'string' && isRecord(cell), 'Invalid grid node entry');
		const node = cell as UnknownRecord;
		assertValid(
			node.id === id &&
			Number.isInteger(node.row) &&
			Number.isInteger(node.col) &&
			`${node.row},${node.col}` === id &&
			(node.row as number) >= 0 && (node.row as number) < (rows as number) &&
			(node.col as number) >= 0 && (node.col as number) < (cols as number) &&
			typeof node.walkable === 'boolean' &&
			typeof node.cost === 'number' && Number.isFinite(node.cost) && (node.cost as number) >= 0,
			'Invalid grid node data'
		);
		assertValid(!nodes.has(id), 'Duplicate grid node id');
		nodes.set(id, {
			id,
			row: node.row as number,
			col: node.col as number,
			walkable: node.walkable as boolean,
			cost: node.cost as number
		});
	}
	assertValid(nodes.size === (rows as number) * (cols as number), 'Incomplete grid data');
	const start = value.start;
	const goal = value.goal;
	assertValid(start === null || (typeof start === 'string' && nodes.has(start)), 'Invalid grid start');
	assertValid(goal === null || (typeof goal === 'string' && nodes.has(goal)), 'Invalid grid goal');
	if (start !== null) assertValid(nodes.get(start)?.walkable === true, 'Grid start must be walkable');
	if (goal !== null) assertValid(nodes.get(goal)?.walkable === true, 'Grid goal must be walkable');
	return { rows: rows as number, cols: cols as number, nodes, start, goal };
}

function parseGraphData(value: unknown): { nodes: GraphNode[]; edges: GraphEdge[]; start: NodeId | null; goal: NodeId | null } {
	assertValid(isRecord(value), 'Invalid graph data');
	assertValid(Array.isArray(value.nodes) && Array.isArray(value.edges), 'Invalid graph collections');
	const nodes: GraphNode[] = [];
	const nodeIds = new Set<string>();
	for (const entry of value.nodes as unknown[]) {
		assertValid(Array.isArray(entry) && entry.length === 2, 'Invalid graph node entry');
		const [id, node] = entry as [unknown, unknown];
		assertValid(typeof id === 'string' && isRecord(node), 'Invalid graph node entry');
		const valueNode = node as UnknownRecord;
		assertValid(
			valueNode.id === id &&
			typeof valueNode.label === 'string' &&
			typeof valueNode.x === 'number' && Number.isFinite(valueNode.x) &&
			typeof valueNode.y === 'number' && Number.isFinite(valueNode.y) &&
			(valueNode.cost === undefined || (typeof valueNode.cost === 'number' && Number.isFinite(valueNode.cost) && (valueNode.cost as number) >= 0)) &&
			!nodeIds.has(id),
			'Invalid graph node data'
		);
		nodeIds.add(id);
		nodes.push({
			id,
			label: valueNode.label as string,
			x: valueNode.x as number,
			y: valueNode.y as number,
			...(valueNode.cost === undefined ? {} : { cost: valueNode.cost as number })
		});
	}

	const edges: GraphEdge[] = [];
	const edgeIds = new Set<string>();
	for (const entry of value.edges as unknown[]) {
		assertValid(Array.isArray(entry) && entry.length === 2, 'Invalid graph edge entry');
		const [id, edge] = entry as [unknown, unknown];
		assertValid(typeof id === 'string' && isRecord(edge), 'Invalid graph edge entry');
		const valueEdge = edge as UnknownRecord;
		assertValid(
			valueEdge.id === id &&
			typeof valueEdge.source === 'string' && nodeIds.has(valueEdge.source) &&
			typeof valueEdge.target === 'string' && nodeIds.has(valueEdge.target) &&
			typeof valueEdge.weight === 'number' && Number.isFinite(valueEdge.weight) && (valueEdge.weight as number) >= 0 &&
			typeof valueEdge.directed === 'boolean' && !edgeIds.has(id),
			'Invalid graph edge data'
		);
		edgeIds.add(id);
		edges.push({
			id,
			source: valueEdge.source as string,
			target: valueEdge.target as string,
			weight: valueEdge.weight as number,
			directed: valueEdge.directed as boolean
		});
	}

	const start = value.start;
	const goal = value.goal;
	assertValid(start === null || (typeof start === 'string' && nodeIds.has(start)), 'Invalid graph start');
	assertValid(goal === null || (typeof goal === 'string' && nodeIds.has(goal)), 'Invalid graph goal');
	return { nodes, edges, start, goal };
}

export function serializeWorkspace(envState: EnvironmentState): string {
	const workspace: SerializedWorkspace = {
		schemaVersion: '1.0',
		environmentType: envState.environmentType,
		environmentSeed: envState.environmentSeed
	};

	if (envState.environmentType !== 'graph') {
		const grid = envState.grid;
		const gridData: SerializedGrid = {
			rows: grid.rows,
			cols: grid.cols,
			nodes: Array.from(grid.nodes.entries()),
			start: grid.start,
			goal: grid.goal
		};
		workspace.grid = {
			data: gridData,
			movementModel: defaultMovementModel,
			costModel: defaultGridCostModel
		};
	} else {
		const graph = envState.graph;
		const graphData: SerializedGraph = {
			nodes: Array.from(graph.nodes.entries()),
			edges: Array.from(graph.edges.entries()),
			start: graph.start,
			goal: graph.goal
		};
		workspace.graph = {
			data: graphData,
			costModel: defaultGraphCostModel
		};
	}

	return JSON.stringify(workspace, null, 2);
}

export function deserializeWorkspace(json: string, envState: EnvironmentState): void {
	const parsed: unknown = JSON.parse(json);
	assertValid(isRecord(parsed), 'Invalid workspace');
	assertValid(parsed.schemaVersion === '1.0', `Unsupported schema version: ${String(parsed.schemaVersion)}`);
	assertValid(typeof parsed.environmentType === 'string' && environmentTypes.has(parsed.environmentType), 'Invalid environment type');
	assertValid(typeof parsed.environmentSeed === 'number' && Number.isFinite(parsed.environmentSeed), 'Invalid environment seed');

	const environmentType = parsed.environmentType as SerializedWorkspace['environmentType'];
	const seed = Math.trunc(parsed.environmentSeed as number);
	if (environmentType === 'graph') {
		assertValid(isRecord(parsed.graph) && isRecord(parsed.graph.data), 'Missing graph data');
		const graph = parseGraphData(parsed.graph.data);
		envState.environmentType = environmentType;
		envState.environmentSeed = seed;
		assertValid(envState.loadGraph(graph), 'Unable to load graph data');
	} else {
		assertValid(isRecord(parsed.grid) && isRecord(parsed.grid.data), 'Missing grid data');
		const grid = parseGridData(parsed.grid.data);
		envState.environmentType = environmentType;
		envState.environmentSeed = seed;
		envState.replaceGrid(grid);
	}
}
