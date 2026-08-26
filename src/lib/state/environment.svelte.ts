import { createGrid, setWall, setWeight, setStart as setGridStart, setGoal as setGridGoal, clearGrid, getNode } from '../graph/grid';
import type { Grid, NodeId } from '../graph/types';
import { ManualGraph, type GraphCommand, type GraphEdge, type GraphNode } from '../graph/manual';
import { generateId } from '../utils';
import { GridAdapter } from '../graph/graph-adapter';
import { playbackState } from './playback.svelte';
import { getAlgorithm } from '../algorithms';
import type { EnvironmentType } from '../generators/types';

export class EnvironmentState {
	// --- Grid State ---
	private _grid = $state<Grid>(createGrid(31, 41));
	private _gridVersion = $state(0);

	// --- Graph State ---
	private _graph = $state<ManualGraph>(new ManualGraph());

	// --- Settings State ---
	private _selectedAlgorithmId = $state<string>('bfs');
	private _showCosts = $state<boolean>(true);
	private _environmentType = $state<EnvironmentType>('perfect_maze');
	private _environmentSeed = $state<number>(Date.now());
	private _loopDensity = $state<number>(10);
	private _obstacleDensity = $state<number>(30);
	private _gridRowsSetting = $state<number>(30);
	private _gridColsSetting = $state<number>(40);

	constructor() {
		this.resetGridToDefaults(31, 41);
	}

	// === Grid Getters & Methods ===
	get grid(): Grid {
		this._gridVersion;
		return this._grid;
	}
	get gridRows(): number { return this._grid.rows; }
	get gridCols(): number { return this._grid.cols; }
	get gridStart(): NodeId | null {
		this._gridVersion;
		return this._grid.start;
	}
	get gridGoal(): NodeId | null {
		this._gridVersion;
		return this._grid.goal;
	}

	resizeGrid(rows: number, cols: number): void {
		this._grid = createGrid(rows, cols);
		this.resetGridToDefaults(rows, cols);
		this._gridVersion++;
	}

	clearGrid(): void {
		playbackState.reset();
		clearGrid(this._grid);
		this._gridVersion++;
	}
	
	replaceGrid(newGrid: Grid): void {
		playbackState.reset();
		this._grid = newGrid;
		this._gridVersion++;
	}

	toggleGridWall(id: NodeId): void {
		const node = getNode(this._grid, id);
		if (!node) return;
		if (id === this._grid.start || id === this._grid.goal) return;
		setWall(this._grid, id, !node.walkable);
		this._gridVersion++;
	}

	setGridWall(id: NodeId, isWall: boolean): void {
		if (isWall && (id === this._grid.start || id === this._grid.goal)) return;
		setWall(this._grid, id, !isWall);
		this._gridVersion++;
	}
	
	setGridWeight(id: NodeId, weight: number): void {
		if (id === this._grid.start || id === this._grid.goal) return;
		setWeight(this._grid, id, weight);
		this._gridVersion++;
	}

	setGridStart(id: NodeId): void {
		const node = getNode(this._grid, id);
		if (!node) return;
		if (!node.walkable) setWall(this._grid, id, true);
		setGridStart(this._grid, id);
		this._gridVersion++;
	}

	setGridGoal(id: NodeId): void {
		const node = getNode(this._grid, id);
		if (!node) return;
		if (!node.walkable) setWall(this._grid, id, true);
		setGridGoal(this._grid, id);
		this._gridVersion++;
	}
	
	private resetGridToDefaults(rows: number, cols: number): void {
		const startR = Math.floor(rows / 2);
		const startC = Math.floor(cols / 4);
		const goalR = Math.floor(rows / 2);
		const goalC = Math.floor((cols * 3) / 4);
		setGridStart(this._grid, `${startR},${startC}`);
		setGridGoal(this._grid, `${goalR},${goalC}`);
	}

	// === Graph Getters & Methods ===
	get graph(): ManualGraph {
		this._graph.version;
		return this._graph;
	}
	get graphDirected(): boolean {
		this._graph.version;
		return this._graph.directed;
	}
	get graphStart(): NodeId | null {
		this._graph.version;
		return this._graph.start;
	}
	get graphGoal(): NodeId | null {
		this._graph.version;
		return this._graph.goal;
	}
	get graphCanUndo(): boolean {
		this._graph.version;
		return this._graph.canUndo();
	}
	get graphCanRedo(): boolean {
		this._graph.version;
		return this._graph.canRedo();
	}

	executeGraphCommand(cmd: GraphCommand) { this._graph.execute(cmd); }
	undoGraph() { this._graph.undo(); }
	redoGraph() { this._graph.redo(); }
	clearGraph() {
		playbackState.reset();
		const nodes = Array.from(this._graph.nodes.values());
		const edges = Array.from(this._graph.edges.values());
		this._graph.execute({ type: 'clear', nodes, edges, start: this._graph.start, goal: this._graph.goal });
	}
	addGraphNode(x: number, y: number, label: string): NodeId {
		const id = `node-${generateId(6)}`;
		this._graph.execute({ type: 'add-node', node: { id, x, y, label } });
		return id;
	}
	removeGraphNode(id: NodeId) {
		const node = this._graph.nodes.get(id);
		if (!node) return;
		const attachedEdges = this._graph.getAttachedEdges(id);
		this._graph.execute({ type: 'remove-node', node, attachedEdges });
	}
	moveGraphNode(id: NodeId, x: number, y: number) {
		const node = this._graph.nodes.get(id);
		if (!node) return;
		this._graph.execute({ type: 'move-node', id, from: { x: node.x, y: node.y }, to: { x, y } });
	}
	addGraphEdge(source: NodeId, target: NodeId, weight: number = 1): string {
		const id = `edge-${generateId(6)}`;
		this._graph.execute({ type: 'add-edge', edge: { id, source, target, weight, directed: this._graph.directed } });
		return id;
	}
	removeGraphEdge(id: string) {
		const edge = this._graph.edges.get(id);
		if (!edge) return;
		this._graph.execute({ type: 'remove-edge', edge });
	}
	setGraphStart(id: NodeId | null) {
		this._graph.execute({ type: 'set-start', from: this._graph.start, to: id });
	}
	setGraphGoal(id: NodeId | null) {
		this._graph.execute({ type: 'set-goal', from: this._graph.goal, to: id });
	}
	setGraphDirected(directed: boolean) {
		if (this._graph.directed === directed) return;
		this._graph.execute({ type: 'set-directed', from: this._graph.directed, to: directed });
	}
	setGraphWeight(edgeId: string, weight: number) {
		const edge = this._graph.edges.get(edgeId);
		if (!edge || edge.weight === weight) return;
		this._graph.execute({ type: 'set-weight', edgeId, from: edge.weight, to: weight });
	}
	loadGraph(data: any) { this._graph.load(data); }

	// === Settings Getters & Methods ===
	get selectedAlgorithmId() { return this._selectedAlgorithmId; }
	set selectedAlgorithmId(id: string) {
		this._selectedAlgorithmId = id;
		playbackState.reset();
	}
	
	get currentAlgorithm() { return getAlgorithm(this._selectedAlgorithmId); }

	get showCosts() { return this._showCosts; }
	set showCosts(val: boolean) { this._showCosts = val; }

	get environmentType() { return this._environmentType; }
	set environmentType(val: EnvironmentType) { this._environmentType = val; }
	
	get environmentSeed() { return this._environmentSeed; }
	set environmentSeed(val: number) { this._environmentSeed = val; }
	
	get loopDensity() { return this._loopDensity; }
	set loopDensity(val: number) { this._loopDensity = Math.max(0, Math.min(100, val)); }
	
	get obstacleDensity() { return this._obstacleDensity; }
	set obstacleDensity(val: number) { this._obstacleDensity = Math.max(0, Math.min(100, val)); }

	get gridRowsSetting() { return this._gridRowsSetting; }
	set gridRowsSetting(val: number) { this._gridRowsSetting = Math.max(5, Math.min(100, val)); }

	get gridColsSetting() { return this._gridColsSetting; }
	set gridColsSetting(val: number) { this._gridColsSetting = Math.max(5, Math.min(100, val)); }

	runAlgorithm() {
		const algo = this.currentAlgorithm;
		if (!algo) return;
		
		let graphModel;
		let start;
		let goal;

		if (this.environmentType === 'graph') {
			graphModel = this._graph;
			start = this._graph.start;
			goal = this._graph.goal;
		} else {
			graphModel = new GridAdapter(this._grid);
			start = this._grid.start;
			goal = this._grid.goal;
		}
		
		if (!start || !goal) {
			console.warn("Start or goal node not set");
			return;
		}

		const result = algo.run(graphModel, start, goal);
		playbackState.loadEvents(result.events, result.metrics);
		playbackState.play();
	}
}

export const environmentState = new EnvironmentState();
