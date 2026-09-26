import type { Edge, Node } from '@xyflow/svelte';
import { MarkerType } from '@xyflow/svelte';
import { layoutGameTree, TREE_NODE_HEIGHT, TREE_NODE_WIDTH, type GameTree } from '$lib/graph/game-tree';
import type { GamePlayer } from '$lib/graph/game-tree';
import { tracePaletteFor, PRUNED_OPACITY, type ThemeName } from '$lib/theme/tokens';
import { gameTreeNodeState, type GameTreeTraceState } from '$lib/families/adversarial/tree-state';
import type { NodeId } from '$lib/graph/types';

/** The five trace states, plus the surface colours a canvas needs around them. */
export type TreeVisualState =
	| 'pending'
	| 'visiting'
	| 'evaluated'
	| 'backed-up'
	| 'pruned'
	| 'chosen';

/**
 * The outline a node is drawn with.
 *
 * MAX and MIN have to be distinguishable without reading a label, and shape is
 * what survives a colourblind view or a greyscale screenshot where hue does not.
 * The two used to be the same rectangle with a different pair of corners
 * rounded, which at 64px tall is very close to invisible - it read as a
 * rendering bug rather than a design.
 */
export type NodeShape = 'circle' | 'rectangle' | 'leaf';

export function nodeShapeFor(player: GamePlayer): NodeShape {
	// MIN is a circle, MAX a sharp rectangle. The asymmetry is the point: the two
	// must never resolve to the same outline.
	if (player === 'min') return 'circle';
	if (player === 'max') return 'rectangle';
	return 'leaf';
}

/**
 * The classes that realise each shape.
 *
 * Kept beside {@link nodeShapeFor} so the mapping is data the tests can assert
 * on directly. `GameTreeNode` applies these verbatim, which means the shape
 * contract has exactly one definition and the component cannot drift from it.
 *
 * The circle is given equal width and height on purpose: `rounded-full` on a
 * non-square box draws an ellipse, not a circle.
 */
export const NODE_SHAPE_CLASSES: Record<NodeShape, string> = {
	circle: 'h-16 w-16 rounded-full',
	rectangle: 'w-[148px] rounded-none',
	leaf: 'w-[148px] rounded-lg'
};

export type TreeColors = {
	background: string;
	surface: string;
	structure: string;
	barrier: string;
	mutedText: string;
	selection: string;
	start: string;
	goal: string;
	frontier: string;
	visited: string;
	current: string;
	path: string;
	pruned: string;
	/** Opacity applied to pruned content, as a string for inline styles. */
	prunedOpacity: string;
};

/** Projects the centralized palette onto what the tree renderer needs. */
export function treeColors(theme: ThemeName): TreeColors {
	const palette = tracePaletteFor(theme);
	return {
		background: palette.background,
		surface: palette.surface,
		structure: palette.structure,
		barrier: palette.barrier,
		mutedText: palette.mutedText,
		selection: palette.selection,
		start: palette.start,
		goal: palette.goal,
		frontier: palette.frontier,
		visited: palette.visited,
		current: palette.current,
		path: palette.path,
		pruned: palette.pruned,
		prunedOpacity: String(PRUNED_OPACITY)
	};
}

export type TreeNodeData = {
	/** Label of the move that reached this node. Empty for the root. */
	moveLabel: string;
	player: GamePlayer;
	state: TreeVisualState;
	isRoot: boolean;
	depth: number;
	/** Utility of a terminal position. */
	utility: number | null;
	/** Value backed up into this node, once the search has produced one. */
	value: number | undefined;
	alpha: number | undefined;
	beta: number | undefined;
	/** Position digest, e.g. a Tic-Tac-Toe board, shown as secondary text. */
	digest: string | undefined;
	colors: TreeColors;
	/**
	 * Increments when this node is rebuilt, and only for this node.
	 *
	 * It exists so a value chip re-animates even when a node receives the same
	 * value twice. It used to be a global counter carried on every node, which
	 * meant every `backup` event invalidated every node in the tree - all 6,812 of
	 * them on a full Tic-Tac-Toe tree - and defeated reference reuse entirely.
	 * Per-node, only the node that actually changed is marked dirty.
	 */
	backupTick: number;
	showValues: boolean;
};

export type TreeEdgeData = {
	moveLabel: string;
	state: 'pending' | 'path' | 'pruned' | 'traversed' | 'none';
	colors: TreeColors;
};

export type TreeFlowNode = Node<TreeNodeData>;
export type TreeFlowEdge = Edge<TreeEdgeData>;

/**
 * Per-tree render cache.
 *
 * Two facts make this worth having. First, `layoutGameTree` is a pure function
 * of the tree's *shape*, which does not change during a trace, so recomputing it
 * per playback step is pure waste (measured at ~7ms for a 6,812-node tree).
 * Second, `toTreeNodes` used to allocate one fresh object per node per step, so a
 * 17,240-event trace churned 6,812 objects per step and handed SvelteFlow a
 * completely different array every time - which is what made large trees freeze.
 *
 * Held in a `WeakMap` keyed by the tree, so it is released with the tree and can
 * never grow unbounded. `shapeOf` is the invalidation key: node count plus total
 * move count, which changes on every structural edit and not on a re-render.
 */
type TreeRenderCache = {
	shape: string;
	layout: ReturnType<typeof layoutGameTree>;
	/** Node objects by id, for reference reuse across steps. */
	byId: Map<string, TreeFlowNode>;
	/** Edge objects by edge id. Kept apart from `byId` so the two namespaces
	 *  cannot collide even though node and edge ids share a Map. */
	edgeById: Map<string, TreeFlowEdge>;
};

const treeCaches = new WeakMap<GameTree, TreeRenderCache>();

function shapeOf(tree: GameTree): string {
	let moves = 0;
	for (const kids of tree.children.values()) moves += kids.length;
	return `${tree.nodes.size}:${moves}`;
}

function cacheFor(tree: GameTree): TreeRenderCache {
	const shape = shapeOf(tree);
	const cached = treeCaches.get(tree);
	if (cached && cached.shape === shape) return cached;

	const created: TreeRenderCache = {
		shape,
		layout: layoutGameTree(tree),
		byId: new Map(),
		edgeById: new Map()
	};
	treeCaches.set(tree, created);
	return created;
}

/**
 * Projects a game tree plus everything the trace has revealed into flow elements.
 *
 * Pure from the caller's point of view, and incremental underneath: the layout
 * is memoised per tree, and a node object is reused whenever nothing it renders
 * has changed. During playback that means one or two new objects per step instead
 * of one per node, so the only thing SvelteFlow has to reconcile is the handful of
 * nodes the search actually touched.
 *
 * A returned node is therefore *reference-identical* to its predecessor when
 * unchanged - which is the property `countChangedFlowNodes` exists to assert.
 */
export function toTreeNodes(
	tree: GameTree,
	state: GameTreeTraceState | null,
	colors: TreeColors,
	showValues: boolean
): { nodes: TreeFlowNode[]; width: number; height: number } {
	const cache = cacheFor(tree);
	const { layout } = cache;
	// A Set rather than repeated `includes`: the loop runs once per node, so a
	// linear scan of the variation would be 6,812 x depth comparisons per step.
	const variation =
		state?.principalVariation !== undefined && state.principalVariation.length > 0
			? new Set(state.principalVariation)
			: null;
	const values = state?.values;
	const bounds = state?.bounds;
	const rootId = tree.root;
	const visited = state?.visited;
	const pruned = state?.pruned;
	const evaluated = state?.evaluated;
	const backedUp = state?.backedUp;
	const current = state?.current;

	const nodes: TreeFlowNode[] = new Array(layout.nodes.length);

	for (let index = 0; index < layout.nodes.length; index++) {
		const node = layout.nodes[index];
		const x = node.x - TREE_NODE_WIDTH / 2;
		const y = node.y - TREE_NODE_HEIGHT / 2;

		// Resolve the visual state from the raw sets directly rather than through
		// `gameTreeNodeState`, so the hot loop avoids a function call and can bail
		// out early when nothing has changed. The precedence is identical, and
		// `gameTreeNodeState` remains the single documented definition of it.
		let visual: TreeVisualState = 'pending';
		if (pruned?.has(node.id)) visual = 'pruned';
		else if (current === node.id) visual = 'visiting';
		else if (backedUp?.has(node.id)) visual = 'backed-up';
		else if (evaluated?.has(node.id)) visual = 'evaluated';
		else if (visited?.has(node.id)) visual = 'visiting';

		// The principal variation overrides the plain backed-up state, so the answer
		// reads as one continuous line rather than a field of settled nodes. A pruned
		// node is never on the variation, so it keeps its dim.
		if (variation !== null && visual !== 'pruned' && variation.has(node.id)) {
			visual = 'chosen';
		}

		const isRoot = node.id === rootId;
		const value = values?.get(node.id);
		const window_ = bounds?.get(node.id);

		const previous = cache.byId.get(node.id);
		const prevData = previous?.data;
		if (
			previous !== undefined &&
			previous.position.x === x &&
			previous.position.y === y &&
			prevData !== undefined &&
			prevData.moveLabel === node.moveLabel &&
			prevData.player === node.player &&
			prevData.state === visual &&
			prevData.isRoot === isRoot &&
			prevData.depth === node.depth &&
			prevData.utility === node.utility &&
			prevData.value === value &&
			prevData.alpha === window_?.alpha &&
			prevData.beta === window_?.beta &&
			prevData.digest === node.state &&
			prevData.colors === colors &&
			prevData.showValues === showValues
		) {
			nodes[index] = previous;
			continue;
		}

		const flowNode: TreeFlowNode = {
			id: node.id,
			type: 'tree',
			position: { x, y },
			data: {
				moveLabel: node.moveLabel,
				player: node.player,
				state: visual,
				isRoot,
				depth: node.depth,
				utility: node.utility,
				value,
				alpha: window_?.alpha,
				beta: window_?.beta,
				digest: node.state,
				colors,
				backupTick: (prevData?.backupTick ?? 0) + 1,
				showValues
			},
			draggable: false
		};
		nodes[index] = flowNode;
		cache.byId.set(node.id, flowNode);
	}

	return { nodes, width: layout.width, height: layout.height };
}

/**
 * How many entries of two node arrays are not reference-identical.
 *
 * This is the measure of how much work the renderer is being asked to do, so it
 * is what the playback regression tests assert on.
 */
export function countChangedFlowNodes(
	previous: readonly TreeFlowNode[] | undefined,
	next: readonly TreeFlowNode[]
): number {
	if (!previous || previous.length !== next.length) return next.length;
	let changed = 0;
	for (let index = 0; index < next.length; index++) {
		if (previous[index] !== next[index]) changed++;
	}
	return changed;
}

/**
 * Projects moves into flow edges, reusing edge objects that have not changed.
 *
 * Edge state depends only on whether the target is pruned and whether the edge is
 * on the principal variation, so during playback the overwhelming majority of
 * edges keep the same state step after step and are handed back by reference.
 */
export function toTreeEdges(
	tree: GameTree,
	state: GameTreeTraceState | null,
	colors: TreeColors
): TreeFlowEdge[] {
	const cache = cacheFor(tree);
	const variation =
		state?.principalVariation !== undefined && state.principalVariation.length > 0
			? new Set(state.principalVariation)
			: null;
	const pruned = state?.pruned;
	const visited = state?.visited;

	const edges: TreeFlowEdge[] = new Array(cache.layout.edges.length);

	for (let index = 0; index < cache.layout.edges.length; index++) {
		const move = cache.layout.edges[index];
		// `move.moveLabel` comes from the memoised layout. Reading it rather than
		// looking the target up in `tree.nodes` saves one Map lookup per edge per
		// render, which is ~6,800 lookups per frame on a full Tic-Tac-Toe tree.

		// Pruned is checked first: a pruned node is never entered, so nothing else
		// about its edge can be true.
		let visual: TreeEdgeData['state'];
		if (pruned?.has(move.target)) visual = 'pruned';
		else if (variation !== null && variation.has(move.source) && variation.has(move.target)) {
			visual = 'path';
		} else if (visited?.has(move.target)) visual = 'traversed';
		else visual = 'none';

		const previous = cache.edgeById.get(move.id);
		if (
			previous !== undefined &&
			previous.data !== undefined &&
			previous.data.state === visual &&
			previous.data.colors === colors
		) {
			edges[index] = previous;
			continue;
		}

		const flowEdge: TreeFlowEdge = {
			id: move.id,
			type: 'tree',
			source: move.source,
			target: move.target,
			markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
			data: { moveLabel: move.moveLabel, state: visual, colors }
		};
		edges[index] = flowEdge;
		cache.edgeById.set(move.id, flowEdge);
	}

	return edges;
}

/** Human-readable value formatting shared by the node and the inspector. */
export function formatTreeValue(value: number | undefined | null): string {
	if (value === undefined || value === null) return '';
	if (!Number.isFinite(value)) return value > 0 ? '∞' : '-∞';
	return value > 0 ? `+${value}` : String(value);
}

export type { NodeId };
