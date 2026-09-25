import {
  createGrid,
  setWall,
  setCost,
  setStart as setGridStart,
  setGoal as setGridGoal,
  clearGrid,
  getNode,
} from "../graph/grid";
import type { Grid, GridCell, NodeId } from "../graph/types";
import { HistoryStore } from "./history-store.svelte";
import {
  ManualGraph,
  type GraphCommand,
  type GraphEdge,
  type GraphNode,
} from "../graph/manual";
import { generateId } from "../utils";
import { GridAdapter } from "../graph/graph-adapter";
import { comparePlaybackState, playbackState } from "./playback.svelte";
import { executionStore } from "./execution-store.svelte";
import { invalidatePlaybackIfNeeded } from "./invalidate";
import type { ExecutionId } from "../domain/execution";
import { createProblemVersion, type Problem } from "../domain/problem";
import {
  defaultGridCostModel,
  defaultGraphCostModel,
  isValidCost,
} from "../domain/cost-model";
import { defaultMovementModel } from "../domain/movement-model";
import type { EnvironmentType } from "../generators/types";
import { generateRandomGraph } from "../generators/random-graph";
import { getAlgorithm } from "../algorithms";
import { invertGraphCommand } from "../graph/manual";
import type { EnvCommand } from "../domain/command";
import type { GridSnapshot } from "../graph/commands";

export type RunAlgorithmMode = "autoplay" | "step";

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clampSetting(value: number, min: number, max: number, fallback: number): number {
  const safeValue = Number.isFinite(value) ? Math.trunc(value) : fallback;
  return Math.max(min, Math.min(max, safeValue));
}

export class EnvironmentState {
  // --- Grid State ---
  private _grid = $state<Grid>(createGrid(31, 41));
  private _gridVersion = $state(0);

  // --- Graph State ---
  private _graph = $state<ManualGraph>(new ManualGraph());
  private _graphVersion = $state(0);

  // --- Settings State ---
  private _selectedAlgorithmId = $state<string>("bfs");
  private _showCosts = $state<boolean>(true);
  private _environmentType = $state<EnvironmentType>("perfect_maze");
  private _environmentSeed = $state<number>(12345);
  private _loopDensity = $state<number>(10);
  private _obstacleDensity = $state<number>(30);
  private _gridRowsSetting = $state<number>(30);
  private _gridColsSetting = $state<number>(40);

  // --- Random Graph State ---
  private _graphNodeCount = $state<number>(25);
  private _graphEdgeMultiplier = $state<number>(2);
  private _graphEnsurePath = $state<boolean>(true);
  private _graphWeighted = $state<boolean>(true);
  private _defaultEdgeDirected = $state<boolean>(false);

  // --- History State ---
  private _history: HistoryStore<EnvCommand>;
  private _historyScope: 'grid' | 'graph' | null = null;

  constructor() {
    this._history = new HistoryStore(
      (cmd, isRedo) => this.applyCommandLocally(cmd, isRedo),
      (cmd) => this.invertCommandLocally(cmd)
    );
    this.resetGridToDefaults(31, 41);
  }

  private snapshotGrid(grid: Grid): GridSnapshot {
    return {
      rows: grid.rows,
      cols: grid.cols,
      nodes: Array.from(grid.nodes.values(), (cell) => ({ ...cell })),
      start: grid.start,
      goal: grid.goal
    };
  }

  private gridFromSnapshot(snapshot: GridSnapshot): Grid {
    const nodes = new Map<NodeId, GridCell>();
    for (const cell of snapshot.nodes) {
      if (
        typeof cell.id === 'string' &&
        Number.isInteger(cell.row) &&
        Number.isInteger(cell.col) &&
        cell.row >= 0 && cell.row < snapshot.rows &&
        cell.col >= 0 && cell.col < snapshot.cols &&
        typeof cell.walkable === 'boolean' &&
        isValidCost(cell.cost)
      ) {
        nodes.set(cell.id, { ...cell });
      }
    }
    const start = nodes.get(snapshot.start ?? '');
    const goal = nodes.get(snapshot.goal ?? '');
    return {
      rows: snapshot.rows,
      cols: snapshot.cols,
      nodes,
      start: start?.walkable ? start.id : null,
      goal: goal?.walkable ? goal.id : null
    };
  }

  private isValidGridSnapshot(snapshot: GridSnapshot): boolean {
    if (
      !Number.isInteger(snapshot.rows) ||
      !Number.isInteger(snapshot.cols) ||
      snapshot.rows < 0 ||
      snapshot.cols < 0 ||
      snapshot.nodes.length !== snapshot.rows * snapshot.cols
    ) return false;
    const ids = new Set<NodeId>();
    for (const cell of snapshot.nodes) {
      if (
        typeof cell.id !== 'string' ||
        ids.has(cell.id) ||
        !Number.isInteger(cell.row) ||
        !Number.isInteger(cell.col) ||
        cell.row < 0 || cell.row >= snapshot.rows ||
        cell.col < 0 || cell.col >= snapshot.cols ||
        typeof cell.walkable !== 'boolean' ||
        !isValidCost(cell.cost)
      ) return false;
      ids.add(cell.id);
    }
    const start = snapshot.start === null ? null : snapshot.nodes.find((cell) => cell.id === snapshot.start);
    const goal = snapshot.goal === null ? null : snapshot.nodes.find((cell) => cell.id === snapshot.goal);
    return (snapshot.start === null || (start?.walkable === true)) &&
      (snapshot.goal === null || (goal?.walkable === true));
  }

  private restoreGrid(snapshot: GridSnapshot): void {
    this._grid = this.gridFromSnapshot(snapshot);
    this._gridVersion++;
  }

  // === Grid Getters & Methods ===
  get grid(): Grid {
    this._gridVersion;
    return this._grid;
  }
  get gridRows(): number {
    return this._grid.rows;
  }
  get gridCols(): number {
    return this._grid.cols;
  }
  get gridStart(): NodeId | null {
    this._gridVersion;
    return this._grid.start;
  }
  get gridGoal(): NodeId | null {
    this._gridVersion;
    return this._grid.goal;
  }

  resizeGrid(rows: number, cols: number): void {
    if (!Number.isFinite(rows) || !Number.isFinite(cols) || rows < 1 || cols < 1 || rows > 1000 || cols > 1000) return;
    const safeRows = Math.trunc(rows);
    const safeCols = Math.trunc(cols);
    this._gridRowsSetting = clampSetting(safeRows, 5, 100, this._gridRowsSetting);
    this._gridColsSetting = clampSetting(safeCols, 5, 100, this._gridColsSetting);
    const nextGrid = createGrid(safeRows, safeCols);
    this.resetGridToDefaults(safeRows, safeCols, nextGrid);
    this.replaceGrid(nextGrid);
  }

  clearGrid(): void {
    const nextGrid = this.gridFromSnapshot(this.snapshotGrid(this._grid));
    clearGrid(nextGrid);
    this.replaceGrid(nextGrid);
  }

  replaceGrid(newGrid: Grid): void {
    const nextSnapshot = this.snapshotGrid(newGrid);
    const previousSnapshot = this.snapshotGrid(this._grid);
    if (!this.isValidGridSnapshot(nextSnapshot)) return;
    this.executeCommand({
      type: 'grid',
      cmd: {
        type: 'replace',
        oldGrid: previousSnapshot,
        newGrid: nextSnapshot
      }
    });
  }

  toggleGridWall(id: NodeId): void {
    const node = getNode(this._grid, id);
    if (!node) return;
    if (id === this._grid.start || id === this._grid.goal) return;
    this.executeCommand({
      type: 'grid',
      cmd: {
        type: 'paint-cells',
        edits: [{ id, oldWalkable: node.walkable, newWalkable: !node.walkable, oldCost: node.cost, newCost: node.cost }],
        oldStart: this._grid.start, newStart: this._grid.start,
        oldGoal: this._grid.goal, newGoal: this._grid.goal
      }
    });
  }

  setGridWall(id: NodeId, isWall: boolean): void {
    if (isWall && (id === this._grid.start || id === this._grid.goal)) return;
    const node = getNode(this._grid, id);
    if (!node || node.walkable === !isWall) return;
    this.executeCommand({
      type: 'grid',
      cmd: {
        type: 'paint-cells',
        edits: [{ id, oldWalkable: node.walkable, newWalkable: !isWall, oldCost: node.cost, newCost: node.cost }],
        oldStart: this._grid.start, newStart: this._grid.start,
        oldGoal: this._grid.goal, newGoal: this._grid.goal
      }
    });
  }

  setGridCost(id: NodeId, cost: number): void {
    if (!isValidCost(cost)) return;
    if (id === this._grid.start || id === this._grid.goal) return;
    const node = getNode(this._grid, id);
    if (!node || node.cost === cost) return;
    this.executeCommand({
      type: 'grid',
      cmd: {
        type: 'paint-cells',
        edits: [{ id, oldWalkable: node.walkable, newWalkable: node.walkable, oldCost: node.cost, newCost: cost }],
        oldStart: this._grid.start, newStart: this._grid.start,
        oldGoal: this._grid.goal, newGoal: this._grid.goal
      }
    });
  }

  setGridStart(id: NodeId): void {
    const node = getNode(this._grid, id);
    if (!node) return;
    
    const edits = [];
    if (!node.walkable) {
      edits.push({ id, oldWalkable: false, newWalkable: true, oldCost: node.cost, newCost: node.cost });
    }

    this.executeCommand({
      type: 'grid',
      cmd: {
        type: 'paint-cells',
        edits,
        oldStart: this._grid.start, newStart: id,
        oldGoal: this._grid.goal, newGoal: this._grid.goal
      }
    });
  }

  setGridGoal(id: NodeId): void {
    const node = getNode(this._grid, id);
    if (!node) return;

    const edits = [];
    if (!node.walkable) {
      edits.push({ id, oldWalkable: false, newWalkable: true, oldCost: node.cost, newCost: node.cost });
    }

    this.executeCommand({
      type: 'grid',
      cmd: {
        type: 'paint-cells',
        edits,
        oldStart: this._grid.start, newStart: this._grid.start,
        oldGoal: this._grid.goal, newGoal: id
      }
    });
  }

  clearGridStart(): void {
    if (this._grid.start === null) return;
    this.executeCommand({
      type: 'grid',
      cmd: {
        type: 'paint-cells',
        edits: [],
        oldStart: this._grid.start, newStart: null,
        oldGoal: this._grid.goal, newGoal: this._grid.goal
      }
    });
  }

  clearGridGoal(): void {
    if (this._grid.goal === null) return;
    this.executeCommand({
      type: 'grid',
      cmd: {
        type: 'paint-cells',
        edits: [],
        oldStart: this._grid.start, newStart: this._grid.start,
        oldGoal: this._grid.goal, newGoal: null
      }
    });
  }

  /** Resets a single cell to its default walkable, uncosted state. */
  clearGridCell(id: NodeId): void {
    const node = getNode(this._grid, id);
    if (!node) return;
    if (id === this._grid.start || id === this._grid.goal) return;
    this.executeCommand({
      type: 'grid',
      cmd: {
        type: 'paint-cells',
        edits: [{ id, oldWalkable: node.walkable, newWalkable: true, oldCost: node.cost, newCost: 1 }],
        oldStart: this._grid.start, newStart: this._grid.start,
        oldGoal: this._grid.goal, newGoal: this._grid.goal
      }
    });
  }

  private resetGridToDefaults(rows: number, cols: number, target: Grid = this._grid): void {
    const startR = Math.floor(rows / 2);
    const startC = Math.floor(cols / 4);
    const goalR = Math.floor(rows / 2);
    const goalC = Math.floor((cols * 3) / 4);
    setGridStart(target, `${startR},${startC}`);
    setGridGoal(target, `${goalR},${goalC}`);
  }

  // === Graph Getters & Methods ===
  get graph(): ManualGraph {
    this._graphVersion;
    return this._graph;
  }
  handleGenerateGraph() {
    const snapshot = generateRandomGraph({
      nodeCount: this.graphNodeCount,
      edgeMultiplier: this.graphEdgeMultiplier,
      weighted: this.graphWeighted,
      ensurePath: this.graphEnsurePath,
      directed: this.defaultEdgeDirected,
      seed: this.environmentSeed,
    });
    this.replaceGraph(
      snapshot.nodes,
      snapshot.edges,
      snapshot.start,
      snapshot.goal,
    );
  }

  get graphStart(): NodeId | null {
    this._graphVersion;
    return this._graph.start;
  }
  get graphGoal(): NodeId | null {
    this._graphVersion;
    return this._graph.goal;
  }

  get canUndo(): boolean {
    return this._history.canUndo;
  }
  get canRedo(): boolean {
    return this._history.canRedo;
  }

  // Unified history execution
  executeCommand(cmd: EnvCommand) {
    const scope = cmd.type;
    if (this._historyScope !== null && this._historyScope !== scope) {
      this._history.clear();
    }
    this._historyScope = scope;
    invalidatePlaybackIfNeeded();
    this._history.execute(cmd);
  }

  private applyCommandLocally(cmd: EnvCommand, isRedo: boolean) {
    if (cmd.type === "graph") {
      this._graph.execute(cmd.cmd);
      this._graphVersion++;
    } else if (cmd.type === "grid") {
      const gcmd = cmd.cmd;
      if (gcmd.type === 'paint-cells') {
        for (const edit of gcmd.edits) {
          setWall(this._grid, edit.id, edit.newWalkable);
          setCost(this._grid, edit.id, edit.newCost);
        }
        if (gcmd.newStart !== undefined) setGridStart(this._grid, gcmd.newStart);
        if (gcmd.newGoal !== undefined) setGridGoal(this._grid, gcmd.newGoal);
        this._gridVersion++;
      } else if (gcmd.type === 'replace') {
        this.restoreGrid(gcmd.newGrid);
      }
    }
  }

  private invertCommandLocally(cmd: EnvCommand) {
    if (cmd.type === "graph") {
      const inv = invertGraphCommand(cmd.cmd);
      this._graph.execute(inv);
      this._graphVersion++;
    } else if (cmd.type === "grid") {
      const gcmd = cmd.cmd;
      if (gcmd.type === 'paint-cells') {
        for (const edit of gcmd.edits) {
          setWall(this._grid, edit.id, edit.oldWalkable);
          setCost(this._grid, edit.id, edit.oldCost);
        }
        if (gcmd.oldStart !== undefined) setGridStart(this._grid, gcmd.oldStart);
        if (gcmd.oldGoal !== undefined) setGridGoal(this._grid, gcmd.oldGoal);
        this._gridVersion++;
      } else if (gcmd.type === 'replace') {
        this.restoreGrid(gcmd.oldGrid);
      }
    }
  }

  undo() {
    invalidatePlaybackIfNeeded();
    this._history.undo();
  }

  redo() {
    invalidatePlaybackIfNeeded();
    this._history.redo();
  }



  clearGraph() {
    const nodes = Array.from(this._graph.nodes.values());
    const edges = Array.from(this._graph.edges.values());
    this.executeCommand({
      type: "graph",
      cmd: {
        type: "clear",
        nodes,
        edges,
        start: this._graph.start,
        goal: this._graph.goal,
      },
    });
  }
  replaceGraph(
    newNodes: GraphNode[],
    newEdges: GraphEdge[],
    newStart: NodeId | null,
    newGoal: NodeId | null,
  ) {
    const validNodes = newNodes.map((node) => ({ ...node }));
    const validEdges = newEdges.map((edge) => ({ ...edge }));
    const nodeIds = new Set(validNodes.map((node) => node.id));
    if (
      nodeIds.size !== validNodes.length ||
      new Set(validEdges.map((edge) => edge.id)).size !== validEdges.length ||
      validNodes.some((node) =>
        !node.id || typeof node.label !== 'string' || !node.label.trim() || !Number.isFinite(node.x) || !Number.isFinite(node.y) ||
        (node.cost !== undefined && !isValidCost(node.cost))
      ) ||
      validEdges.some((edge) =>
        !edge.id || !nodeIds.has(edge.source) || !nodeIds.has(edge.target) ||
        !isValidCost(edge.weight)
      ) ||
      (newStart !== null && !nodeIds.has(newStart)) ||
      (newGoal !== null && !nodeIds.has(newGoal))
    ) return;

    const oldNodes = Array.from(this._graph.nodes.values(), (node) => ({ ...node }));
    const oldEdges = Array.from(this._graph.edges.values(), (edge) => ({ ...edge }));
    this.executeCommand({
      type: "graph",
      cmd: {
        type: "replace-graph",
        oldNodes,
        oldEdges,
        oldStart: this._graph.start,
        oldGoal: this._graph.goal,
        newNodes: validNodes,
        newEdges: validEdges,
        newStart,
        newGoal,
      },
    });
  }
  addGraphNode(x: number, y: number, label: string): NodeId {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return '';
    const trimmedLabel = label.trim();
    if (!trimmedLabel) return '';
    const id = `node-${generateId(6)}`;
    this.executeCommand({
      type: "graph",
      cmd: { type: "add-node", node: { id, x, y, label: trimmedLabel } },
    });
    return id;
  }
  removeGraphNode(id: NodeId) {
    const node = this._graph.nodes.get(id);
    if (!node) return;
    const attachedEdges = this._graph.getAttachedEdges(id);
    const wasStart = this._graph.start === id;
    const wasGoal = this._graph.goal === id;
    this.executeCommand({
      type: "graph",
      cmd: { type: "remove-node", node, attachedEdges, wasStart, wasGoal },
    });
  }
  moveGraphNode(id: NodeId, x: number, y: number) {
    const node = this._graph.nodes.get(id);
    if (!node || !Number.isFinite(x) || !Number.isFinite(y)) return;
    this.executeCommand({
      type: "graph",
      cmd: {
        type: "move-node",
        id,
        from: { x: node.x, y: node.y },
        to: { x, y },
      },
    });
  }
  addGraphEdge(
    source: NodeId,
    target: NodeId,
    weight: number = 1,
    directed: boolean = this.defaultEdgeDirected,
  ): string {
    if (!isValidCost(weight) || !this._graph.nodes.has(source) || !this._graph.nodes.has(target)) return '';
    const id = `edge-${generateId(6)}`;
    this.executeCommand({
      type: "graph",
      cmd: {
        type: "add-edge",
        edge: { id, source, target, weight, directed },
      },
    });
    return id;
  }
  removeGraphEdge(id: string) {
    const edge = this._graph.edges.get(id);
    if (!edge) return;
    this.executeCommand({ type: "graph", cmd: { type: "remove-edge", edge } });
  }
  setGraphStart(id: NodeId | null) {
    if (id !== null && !this._graph.nodes.has(id)) return;
    if (id === this._graph.start) return;
    this.executeCommand({
      type: "graph",
      cmd: { type: "set-start", from: this._graph.start, to: id },
    });
  }
  setGraphGoal(id: NodeId | null) {
    if (id !== null && !this._graph.nodes.has(id)) return;
    if (id === this._graph.goal) return;
    this.executeCommand({
      type: "graph",
      cmd: { type: "set-goal", from: this._graph.goal, to: id },
    });
  }

	setGraphWeight(edgeId: string, weight: number) {
		const edge = this._graph.edges.get(edgeId);
		if (!edge || !isValidCost(weight) || edge.weight === weight) return;
		this.executeCommand({ type: 'graph', cmd: { type: 'set-weight', edgeId, from: edge.weight, to: weight } });
	}

	setGraphEdgeDirected(edgeId: string, directed: boolean) {
		const edge = this._graph.edges.get(edgeId);
		if (!edge || edge.directed === directed) return;
		this.executeCommand({ type: 'graph', cmd: { type: 'set-edge-directed', edgeId, from: edge.directed, to: directed } });
	}

	setGraphNodeCost(nodeId: NodeId, cost: number) {
		const node = this._graph.nodes.get(nodeId);
		if (!node || !isValidCost(cost) || node.cost === cost) return;
		this.executeCommand({ type: 'graph', cmd: { type: 'set-node-cost', nodeId, from: node.cost, to: cost } });
	}

  setGraphLabel(id: NodeId, label: string) {
    const node = this._graph.nodes.get(id);
    const trimmed = label.trim();
    if (!node || !trimmed || node.label === trimmed) return;
    this.executeCommand({
      type: "graph",
      cmd: { type: "set-label", id, from: node.label, to: trimmed },
    });
  }

  loadGraph(data: unknown): boolean {
    const loadedGraph = new ManualGraph();
    if (!loadedGraph.load(data)) return false;
    this.replaceGraph(
      Array.from(loadedGraph.nodes.values(), (node) => ({ ...node })),
      Array.from(loadedGraph.edges.values(), (edge) => ({ ...edge })),
      loadedGraph.start,
      loadedGraph.goal,
    );
    return true;
  }

  // === Settings Getters & Methods ===
  get selectedAlgorithmId() {
    return this._selectedAlgorithmId;
  }
  set selectedAlgorithmId(id: string) {
    if (this._selectedAlgorithmId === id) return;
    this._selectedAlgorithmId = id;
    invalidatePlaybackIfNeeded();
  }

  get currentAlgorithm() {
    return getAlgorithm(this._selectedAlgorithmId);
  }

  get showCosts() {
    return this._showCosts;
  }
  set showCosts(val: boolean) {
    this._showCosts = val;
  }

  get environmentType() {
    return this._environmentType;
  }
  set environmentType(val: EnvironmentType) {
    if (this._environmentType === val) return;
    this._environmentType = val;
    this._history.clear();
    this._historyScope = null;
    invalidatePlaybackIfNeeded();
  }

  get environmentSeed() {
    return this._environmentSeed;
  }
  set environmentSeed(val: number) {
    this._environmentSeed = Number.isFinite(val) ? Math.trunc(val) : this._environmentSeed;
  }

  get loopDensity() {
    return this._loopDensity;
  }
  set loopDensity(val: number) {
    this._loopDensity = Math.max(0, Math.min(100, finiteOr(val, this._loopDensity)));
  }

  get obstacleDensity() {
    return this._obstacleDensity;
  }
  set obstacleDensity(val: number) {
    this._obstacleDensity = Math.max(0, Math.min(100, finiteOr(val, this._obstacleDensity)));
  }

  get gridRowsSetting() {
    return this._gridRowsSetting;
  }
  set gridRowsSetting(val: number) {
    this._gridRowsSetting = clampSetting(val, 5, 100, this._gridRowsSetting);
  }

  get gridColsSetting() {
    return this._gridColsSetting;
  }
  set gridColsSetting(val: number) {
    this._gridColsSetting = clampSetting(val, 5, 100, this._gridColsSetting);
  }

  get graphNodeCount() {
    return this._graphNodeCount;
  }
  set graphNodeCount(val: number) {
    this._graphNodeCount = clampSetting(val, 5, 100, this._graphNodeCount);
  }

  get graphEdgeMultiplier() {
    return this._graphEdgeMultiplier;
  }
  set graphEdgeMultiplier(val: number) {
    this._graphEdgeMultiplier = Math.max(0, Math.min(10, finiteOr(val, this._graphEdgeMultiplier)));
  }

  get graphEnsurePath() {
    return this._graphEnsurePath;
  }
  set graphEnsurePath(val: boolean) {
    this._graphEnsurePath = val;
  }

  get graphWeighted() {
    return this._graphWeighted;
  }
  set graphWeighted(val: boolean) {
    this._graphWeighted = val;
  }

  get defaultEdgeDirected() {
    return this._defaultEdgeDirected;
  }
  set defaultEdgeDirected(val: boolean) {
    this._defaultEdgeDirected = val;
  }

  getProblem(): Problem {
    if (this.environmentType === "graph") {
      return {
        type: "graph",
        graph: this.graph,
        costModel: defaultGraphCostModel,
        version: createProblemVersion(),
      };
    } else {
      return {
        type: "grid",
        grid: this.grid,
        movementModel: defaultMovementModel,
        costModel: defaultGridCostModel,
        version: createProblemVersion(),
      };
    }
  }

  runAlgorithm(mode?: RunAlgorithmMode): ExecutionId | null {
    const algo = this.currentAlgorithm;
    if (!algo) return null;

    const problem = this.getProblem();

    try {
      const executionId = executionStore.run(problem, this._selectedAlgorithmId);
      const activeExecution = executionStore.activeExecution;
      if (activeExecution) playbackState.loadExecution(activeExecution);

      const compareExecution = executionStore.isComparing
        ? executionStore.compareExecution
        : null;
      if (compareExecution) comparePlaybackState.loadExecution(compareExecution);

      if (mode === "autoplay") {
        playbackState.play();
        if (compareExecution) comparePlaybackState.play();
      } else if (mode === "step") {
        playbackState.step();
        if (compareExecution) comparePlaybackState.step();
      }

      return executionId;
    } catch (e) {
      console.warn("Run failed:", e);
      return null;
    }
  }
}

export const environmentState = new EnvironmentState();
