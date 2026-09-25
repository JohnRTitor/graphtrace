import type { GameTree } from '../../graph/game-tree';
import { extractPrincipalVariation, SearchTrace } from './search-trace';
import type { GameTreeResult } from './types';

const NEG_INF = Number.NEGATIVE_INFINITY;
const POS_INF = Number.POSITIVE_INFINITY;

/**
 * The recursive core shared by minimax and alpha-beta.
 *
 * `pruning` is the *only* behavioural difference between the two algorithms, and
 * it is threaded through a single function rather than duplicated across two
 * files. That is what makes the family comparison honest: on one tree, the two
 * runs agree on every value and on the principal variation, and differ only in
 * which branches were cut - so any observed metric difference is attributable to
 * pruning and nothing else.
 */
export function runSearch(tree: GameTree, pruning: boolean): GameTreeResult {
	const startTime = performance.now();
	const trace = new SearchTrace(tree);
	const best = new Map<string, string>();
	const root = tree.root;

	if (root === null || !tree.nodes.has(root)) {
		trace.finish(0);
		return {
			events: trace.events,
			metrics: trace.metrics(0, performance.now() - startTime),
			principalVariation: []
		};
	}

	trace.start(root);
	const value = search(tree, root, NEG_INF, POS_INF, trace, best, pruning);
	trace.finish(value);

	return {
		events: trace.events,
		metrics: trace.metrics(value, performance.now() - startTime),
		principalVariation: extractPrincipalVariation(best, root, tree)
	};
}

function search(
	tree: GameTree,
	nodeId: string,
	alpha: number,
	beta: number,
	trace: SearchTrace,
	best: Map<string, string>,
	pruning: boolean
): number {
	const node = tree.nodes.get(nodeId);
	if (!node) return 0;

	trace.visit(nodeId);

	if (node.player === 'terminal') {
		return trace.evaluate(nodeId, node.utility ?? 0);
	}

	const children = tree.children.get(nodeId) ?? [];
	if (children.length === 0) {
		// An interior node with no moves has no evaluation function of its own.
		// Treating it as neutral keeps the search total over malformed trees.
		return trace.evaluate(nodeId, 0);
	}

	const maximising = node.player === 'max';
	let value = maximising ? NEG_INF : POS_INF;
	let bestChild: string | null = null;

	for (let index = 0; index < children.length; index++) {
		const childId = children[index];
		const childValue = search(tree, childId, alpha, beta, trace, best, pruning);

		if (maximising ? childValue > value : childValue < value) {
			value = childValue;
			bestChild = childId;
		}

		if (maximising) alpha = Math.max(alpha, value);
		else beta = Math.min(beta, value);

		if (pruning && alpha >= beta) {
			// The cut-off region is what remains *unexplored*, which is the children
			// after the one just searched. Emitting the next child as the prune root
			// is what lets the renderer dim the skipped region without dimming the
			// move that was actually evaluated.
			const nextChild = children[index + 1];
			if (nextChild !== undefined) {
				trace.prune(nextChild, nextChild, alpha, beta, maximising ? 'alpha' : 'beta');
			}
			break;
		}
	}

	trace.backup(nodeId, value, alpha, beta);
	trace.choose(nodeId, bestChild, value);
	if (bestChild !== null) best.set(nodeId, bestChild);
	return value;
}
