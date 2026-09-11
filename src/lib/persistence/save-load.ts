import type { EnvironmentState } from '../state/environment.svelte';
import type { SerializedWorkspace, SerializedGrid, SerializedGraph } from './schema';
import { ManualGraph } from '../graph/manual';
import { defaultGridCostModel, defaultGraphCostModel } from '../domain/cost-model';
import { defaultMovementModel } from '../domain/movement-model';

export function serializeWorkspace(envState: EnvironmentState): string {
	const workspace: SerializedWorkspace = {
		schemaVersion: '1.0',
		environmentType: envState.environmentType,
		environmentSeed: envState.environmentSeed,
	};

	if (envState.environmentType !== 'graph') {
		const grid = envState.grid;
		const gridData: SerializedGrid = {
			rows: grid.rows,
			cols: grid.cols,
			nodes: Array.from(grid.nodes.entries()),
			start: grid.start,
			goal: grid.goal,
		};
		workspace.grid = {
			data: gridData,
			movementModel: defaultMovementModel, // We can get this from the state later if we make it configurable
			costModel: defaultGridCostModel,
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
			costModel: defaultGraphCostModel,
		};
	}

	return JSON.stringify(workspace, null, 2);
}

export function deserializeWorkspace(json: string, envState: EnvironmentState): void {
	const workspace = JSON.parse(json) as SerializedWorkspace;
	
	if (workspace.schemaVersion !== '1.0') {
		throw new Error(`Unsupported schema version: ${workspace.schemaVersion}`);
	}

	envState.environmentType = workspace.environmentType;
	envState.environmentSeed = workspace.environmentSeed;

	if (workspace.environmentType !== 'graph' && workspace.grid) {
		const data = workspace.grid.data;
		// Reconstruct the Grid object
		const gridNodes = new Map(data.nodes);
		envState.replaceGrid({
			rows: data.rows,
			cols: data.cols,
			nodes: gridNodes,
			start: data.start,
			goal: data.goal,
		});
	} else if (workspace.environmentType === 'graph' && workspace.graph) {
		const data = workspace.graph.data;
		
		const nodesArray = data.nodes.map(n => n[1]);
		const edgesArray = data.edges.map(e => e[1]);

		envState.replaceGraph(
			nodesArray,
			edgesArray,
			data.start,
			data.goal
		);
	}
}
