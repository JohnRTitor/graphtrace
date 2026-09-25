import type { NodeId } from './types';

/**
 * A game tree: the environment model for the adversarial family.
 *
 * Every node is either a `max` node (the maximizing player to move), a `min` node
 * (the minimizing player to move), or a `terminal` node carrying a fixed utility.
 * Edges are the moves from a parent to a child, and `children` preserves move
 * order because minimax value depends on the order moves are searched.
 *
 * Node positions are deliberately not stored: the layout is derived by
 * `layoutGameTree`, so dragging a node is a view concern, not a model one.
 */
export type GamePlayer = 'max' | 'min' | 'terminal';

export type GameTreeNode = {
	id: NodeId;
	parent: NodeId | null;
	depth: number;
	player: GamePlayer;
	/** Utility of a terminal position. Ignored for interior nodes. */
	utility: number | null;
	/** Human-facing label for the move that reaches this node from its parent. */
	moveLabel: string;
	/** Optional state digest, e.g. a Tic-Tac-Toe board string. */
	state?: string;
};

export type GameTree = {
	nodes: Map<NodeId, GameTreeNode>;
	/** Ordered move targets. Search order is significant, so never sort this. */
	children: Map<NodeId, NodeId[]>;
	root: NodeId | null;
};

/**
 * Structural edits are expressed as full-tree snapshots, mirroring how the grid
 * family expresses structural edits (`GridCommand` `replace`). Game trees are
 * small, and a snapshot pair makes inversion total and obviously correct - the
 * alternative (per-node add/remove with depth repair) has a large edge-case
 * surface for no benefit.
 */
export type GameTreeCommand =
	| { type: 'set-player'; id: NodeId; from: GamePlayer; to: GamePlayer }
	| { type: 'set-utility'; id: NodeId; from: number | null; to: number | null }
	| { type: 'set-move-label'; id: NodeId; from: string; to: string }
	| { type: 'replace-tree'; before: SerializedGameTree; after: SerializedGameTree };

export type PositionedGameNode = GameTreeNode & { x: number; y: number };

export type SerializedGameTree = {
	nodes: [NodeId, GameTreeNode][];
	children: [NodeId, NodeId[]][];
	root: NodeId | null;
};

export const TREE_NODE_WIDTH = 148;
export const TREE_NODE_HEIGHT = 64;
export const TREE_LEVEL_GAP = 44;

export function createGameTree(): GameTree {
	return { nodes: new Map(), children: new Map(), root: null };
}

export function isValidPlayer(value: unknown): value is GamePlayer {
	return value === 'max' || value === 'min' || value === 'terminal';
}

export function isValidUtility(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

export function cloneGameTree(source: GameTree): GameTree {
	const clone = createGameTree();
	for (const node of source.nodes.values()) clone.nodes.set(node.id, { ...node });
	for (const [parent, kids] of source.children) clone.children.set(parent, [...kids]);
	clone.root = source.root;
	return clone;
}

export function serializeGameTree(tree: GameTree): SerializedGameTree {
	return {
		nodes: Array.from(tree.nodes.entries(), ([id, node]) => [id, { ...node }]),
		children: Array.from(tree.children.entries(), ([parent, kids]) => [parent, [...kids]]),
		root: tree.root
	};
}

export function restoreGameTree(tree: GameTree, snapshot: SerializedGameTree): void {
	const loaded = loadGameTree(snapshot);
	tree.nodes.clear();
	tree.children.clear();
	tree.root = null;
	if (!loaded) return;
	for (const node of loaded.nodes.values()) tree.nodes.set(node.id, node);
	for (const [parent, kids] of loaded.children) tree.children.set(parent, [...kids]);
	tree.root = loaded.root;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object';
}

/**
 * Rebuilds a tree from untrusted data. Anything structurally invalid (dangling
 * children, duplicate ids, unrecognised players) is dropped, and depths are
 * re-derived from the root so stored depths can never disagree with the actual
 * structure. Returns null when there is no usable root.
 */
export function loadGameTree(data: unknown): GameTree | null {
	if (!isRecord(data) || !Array.isArray(data.nodes)) return null;

	const nodes = new Map<NodeId, GameTreeNode>();
	for (const entry of data.nodes as unknown[]) {
		if (!Array.isArray(entry) || entry.length !== 2) continue;
		const [id, value] = entry as [unknown, unknown];
		if (typeof id !== 'string' || id === '' || !isRecord(value) || nodes.has(id)) continue;
		if (!isValidPlayer(value.player)) continue;
		if (value.utility !== null && value.utility !== undefined && !isValidUtility(value.utility)) continue;
		if (typeof value.moveLabel !== 'string') continue;
		nodes.set(id, {
			id,
			parent: typeof value.parent === 'string' ? value.parent : null,
			depth: 0,
			player: value.player,
			utility: isValidUtility(value.utility) ? value.utility : null,
			moveLabel: value.moveLabel,
			...(typeof value.state === 'string' ? { state: value.state } : {})
		});
	}

	const children = new Map<NodeId, NodeId[]>();
	if (Array.isArray(data.children)) {
		for (const entry of data.children as unknown[]) {
			if (!Array.isArray(entry) || entry.length !== 2) continue;
			const [parent, targets] = entry as [unknown, unknown];
			if (typeof parent !== 'string' || !nodes.has(parent) || !Array.isArray(targets)) continue;
			const kids: NodeId[] = [];
			for (const target of targets) {
				if (typeof target !== 'string' || !nodes.has(target) || kids.includes(target)) continue;
				// The edge list is authoritative for parenthood, so a conflicting
				// `parent` field on the node is corrected here.
				nodes.get(target)!.parent = parent;
				kids.push(target);
			}
			children.set(parent, kids);
		}
	}

	const declaredRoot = typeof data.root === 'string' ? data.root : null;
	const root = declaredRoot !== null && nodes.has(declaredRoot) ? declaredRoot : null;
	if (root === null) return null;

	deriveDepths(nodes, children, root);
	return { nodes, children, root };
}

/**
 * Assigns depths breadth-first from the root and deletes anything unreachable.
 * Returns false only when the root is missing, which cannot happen for callers
 * that check the root first.
 */
export function deriveDepths(
	nodes: Map<NodeId, GameTreeNode>,
	children: Map<NodeId, NodeId[]>,
	root: NodeId
): boolean {
	const rootNode = nodes.get(root);
	if (!rootNode) return false;

	for (const node of nodes.values()) node.depth = -1;
	rootNode.parent = null;
	rootNode.depth = 0;

	const queue: NodeId[] = [root];
	while (queue.length > 0) {
		const current = queue.shift()!;
		const depth = nodes.get(current)!.depth;
		for (const child of children.get(current) ?? []) {
			const childNode = nodes.get(child);
			// A node reached twice is skipped rather than re-expanded, which is what
			// makes a cyclic or shared child list safe.
			if (!childNode || childNode.depth >= 0) continue;
			childNode.depth = depth + 1;
			queue.push(child);
		}
	}

	for (const [id, node] of nodes) {
		if (node.depth < 0) {
			nodes.delete(id);
			children.delete(id);
		}
	}
	for (const kids of children.values()) {
		for (let i = kids.length - 1; i >= 0; i--) {
			if (!nodes.has(kids[i])) kids.splice(i, 1);
		}
	}
	return true;
}

/** All descendants of `id`, excluding `id` itself, in breadth-first order. */
export function collectSubtree(tree: GameTree, id: NodeId): GameTreeNode[] {
	const collected: GameTreeNode[] = [];
	const seen = new Set<NodeId>([id]);
	const queue: NodeId[] = [id];
	while (queue.length > 0) {
		const current = queue.shift()!;
		for (const child of tree.children.get(current) ?? []) {
			if (seen.has(child)) continue;
			seen.add(child);
			const node = tree.nodes.get(child);
			if (node) collected.push(node);
			queue.push(child);
		}
	}
	return collected;
}

export function gameTreeDepth(tree: GameTree): number {
	let max = 0;
	for (const node of tree.nodes.values()) max = Math.max(max, node.depth);
	return max;
}

/** Total move count divided by interior node count (0 when the tree has no moves). */
export function averageBranchingFactor(tree: GameTree): number {
	let edges = 0;
	let interior = 0;
	for (const node of tree.nodes.values()) {
		if (node.player === 'terminal') continue;
		interior++;
		edges += tree.children.get(node.id)?.length ?? 0;
	}
	return interior === 0 ? 0 : edges / interior;
}

export type TreeLayout = {
	nodes: PositionedGameNode[];
	edges: { id: string; source: NodeId; target: NodeId; moveLabel: string }[];
	width: number;
	height: number;
};

/**
 * Tidy tree layout: leaves are packed left to right and each internal node is
 * centred over its children, which keeps the render's left-to-right order
 * identical to the algorithm's move order.
 */
export function layoutGameTree(tree: GameTree): TreeLayout {
	if (tree.root === null || !tree.nodes.has(tree.root)) {
		return { nodes: [], edges: [], width: 0, height: 0 };
	}

	const positions = new Map<NodeId, { x: number; y: number }>();
	const rowGap = TREE_NODE_HEIGHT + 84;
	let cursor = 0;

	const place = (id: NodeId): number => {
		const node = tree.nodes.get(id)!;
		const kids = tree.children.get(id) ?? [];
		const y = node.depth * rowGap;
		if (kids.length === 0) {
			const x = cursor * TREE_LEVEL_GAP;
			cursor++;
			positions.set(id, { x, y });
			return x;
		}
		const xs = kids.map(place);
		const x = (xs[0] + xs[xs.length - 1]) / 2;
		positions.set(id, { x, y });
		return x;
	};
	place(tree.root);

	const raw: { node: GameTreeNode; x: number; y: number }[] = [];
	for (const [id, node] of tree.nodes) {
		const position = positions.get(id);
		if (position) raw.push({ node, x: position.x, y: position.y });
	}
	if (raw.length === 0) return { nodes: [], edges: [], width: 0, height: 0 };

	/*
	 * Bounds are reduced with loops rather than `Math.min(...spread)`.
	 * Spreading a large array into a call overflows the argument limit - around
	 * 65k elements - which a big generated tree can legitimately reach, and it
	 * fails as a confusing `RangeError` deep inside the layout.
	 */
	let minX = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const entry of raw) {
		if (entry.x < minX) minX = entry.x;
		if (entry.x > maxX) maxX = entry.x;
		if (entry.y < minY) minY = entry.y;
		if (entry.y > maxY) maxY = entry.y;
	}
	const offsetX = TREE_NODE_WIDTH / 2 - minX;
	const offsetY = TREE_NODE_HEIGHT / 2 - minY;

	const nodes: PositionedGameNode[] = raw.map((entry) => ({
		...entry.node,
		x: entry.x + offsetX,
		y: entry.y + offsetY
	}));

	const edges: TreeLayout['edges'] = [];
	for (const [parent, kids] of tree.children) {
		for (const target of kids) {
			const node = tree.nodes.get(target);
			if (!node) continue;
			edges.push({
				id: `move:${parent}->${target}`,
				source: parent,
				target,
				moveLabel: node.moveLabel
			});
		}
	}

	return {
		nodes,
		edges,
		width: maxX - minX + TREE_NODE_WIDTH,
		height: maxY - minY + TREE_NODE_HEIGHT + 48
	};
}

export function invertGameTreeCommand(cmd: GameTreeCommand): GameTreeCommand {
	switch (cmd.type) {
		case 'set-player':
			return { type: 'set-player', id: cmd.id, from: cmd.to, to: cmd.from };
		case 'set-utility':
			return { type: 'set-utility', id: cmd.id, from: cmd.to, to: cmd.from };
		case 'set-move-label':
			return { type: 'set-move-label', id: cmd.id, from: cmd.to, to: cmd.from };
		case 'replace-tree':
			return { type: 'replace-tree', before: cmd.after, after: cmd.before };
	}
}

export type { NodeId };
