import { createGameTree, deriveDepths, type GamePlayer, type GameTree } from './game-tree';
import type { NodeId } from './types';

/**
 * Declarative shape used to describe a tree before it has ids. Generators and
 * tests describe trees structurally; the builder assigns stable ids in
 * pre-order so the same spec always produces the same ids.
 */
export type TreeSpecNode = {
	player: GamePlayer;
	/** Label of the move that reaches this node. Ignored for the root. */
	moveLabel?: string;
	/** Utility for a terminal node. */
	utility?: number;
	/** Optional state digest, e.g. a Tic-Tac-Toe board. */
	state?: string;
	children?: TreeSpecNode[];
};

/**
 * Builds a `GameTree` from a spec.
 *
 * Ids are `n0..nN` in pre-order, which keeps generated trees reproducible for a
 * given seed and makes assertions in tests readable. A node is promoted to
 * `terminal` when it declares a utility, unless it explicitly declares children.
 */
export function buildGameTree(spec: TreeSpecNode, prefix = 'n'): GameTree {
	const tree = createGameTree();
	let counter = 0;

	const build = (node: TreeSpecNode, parent: NodeId | null, depth: number): NodeId => {
		const id = `${prefix}${counter++}`;
		const hasChildren = (node.children?.length ?? 0) > 0;
		const player: GamePlayer = hasChildren ? node.player : 'terminal';
		const utility = !hasChildren ? (node.utility ?? 0) : null;

		tree.nodes.set(id, {
			id,
			parent,
			depth,
			player,
			utility,
			moveLabel: node.moveLabel ?? '',
			...(typeof node.state === 'string' ? { state: node.state } : {})
		});
		tree.children.set(id, []);

		for (const child of node.children ?? []) {
			tree.children.get(id)!.push(build(child, id, depth + 1));
		}
		return id;
	};

	tree.root = build(spec, null, 0);
	deriveDepths(tree.nodes, tree.children, tree.root);
	return tree;
}

