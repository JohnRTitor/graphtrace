import type { GameTree } from '../../graph/game-tree';
import type { NodeId } from '../../graph/types';

/**
 * The adversarial family's event vocabulary.
 *
 * This union is the *payload* of a `TraceEvent` envelope (see
 * `src/lib/trace/types.ts`); the envelope's `kind` equals each member's `type`.
 * It is deliberately disjoint from the pathfinding vocabulary: a game tree has no
 * frontier, no start/goal pair, and no path.
 */
export type GameTreeEvent =
	| { type: 'start'; node: NodeId }
	| { type: 'visit'; node: NodeId; depth: number; player: 'max' | 'min' | 'terminal' }
	| { type: 'evaluate'; node: NodeId; value: number }
	| {
			type: 'prune';
			/** The child that was skipped. */
			node: NodeId;
			/** The whole skipped region, so the renderer can dim an entire subtree. */
			subtreeRoot: NodeId;
			alpha: number;
			beta: number;
			reason: 'alpha' | 'beta';
	  }
	| { type: 'backup'; node: NodeId; value: number; alpha: number; beta: number }
	| { type: 'choose'; node: NodeId; move: NodeId | null; value: number }
	| { type: 'finish'; rootValue: number };

/** `kind` strings for `GameTreeEvent`, in the order the family declares them. */
export const gameTreeEventKinds = [
	'start',
	'visit',
	'evaluate',
	'prune',
	'backup',
	'choose',
	'finish'
] as const;

export type GameTreeEventKind = (typeof gameTreeEventKinds)[number];

export const gameTreeEventKindsByType: Record<GameTreeEvent['type'], GameTreeEventKind> = {
	start: 'start',
	visit: 'visit',
	evaluate: 'evaluate',
	prune: 'prune',
	backup: 'backup',
	choose: 'choose',
	finish: 'finish'
};

export type GameTreeMetrics = {
	/**
	 * Every node the search entered, terminal leaves included. For an unpruned
	 * search this equals the tree's node count, which makes it directly
	 * comparable to "nodes expanded" in the pathfinding family.
	 */
	nodesVisited: number;
	/** Nodes never entered because an ancestor cut the branch. */
	nodesPruned: number;
	/** `nodesPruned / totalNodes` as a percentage, 0-100. */
	pruneRate: number;
	/** Deepest node reached, in moves from the root. */
	maxDepthReached: number;
	/** Average moves per interior node across the whole tree. */
	branchingFactor: number;
	/** Terminal positions whose utility was read. */
	leafEvaluations: number;
	/** Utility backed up to the root. */
	rootValue: number;
	executionTimeMs: number;
};

export type GameTreeResult = {
	events: GameTreeEvent[];
	metrics: GameTreeMetrics;
	/** Root-to-terminal move sequence the root player would pick. */
	principalVariation: NodeId[];
};

export type AlgorithmComplexity = {
	time: string;
	space: string;
};

export type AlgorithmProperties = {
	/** Always returns a provably best move for the root player. */
	optimal: boolean;
	/** Guaranteed to evaluate the full game tree (no branches skipped). */
	complete: boolean;
};

/**
 * The adversarial family's algorithm interface.
 *
 * It mirrors the shape of the pathfinding `Algorithm` (name, description,
 * `run`) but is a separate type rather than an extension, because a game tree
 * has no start/goal pair and no `BaseGraph` neighbour enumeration. The two
 * interfaces are kept separate on purpose: unifying them behind a
 * `run(input: any)` signature would erase exactly the type information the
 * family registry depends on.
 */
export type GameSearchAlgorithm = {
	id: string;
	name: string;
	description: string;
	complexity: AlgorithmComplexity;
	properties: AlgorithmProperties;
	/** Whether the search can cut off subtrees (drives the comparison demo). */
	supportsPruning: boolean;
	run(tree: GameTree): GameTreeResult;
};

export function createGameTreeMetrics(overrides: Partial<GameTreeMetrics> = {}): GameTreeMetrics {
	return {
		nodesVisited: 0,
		nodesPruned: 0,
		pruneRate: 0,
		maxDepthReached: 0,
		branchingFactor: 0,
		leafEvaluations: 0,
		rootValue: 0,
		executionTimeMs: 0,
		...overrides
	};
}
