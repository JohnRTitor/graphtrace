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
import { comparePlaybackStates, playbackState } from "./playback.svelte";
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
import {
  allEnvironmentTypes,
  defaultGameTreeGeneratorOptions,
  type GameTreeGeneratorOptions,
} from "../generators/types";
import { generateRandomGraph } from "../generators/random-graph";
import { generatePerfectMaze, generateBraidedMaze } from "../generators/maze";
import { generateRandomGrid, generateBlankGrid } from "../generators/random";
import {
  buildManualGameTree,
  generateNim,
  generateRandomGameTree,
  generateTicTacToe,
} from "../generators/game";
import { getAlgorithm, getGameSearchAlgorithm, getAlgorithmSummary } from "../algorithms";
import {
  cloneGameTree,
  collectSubtree,
  createGameTree,
  deriveDepths,
  invertGameTreeCommand,
  isValidUtility,
  loadGameTree,
  restoreGameTree,
  serializeGameTree,
  type GameTree,
  type GameTreeCommand,
  type GamePlayer,
} from "../graph/game-tree";
import { PRNG } from "../utils/random";
import { defaultAlgorithmId, familyForEnvironment, getFamily } from "../families/registry";
import { invertGraphCommand } from "../graph/manual";
import type { EnvCommand } from "../domain/command";
import type { GridCommand, GridSnapshot } from "../graph/commands";

export type RunAlgorithmMode = "autoplay" | "step";

/** Environment types drawn with a node-edge canvas rather than the cell grid. */
const GRAPH_LIKE_ENVIRONMENTS = new Set<EnvironmentType>([
  "graph",
  "manual_tree",
  "tic_tac_toe",
  "tic_tac_toe_limited",
  "nim",
  "random_tree",
]);

export function isGraphLikeEnvironment(type: EnvironmentType): boolean {
  return GRAPH_LIKE_ENVIRONMENTS.has(type);
}


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

  // --- Game Tree State (adversarial family) ---
  private _gameTree = $state<GameTree>(buildManualGameTree());
  private _gameTreeVersion = $state(0);

  // --- Family State ---
  private _familyId = $state<string>("pathfinding");

  // --- Settings State ---
  private _selectedAlgorithmId = $state<string>("bfs");
  private _showCosts = $state<boolean>(true);
  private _environmentType = $state<EnvironmentType>("blank");
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
  private _runError = $state<string | null>(null);

  // --- Adversarial generator settings ---
  private _gameTreeOptions = $state<GameTreeGeneratorOptions>({
    ...defaultGameTreeGeneratorOptions,
  });

  // --- History State ---
  private _history: HistoryStore<EnvCommand>;
  private _historyScope: EnvCommand["type"] | null = null;

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
        cell.id !== `${cell.row},${cell.col}` ||
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
    if (!Number.isFinite(rows) || !Number.isFinite(cols) || rows < 1 || cols < 1 || rows > 100 || cols > 100) return;
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
     if (id === this._grid.start) return;
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
     if (id === this._grid.goal) return;
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

  // === Game Tree Getters & Methods ===

  get gameTree(): GameTree {
    this._gameTreeVersion;
    return this._gameTree;
  }

  get gameTreeRoot(): NodeId | null {
    this._gameTreeVersion;
    return this._gameTree.root;
  }

  get gameTreeOptions(): GameTreeGeneratorOptions {
    return this._gameTreeOptions;
  }

  updateGameTreeOptions(patch: Partial<GameTreeGeneratorOptions>): void {
    this._gameTreeOptions = { ...this._gameTreeOptions, ...patch };
  }

  private applyGameTreeCommand(cmd: GameTreeCommand): void {
    switch (cmd.type) {
      case 'set-player': {
        const node = this._gameTree.nodes.get(cmd.id);
        if (node && node.player !== cmd.to) {
          node.player = cmd.to;
          if (cmd.to === 'terminal') node.utility ??= 0;
        }
        break;
      }
      case 'set-utility': {
        const node = this._gameTree.nodes.get(cmd.id);
        if (node) node.utility = cmd.to;
        break;
      }
      case 'set-move-label': {
        const node = this._gameTree.nodes.get(cmd.id);
        if (node) node.moveLabel = cmd.to;
        break;
      }
      case 'replace-tree':
        restoreGameTree(this._gameTree, cmd.after);
        break;
    }
    this._gameTreeVersion++;
  }

  /** Replaces the whole tree through the command layer so it is undoable. */
  private replaceGameTree(next: GameTree): void {
    const before = serializeGameTree(this._gameTree);
    const after = serializeGameTree(next);
    this.executeCommand({ type: 'game-tree', cmd: { type: 'replace-tree', before, after } });
  }

  /**
   * Regenerates the environment for the active family.
   *
   * Dispatch lives in the environment rather than in a panel so the generator
   * choice and the current settings can never drift apart, and so a test can
   * exercise generation without mounting a component.
   */
  handleGenerate(): void {
    if (this.isAdversarialFamily) {
      this.handleGenerateGameTree();
      return;
    }

    if (this.environmentType === "graph") {
      const snapshot = generateRandomGraph({
        nodeCount: this.graphNodeCount,
        edgeMultiplier: this.graphEdgeMultiplier,
        weighted: this.graphWeighted && !!getAlgorithmSummary(this._selectedAlgorithmId)?.supportsWeights,
        ensurePath: this.graphEnsurePath,
        directed: this.defaultEdgeDirected,
        seed: this._environmentSeed,
      });
      this.replaceGraph(snapshot.nodes, snapshot.edges, snapshot.start, snapshot.goal);
      return;
    }

    const options = {
      seed: this._environmentSeed,
      loopDensity: this.loopDensity,
      obstacleDensity: this.obstacleDensity,
      weighted: !!getAlgorithmSummary(this._selectedAlgorithmId)?.supportsWeights,
    };

    const rows = this._gridRowsSetting;
    const cols = this._gridColsSetting;
    let nextGrid: Grid;
    switch (this.environmentType) {
      case "perfect_maze":
        nextGrid = generatePerfectMaze(rows, cols, options);
        break;
      case "braided_maze":
        nextGrid = generateBraidedMaze(rows, cols, options);
        break;
      case "random_obstacles":
        nextGrid = generateRandomGrid(rows, cols, options);
        break;
      case "blank":
      default:
        nextGrid = generateBlankGrid(rows, cols, options);
        break;
    }

    this.replaceGrid(nextGrid);
  }

  handleGenerateGameTree(): void {    const seed = this._environmentSeed;
    const options = this._gameTreeOptions;
    switch (this._environmentType) {
      case 'tic_tac_toe':
        this.replaceGameTree(generateTicTacToe({ seed, maxDepth: 0 }));
        break;
      case 'tic_tac_toe_limited':
        this.replaceGameTree(generateTicTacToe({ seed, maxDepth: options.tttDepth || 4 }));
        break;
      case 'nim':
        this.replaceGameTree(
          generateNim({
            seed,
            heapCount: options.nimHeapCount,
            maxStones: options.nimMaxStones
          })
        );
        break;
      case 'random_tree':
        this.replaceGameTree(
          generateRandomGameTree({
            seed,
            branchingFactor: options.randomBranching,
            depth: options.randomDepth,
            minUtility: options.randomMinUtility,
            maxUtility: options.randomMaxUtility
          })
        );
        break;
      case 'manual_tree':
      default:
        this.replaceGameTree(buildManualGameTree());
        break;
    }
  }

  clearGameTree(): void {
    this.replaceGameTree(createGameTree());
  }

  /** Adds a child move to `parentId`, choosing the node kind from its current role. */
  addGameTreeChild(parentId: NodeId): NodeId | null {
    const parent = this._gameTree.nodes.get(parentId);
    if (!parent || parent.player === 'terminal') return null;

    // A new child of a MAX node is a MIN node and vice versa. If the parent
    // already has children, the sibling is a terminal leaf to copy.
    const existing = this._gameTree.children.get(parentId) ?? [];
    const player: GamePlayer =
      existing.length > 0
        ? (this._gameTree.nodes.get(existing[0])?.player ??
          (parent.player === 'max' ? 'min' : 'max'))
        : parent.player === 'max'
          ? 'min'
          : 'max';

    const id = this.nextGameTreeId();
    const next = cloneGameTree(this._gameTree);
    next.nodes.set(id, {
      id,
      parent: parentId,
      depth: parent.depth + 1,
      player,
      utility: player === 'terminal' ? 0 : null,
      moveLabel: `m${existing.length + 1}`
    });
    next.children.set(id, []);
    next.children.set(parentId, [...existing, id]);
    deriveDepths(next.nodes, next.children, next.root!);
    this.replaceGameTree(next);
    return id;
  }

  /** Removes a node and everything below it. */
  removeGameTreeNode(id: NodeId): void {
    const root = this._gameTree.root;
    if (id === root) {
      this.clearGameTree();
      return;
    }
    const node = this._gameTree.nodes.get(id);
    if (!node || node.parent === null) return;
    const siblings = this._gameTree.children.get(node.parent) ?? [];
    const next = cloneGameTree(this._gameTree);
    next.children.set(
      node.parent,
      siblings.filter((child) => child !== id)
    );
    for (const removed of collectSubtree(this._gameTree, id)) {
      next.nodes.delete(removed.id);
      next.children.delete(removed.id);
    }
    next.nodes.delete(id);
    next.children.delete(id);
    deriveDepths(next.nodes, next.children, root!);
    this.replaceGameTree(next);
  }

  setGameTreePlayer(id: NodeId, player: GamePlayer): void {
    const node = this._gameTree.nodes.get(id);
    if (!node || node.player === player) return;
    this.executeCommand({
      type: 'game-tree',
      cmd: { type: 'set-player', id, from: node.player, to: player }
    });
  }

  setGameTreeUtility(id: NodeId, utility: number): void {
    const node = this._gameTree.nodes.get(id);
    if (!node || !isValidUtility(utility) || node.utility === utility) return;
    this.executeCommand({
      type: 'game-tree',
      cmd: { type: 'set-utility', id, from: node.utility, to: utility }
    });
  }

  setGameTreeMoveLabel(id: NodeId, label: string): void {
    const node = this._gameTree.nodes.get(id);
    const trimmed = label.trim();
    if (!node || !trimmed || node.moveLabel === trimmed) return;
    this.executeCommand({
      type: 'game-tree',
      cmd: { type: 'set-move-label', id, from: node.moveLabel, to: trimmed }
    });
  }

  /**
   * Promotes a node to the root of the whole tree by re-rooting above it, so a
   * subtree can be studied in isolation without rebuilding the tree.
   */
  makeGameTreeRoot(id: NodeId): void {
    if (id === this._gameTree.root) return;
    const node = this._gameTree.nodes.get(id);
    if (!node) return;

    const next = cloneGameTree(this._gameTree);
    // Detach from the current parent, then graft the old root underneath.
    if (node.parent !== null) {
      const siblings = next.children.get(node.parent) ?? [];
      next.children.set(
        node.parent,
       	siblings.filter((child) => child !== id)
      );
    }
    if (next.root !== null) {
      next.nodes.get(next.root)!.parent = id;
      next.children.set(id, [...(next.children.get(id) ?? []), next.root]);
    }
    next.root = id;
    deriveDepths(next.nodes, next.children, id);
    this.replaceGameTree(next);
  }

  /** Appends a random new leaf position to a random interior node. */
  randomizeGameTreeTerminals(): void {
    const prng = new PRNG(this._environmentSeed ^ (this._gameTree.nodes.size * 2654435761));
    const next = cloneGameTree(this._gameTree);
    let changed = 0;
    for (const node of next.nodes.values()) {
      if (node.player !== 'terminal') continue;
      node.utility = prng.nextInt(-9, 10);
      changed++;
    }
    if (changed === 0) return;
    this.replaceGameTree(next);
  }

  private nextGameTreeId(): NodeId {
    let id = `gt-${generateId(6)}`;
    while (this._gameTree.nodes.has(id)) id = `gt-${generateId(6)}`;
    return id;
  }

  loadGameTreeData(data: unknown): boolean {
    const loaded = loadGameTree(data);
    if (!loaded) return false;
    this.replaceGameTree(loaded);
    return true;
  }

  get canUndo(): boolean {
    return this._history.canUndo;
  }
  get canRedo(): boolean {
    return this._history.canRedo;
  }

  // Unified history execution
  executeCommand(cmd: EnvCommand) {
    this._runError = null;
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
    } else if (cmd.type === "game-tree") {
      this.applyGameTreeCommand(cmd.cmd);
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
    } else if (cmd.type === "game-tree") {
      this.applyGameTreeCommand(invertGameTreeCommand(cmd.cmd));
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

  revertGridCommand(cmd: GridCommand): void {
    if (cmd.type !== 'paint-cells') return;
    for (const edit of cmd.edits) {
      setWall(this._grid, edit.id, edit.oldWalkable);
      setCost(this._grid, edit.id, edit.oldCost);
    }
    if (cmd.oldStart !== undefined) setGridStart(this._grid, cmd.oldStart);
    if (cmd.oldGoal !== undefined) setGridGoal(this._grid, cmd.oldGoal);
    this._gridVersion++;
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
    let id = `node-${generateId(6)}`;
    while (this._graph.nodes.has(id)) id = `node-${generateId(6)}`;
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
   restoreGraphNodePosition(id: NodeId, x: number, y: number): void {
     const node = this._graph.nodes.get(id);
     if (!node || !Number.isFinite(x) || !Number.isFinite(y)) return;
     node.x = x;
     node.y = y;
     this._graphVersion++;
   }

  addGraphEdge(
    source: NodeId,
    target: NodeId,
    weight: number = 1,
    directed: boolean = this.defaultEdgeDirected,
  ): string {
    if (!isValidCost(weight) || !this._graph.nodes.has(source) || !this._graph.nodes.has(target)) return '';
    let id = `edge-${generateId(6)}`;
    while (this._graph.edges.has(id)) id = `edge-${generateId(6)}`;
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
    // An algorithm id is valid if either family registry knows it; the palette
    // filters to the active family, but the setter stays permissive so loading a
    // workspace or a deep link cannot silently fail.
    if (!getAlgorithm(id) && !getGameSearchAlgorithm(id)) return;
    this._runError = null;
    this._selectedAlgorithmId = id;
    // Keep the family aligned with the algorithm so the renderer follows the run.
    const summary = getAlgorithmSummary(id);
    if (summary && summary.familyId !== this._familyId) {
      this._familyId = summary.familyId;
    }
    invalidatePlaybackIfNeeded();
  }

  get currentAlgorithm() {
    if (this._familyId === 'adversarial') {
      return getGameSearchAlgorithm(this._selectedAlgorithmId);
    }
    return getAlgorithm(this._selectedAlgorithmId);
  }

  get runError(): string | null {
    return this._runError;
  }

  get showCosts() {
    return this._showCosts;
  }
  set showCosts(val: boolean) {
    this._showCosts = val;
  }

  /**
   * The active problem family.
   *
   * Setting it switches family wholesale: the environment moves to that family's
   * first environment type and the selected algorithm to that family's default,
   * because an algorithm from another family cannot run here. The playback dock,
   * save/load, theming and shortcuts are unaffected by construction - none of
   * them read this value.
   */
  get familyId() {
    return this._familyId;
  }
  set familyId(id: string) {
    const family = getFamily(id);
    if (!family || family.status !== 'ready') return;
    if (this._familyId === id) return;

    this._familyId = id;
    this._runError = null;
    this._history.clear();
    this._historyScope = null;
    invalidatePlaybackIfNeeded();

    const defaultAlgorithm = defaultAlgorithmId(family);
    if (defaultAlgorithm) this._selectedAlgorithmId = defaultAlgorithm;
    if (
      family.environmentTypes.length > 0 &&
      !family.environmentTypes.includes(this._environmentType)
    ) {
      this._environmentType = family.environmentTypes[0];
    }
  }

  get family() {
    return getFamily(this._familyId);
  }

  get isPathfindingFamily() {
    return this._familyId === "pathfinding";
  }

  get isAdversarialFamily() {
    return this._familyId === "adversarial";
  }

  /**
   * True when the environment is a manual graph drawn with the node-edge editor.
   * The adversarial family is also node-edge, but its interactions are game
   * moves and utilities rather than graph topology, so it is deliberately not
   * routed through the graph editor's edit modes.
   */
  get isPathfindingGraph() {
    return this._familyId === "pathfinding" && this._environmentType === "graph";
  }

  get environmentType() {
    return this._environmentType;
  }
  set environmentType(val: EnvironmentType) {
    if (!allEnvironmentTypes.includes(val)) return;
    if (this._environmentType === val) return;
    this._environmentType = val;
    this._runError = null;
    this._history.clear();
    this._historyScope = null;
    invalidatePlaybackIfNeeded();

    // The environment type determines the owning family, so keep the two in step
    // and move the algorithm to one that can actually run here.
    const owner = familyForEnvironment(val);
    if (owner && owner.status === 'ready' && owner.id !== this._familyId) {
      this._familyId = owner.id;
      const defaultAlgorithm = defaultAlgorithmId(owner);
      if (defaultAlgorithm) this._selectedAlgorithmId = defaultAlgorithm;
    }
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
    if (isGraphLikeEnvironment(this.environmentType) && this._familyId === "adversarial") {
      return {
        type: "game-tree",
        family: "adversarial",
        tree: this.gameTree,
        version: createProblemVersion(),
      };
    }
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
    this._runError = null;
    const algo = this.currentAlgorithm;
    if (!algo) {
      this._runError = 'Select an algorithm before running.';
      return null;
    }

    const problem = this.getProblem();

    try {
      const executionId = executionStore.run(problem, this._selectedAlgorithmId);

      // Mounting decides which pane the run landed in, so the panes to drive are
      // read back from the store rather than assumed. Loading is explicit rather
      // than left to the panes' reactive effects: a run is an imperative event,
      // and the effect that normally catches a new active execution cannot be
      // relied on to flush before the caller steps the trace.
      const panes = executionStore.paneExecutions;
      const playStates = [playbackState, ...comparePlaybackStates].slice(0, panes.length);
      for (const state of playStates) state.loadExecution(state.execution);

      if (mode === "autoplay") {
        for (const state of playStates) state.play();
      } else if (mode === "step") {
        for (const state of playStates) state.step();
      }

      return executionId;
    } catch (e) {
      this._runError = e instanceof Error ? e.message : 'Unable to run the selected algorithm.';
      return null;
    }
  }
}

export const environmentState = new EnvironmentState();
