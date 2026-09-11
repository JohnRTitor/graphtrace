import {
  createGrid,
  setWall,
  setCost,
  setStart as setGridStart,
  setGoal as setGridGoal,
  clearGrid,
  getNode,
} from "../graph/grid";
import type { Grid, NodeId } from "../graph/types";
import {
  ManualGraph,
  type GraphCommand,
  type GraphEdge,
  type GraphNode,
} from "../graph/manual";
import { generateId } from "../utils";
import { GridAdapter } from "../graph/graph-adapter";
import { playbackState } from "./playback.svelte";
import { executionStore } from "./execution-store.svelte";
import { createProblemVersion, type Problem } from "../domain/problem";
import {
  defaultGridCostModel,
  defaultGraphCostModel,
} from "../domain/cost-model";
import { defaultMovementModel } from "../domain/movement-model";
import type { EnvironmentType } from "../generators/types";
import { generateRandomGraph } from "../generators/random-graph";
import { getAlgorithm } from "../algorithms";
import { invertGraphCommand } from "../graph/manual";
import type { EnvCommand, GridBatchCommand } from "../domain/command";

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
  private _undoStack = $state<EnvCommand[]>([]);
  private _redoStack = $state<EnvCommand[]>([]);
  private _activeGridBatch = $state<GridBatchCommand | null>(null);

  constructor() {
    this.resetGridToDefaults(31, 41);
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

  private recordGridEdit(id: NodeId, newWalkable: boolean, newCost: number) {
    const node = getNode(this._grid, id);
    if (!node) return;

    let batch = this._activeGridBatch;
    let isAutoBatch = false;
    if (!batch) {
      batch = {
        type: "grid-batch",
        edits: [],
        oldStart: this._grid.start,
        newStart: this._grid.start,
        oldGoal: this._grid.goal,
        newGoal: this._grid.goal,
      };
      isAutoBatch = true;
    }

    const existing = batch.edits.find((e) => e.id === id);
    if (existing) {
      existing.newWalkable = newWalkable;
      existing.newCost = newCost;
    } else {
      batch.edits.push({
        id,
        oldWalkable: node.walkable,
        newWalkable,
        oldCost: node.cost,
        newCost,
      });
    }

    if (isAutoBatch) {
      this.executeCommand(batch);
    } else {
      // apply mutation incrementally since we are in a batch
      setWall(this._grid, id, newWalkable);
      setCost(this._grid, id, newCost);
      this._gridVersion++;
    }
  }

  toggleGridWall(id: NodeId): void {
    const node = getNode(this._grid, id);
    if (!node) return;
    if (id === this._grid.start || id === this._grid.goal) return;
    this.recordGridEdit(id, !node.walkable, node.cost);
  }

  setGridWall(id: NodeId, isWall: boolean): void {
    if (isWall && (id === this._grid.start || id === this._grid.goal)) return;
    const node = getNode(this._grid, id);
    if (!node) return;
    this.recordGridEdit(id, !isWall, node.cost);
  }

  setGridCost(id: NodeId, cost: number): void {
    if (id === this._grid.start || id === this._grid.goal) return;
    const node = getNode(this._grid, id);
    if (!node) return;
    this.recordGridEdit(id, node.walkable, cost);
  }

  setGridStart(id: NodeId): void {
    const node = getNode(this._grid, id);
    if (!node) return;

    const isAutoBatch = !this._activeGridBatch;
    if (isAutoBatch) this.beginGridBatch();

    if (!node.walkable) this.recordGridEdit(id, true, node.cost);
    this._activeGridBatch!.newStart = id;
    setGridStart(this._grid, id);
    this._gridVersion++;

    if (isAutoBatch) this.commitGridBatch();
  }

  setGridGoal(id: NodeId): void {
    const node = getNode(this._grid, id);
    if (!node) return;

    const isAutoBatch = !this._activeGridBatch;
    if (isAutoBatch) this.beginGridBatch();

    if (!node.walkable) this.recordGridEdit(id, true, node.cost);
    this._activeGridBatch!.newGoal = id;
    setGridGoal(this._grid, id);
    this._gridVersion++;

    if (isAutoBatch) this.commitGridBatch();
  }

  clearGridStart(): void {
    if (this._grid.start === null) return;
    const isAutoBatch = !this._activeGridBatch;
    if (isAutoBatch) this.beginGridBatch();

    this._activeGridBatch!.newStart = null;
    setGridStart(this._grid, null);
    this._gridVersion++;

    if (isAutoBatch) this.commitGridBatch();
  }

  clearGridGoal(): void {
    if (this._grid.goal === null) return;
    const isAutoBatch = !this._activeGridBatch;
    if (isAutoBatch) this.beginGridBatch();

    this._activeGridBatch!.newGoal = null;
    setGridGoal(this._grid, null);
    this._gridVersion++;

    if (isAutoBatch) this.commitGridBatch();
  }

  /** Resets a single cell to its default walkable, uncosted state. */
  clearGridCell(id: NodeId): void {
    const node = getNode(this._grid, id);
    if (!node) return;
    if (id === this._grid.start || id === this._grid.goal) return;
    this.recordGridEdit(id, true, 1);
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
    return this._undoStack.length > 0;
  }
  get canRedo(): boolean {
    return this._redoStack.length > 0;
  }

  // Unified history execution
  executeCommand(cmd: EnvCommand, isRedo = false) {
    playbackState.reset();

    // Optimization for continuous move-node
    if (!isRedo && cmd.type === "graph" && cmd.cmd.type === "move-node") {
      const last = this._undoStack[this._undoStack.length - 1];
      if (
        last &&
        last.type === "graph" &&
        last.cmd.type === "move-node" &&
        last.cmd.id === cmd.cmd.id
      ) {
        // apply to graph
        this._graph.execute(cmd.cmd);
        this._graphVersion++;
        // squash in undo stack
        last.cmd.to = cmd.cmd.to;
        return;
      }
    }

    if (cmd.type === "graph") {
      this._graph.execute(cmd.cmd);
      this._graphVersion++;
    } else if (cmd.type === "grid-batch") {
      for (const edit of cmd.edits) {
        setWall(this._grid, edit.id, edit.newWalkable);
        setCost(this._grid, edit.id, edit.newCost);
      }
      if (cmd.newStart !== undefined) setGridStart(this._grid, cmd.newStart);
      if (cmd.newGoal !== undefined) setGridGoal(this._grid, cmd.newGoal);
      this._gridVersion++;
    }

    if (!isRedo) {
      this._undoStack.push(cmd);
      this._redoStack = [];
    }
  }

  undo() {
    const cmd = this._undoStack.pop();
    if (!cmd) return;
    playbackState.reset();

    if (cmd.type === "graph") {
      const inv = invertGraphCommand(cmd.cmd);
      this._graph.execute(inv);
      this._graphVersion++;
    } else if (cmd.type === "grid-batch") {
      for (const edit of cmd.edits) {
        setWall(this._grid, edit.id, edit.oldWalkable);
        setCost(this._grid, edit.id, edit.oldCost);
      }
      if (cmd.oldStart !== undefined) setGridStart(this._grid, cmd.oldStart);
      if (cmd.oldGoal !== undefined) setGridGoal(this._grid, cmd.oldGoal);
      this._gridVersion++;
    }

    this._redoStack.push(cmd);
  }

  redo() {
    const cmd = this._redoStack.pop();
    if (!cmd) return;
    this.executeCommand(cmd, true);
    this._undoStack.push(cmd);
  }

  // Batching for continuous interactions (e.g. pointer drag)
  beginGridBatch() {
    this._activeGridBatch = {
      type: "grid-batch",
      edits: [],
      oldStart: this._grid.start,
      newStart: this._grid.start,
      oldGoal: this._grid.goal,
      newGoal: this._grid.goal,
    };
  }

  commitGridBatch() {
    if (
      this._activeGridBatch &&
      (this._activeGridBatch.edits.length > 0 ||
        this._activeGridBatch.oldStart !== this._activeGridBatch.newStart ||
        this._activeGridBatch.oldGoal !== this._activeGridBatch.newGoal)
    ) {
      // Instead of calling executeCommand (which would re-apply the edits that were already applied incrementally),
      // we just push it to the stack.
      this._undoStack.push(this._activeGridBatch);
      this._redoStack = [];
    }
    this._activeGridBatch = null;
  }

  clearGraph() {
    playbackState.reset();
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
    playbackState.reset();
    const oldNodes = Array.from(this._graph.nodes.values());
    const oldEdges = Array.from(this._graph.edges.values());
    this.executeCommand({
      type: "graph",
      cmd: {
        type: "replace-graph",
        oldNodes,
        oldEdges,
        oldStart: this._graph.start,
        oldGoal: this._graph.goal,
        newNodes,
        newEdges,
        newStart,
        newGoal,
      },
    });
  }
  addGraphNode(x: number, y: number, label: string): NodeId {
    const id = `node-${generateId(6)}`;
    this.executeCommand({
      type: "graph",
      cmd: { type: "add-node", node: { id, x, y, label } },
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
    if (!node) return;
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
    this.executeCommand({
      type: "graph",
      cmd: { type: "set-start", from: this._graph.start, to: id },
    });
  }
  setGraphGoal(id: NodeId | null) {
    this.executeCommand({
      type: "graph",
      cmd: { type: "set-goal", from: this._graph.goal, to: id },
    });
  }

	setGraphWeight(edgeId: string, weight: number) {
		const edge = this._graph.edges.get(edgeId);
		if (!edge || edge.weight === weight) return;
		this.executeCommand({ type: 'graph', cmd: { type: 'set-weight', edgeId, from: edge.weight, to: weight } });
	}

	setGraphEdgeDirected(edgeId: string, directed: boolean) {
		const edge = this._graph.edges.get(edgeId);
		if (!edge || edge.directed === directed) return;
		this.executeCommand({ type: 'graph', cmd: { type: 'set-edge-directed', edgeId, from: edge.directed, to: directed } });
	}

	setGraphNodeCost(nodeId: NodeId, cost: number) {
		const node = this._graph.nodes.get(nodeId);
		if (!node || node.cost === cost) return;
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

  loadGraph(data: any) {
    this._graph.load(data);
    this._graphVersion++;
  }

  // === Settings Getters & Methods ===
  get selectedAlgorithmId() {
    return this._selectedAlgorithmId;
  }
  set selectedAlgorithmId(id: string) {
    this._selectedAlgorithmId = id;
    playbackState.reset();
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
    this._environmentType = val;
  }

  get environmentSeed() {
    return this._environmentSeed;
  }
  set environmentSeed(val: number) {
    this._environmentSeed = val;
  }

  get loopDensity() {
    return this._loopDensity;
  }
  set loopDensity(val: number) {
    this._loopDensity = Math.max(0, Math.min(100, val));
  }

  get obstacleDensity() {
    return this._obstacleDensity;
  }
  set obstacleDensity(val: number) {
    this._obstacleDensity = Math.max(0, Math.min(100, val));
  }

  get gridRowsSetting() {
    return this._gridRowsSetting;
  }
  set gridRowsSetting(val: number) {
    this._gridRowsSetting = Math.max(5, Math.min(100, val));
  }

  get gridColsSetting() {
    return this._gridColsSetting;
  }
  set gridColsSetting(val: number) {
    this._gridColsSetting = Math.max(5, Math.min(100, val));
  }

  get graphNodeCount() {
    return this._graphNodeCount;
  }
  set graphNodeCount(val: number) {
    this._graphNodeCount = Math.max(5, Math.min(100, val));
  }

  get graphEdgeMultiplier() {
    return this._graphEdgeMultiplier;
  }
  set graphEdgeMultiplier(val: number) {
    this._graphEdgeMultiplier = Math.max(0, Math.min(10, val));
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
        graph: this._graph,
        costModel: defaultGraphCostModel,
        version: createProblemVersion(),
      };
    } else {
      return {
        type: "grid",
        grid: this._grid,
        movementModel: defaultMovementModel,
        costModel: defaultGridCostModel,
        version: createProblemVersion(),
      };
    }
  }

  runAlgorithm() {
    const algo = this.currentAlgorithm;
    if (!algo) return;

    const problem = this.getProblem();

    try {
      executionStore.run(problem, this._selectedAlgorithmId);
    } catch (e) {
      console.warn("Run failed:", e);
    }
  }
}

export const environmentState = new EnvironmentState();
