import { averageBranchingFactor, gameTreeDepth, type GameTree } from '../../graph/game-tree';
import type { NodeId } from '../../graph/types';
import { createGameTreeMetrics, type GameTreeEvent, type GameTreeMetrics, type GameTreeResult } from './types';

/**
 * Shared bookkeeping for the adversarial searches.
 *
 * Both minimax and alpha-beta need the same accounting (what was visited, what
 * was pruned, how deep the search went), and both must produce identical
 * *values* for every node they both reach. Keeping the counter in one place is
 * what makes "compare minimax against alpha-beta" a fair comparison.
 */
export class SearchTrace {
	readonly events: GameTreeEvent[] = [];
	private visited = 0;
	private pruned = 0;
	private maxDepth = 0;
	private leaves = 0;

	constructor(private readonly tree: GameTree) {}

	start(root: NodeId): void {
		this.events.push({ type: 'start', node: root });
	}

	visit(node: NodeId): void {
		const model = this.tree.nodes.get(node);
		if (!model) return;
		this.visited++;
		this.maxDepth = Math.max(this.maxDepth, model.depth);
		this.events.push({
			type: 'visit',
			node,
			depth: model.depth,
			player: model.player
		});
	}

	evaluate(node: NodeId, value: number): number {
		this.leaves++;
		this.events.push({ type: 'evaluate', node, value });
		return value;
	}

	prune(node: NodeId, subtreeRoot: NodeId, alpha: number, beta: number, reason: 'alpha' | 'beta'): void {
		this.pruned += countNodes(this.tree, subtreeRoot);
		this.events.push({ type: 'prune', node, subtreeRoot, alpha, beta, reason });
	}

	backup(node: NodeId, value: number, alpha: number, beta: number): void {
		this.events.push({ type: 'backup', node, value, alpha, beta });
	}

	choose(node: NodeId, move: NodeId | null, value: number): void {
		this.events.push({ type: 'choose', node, move, value });
	}

	finish(rootValue: number): void {
		this.events.push({ type: 'finish', rootValue });
	}

	/** Terminal utilities for every node pruned below `node`, used to score prune rate. */
	metrics(rootValue: number, executionTimeMs: number): GameTreeMetrics {
		return createGameTreeMetrics({
			nodesVisited: this.visited,
			nodesPruned: this.pruned,
			pruneRate: this.tree.nodes.size === 0 ? 0 : (this.pruned / this.tree.nodes.size) * 100,
			maxDepthReached: this.maxDepth,
			branchingFactor: averageBranchingFactor(this.tree),
			leafEvaluations: this.leaves,
			rootValue,
			executionTimeMs
		});
	}
}

function countNodes(tree: GameTree, root: NodeId): number {
	let count = 0;
	const stack: NodeId[] = [root];
	const seen = new Set<NodeId>();
	while (stack.length > 0) {
		const current = stack.pop()!;
		if (seen.has(current)) continue;
		seen.add(current);
		count++;
		for (const child of tree.children.get(current) ?? []) stack.push(child);
	}
	return count;
}

/**
 * Walks the `best move at each node` map the search recorded while backing values
 * up, yielding the principal variation: the single line of play the root player
 * would actually choose. The renderer highlights exactly this, so the highlighted
 * path is derived from the search rather than reconstructed heuristically.
 */
export function extractPrincipalVariation(
	best: ReadonlyMap<NodeId, NodeId>,
	root: NodeId,
	tree: GameTree
): NodeId[] {
	const line: NodeId[] = [root];
	let current = root;
	// Bounded by node count so a malformed tree can never spin here.
	while (line.length <= tree.nodes.size) {
		const next = best.get(current);
		if (next === undefined) break;
		line.push(next);
		current = next;
	}
	return line;
}
