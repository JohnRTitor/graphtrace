import { gameTreeEventKindsByType, type GameTreeEvent, type GameTreeEventKind } from '../../algorithms/adversarial/types';
import type { GameTree } from '../../graph/game-tree';
import { toTraceEvents, type TraceEvent, type TraceState } from '../../trace/types';

/**
 * Per-node visual state for the game-tree renderer.
 *
 * `pruned` is sticky by design: pruned subtrees are dimmed, never removed, because
 * "what the algorithm decided not to look at" is the entire point of the family.
 */
export type GameTreeNodeState = 'pending' | 'visiting' | 'evaluated' | 'backed-up' | 'pruned' | 'chosen';

export type GameTreeTraceState = {
	kind: 'game-tree';
	visited: Set<string>;
	evaluated: Set<string>;
	backedUp: Set<string>;
	current: string | null;
	pruned: Set<string>;
	/** Prune events keyed by the skipped node, for edge-level dimming. */
	prunedEdges: Set<string>;
	/** Most recent value each node received, in utility units. */
	values: Map<string, number>;
	/** alpha/beta window in force at each node the last time it was backed up. */
	bounds: Map<string, { alpha: number; beta: number }>;
	/** Node -> chosen child, accumulated from `choose` events. */
	choices: Map<string, string | null>;
	/** The principal variation resolved so far, as it is revealed. */
	principalVariation: string[];
	rootValue: number | null;
	/** Bumped on every `backup` so the renderer can animate a value bubble. */
	backupTick: number;
};

export function createGameTreeTraceState(): GameTreeTraceState {
	return {
		kind: 'game-tree',
		visited: new Set(),
		evaluated: new Set(),
		backedUp: new Set(),
		current: null,
		pruned: new Set(),
		prunedEdges: new Set(),
		values: new Map(),
		bounds: new Map(),
		choices: new Map(),
		principalVariation: [],
		rootValue: null,
		backupTick: 0
	};
}

export function isGameTreeState(state: TraceState): state is GameTreeTraceState {
	return (state as GameTreeTraceState).kind === 'game-tree';
}

function cloneState(state: GameTreeTraceState): GameTreeTraceState {
	return {
		kind: 'game-tree',
		visited: new Set(state.visited),
		evaluated: new Set(state.evaluated),
		backedUp: new Set(state.backedUp),
		current: state.current,
		pruned: new Set(state.pruned),
		prunedEdges: new Set(state.prunedEdges),
		values: new Map(state.values),
		bounds: new Map(state.bounds),
		choices: new Map(state.choices),
		principalVariation: [...state.principalVariation],
		rootValue: state.rootValue,
		backupTick: state.backupTick
	};
}

/**
 * Folds one `GameTreeEvent` into the tree state **in place**.
 *
 * O(1) in the size of the state for every event kind except `prune`, which has
 * to mark the skipped region - that is the point of a prune, and it happens at
 * most once per node, so it is amortised over the whole trace.
 *
 * `choose` rewrites the principal variation in place rather than allocating a new
 * array: it fires on roughly half of all events, so a fresh array per event was a
 * meaningful share of the allocation churn during playback.
 */
export function applyGameTreeEventInto(
	state: GameTreeTraceState,
	event: GameTreeEvent,
	tree?: GameTree
): void {
	switch (event.type) {
		case 'start':
			state.current = event.node;
			break;

		case 'visit':
			// A node entered after an earlier prune was cancelled is live again.
			state.pruned.delete(event.node);
			state.visited.add(event.node);
			state.current = event.node;
			break;

		case 'evaluate':
			state.evaluated.add(event.node);
			state.values.set(event.node, event.value);
			break;

		case 'prune': {
			state.pruned.add(event.node);
			// The whole skipped region dims, not just the entry node.
			if (tree) {
				for (const node of descendantsOf(tree, event.subtreeRoot)) {
					state.pruned.add(node);
				}
			}
			state.prunedEdges.add(`move:${event.subtreeRoot}`);
			if (state.current === event.node) state.current = null;
			break;
		}

		case 'backup':
			state.backedUp.add(event.node);
			state.values.set(event.node, event.value);
			state.bounds.set(event.node, { alpha: event.alpha, beta: event.beta });
			state.current = null;
			state.backupTick++;
			break;

		case 'choose': {
			state.choices.set(event.node, event.move);
			state.values.set(event.node, event.value);
			// The variation is re-derived from the choice map rather than
			// accumulated, so scrubbing backwards to a partial trace shows exactly
			// the line that was justified at that step and no further.
			const root = tree?.root ?? null;
			rewriteVariation(state.principalVariation, state.choices, root);
			break;
		}

		case 'finish':
			state.rootValue = event.rootValue;
			state.current = null;
			break;
	}
}

/**
 * Pure fold, kept as the family's reducer contract, plus the engine's fast path.
 *
 * `stepInto` mutates and then returns a fresh record so that reactive consumers
 * invalidate once per event rather than once per mutated set.
 */
export function applyGameTreeEvent(
	prevState: GameTreeTraceState,
	event: GameTreeEvent,
	tree?: GameTree
): GameTreeTraceState {
	const state = cloneState(prevState);
	applyGameTreeEventInto(state, event, tree);
	return state;
}

export function stepInto(
	state: GameTreeTraceState,
	event: GameTreeEvent,
	tree?: GameTree
): GameTreeTraceState {
	applyGameTreeEventInto(state, event, tree);
	return { ...state };
}

/**
 * Fills `out` with the principal variation: the line of play the root player
 * would choose given only the choices recorded so far.
 *
 * Rewritten in place so that `choose` - which fires on roughly half of all events
 * - does not allocate a fresh array each time.
 */
function rewriteVariation(
	out: string[],
	choices: ReadonlyMap<string, string | null>,
	root: string | null
): void {
	out.length = 0;
	if (root === null) return;
	out.push(root);
	// Bounded by the number of recorded choices: a partial trace must not walk
	// past the deepest node the search has actually decided.
	while (out.length <= choices.size) {
		const next = choices.get(out[out.length - 1]);
		if (next === undefined || next === null) break;
		out.push(next);
	}
}

function descendantsOf(tree: GameTree, root: string): string[] {
	const found: string[] = [];
	const seen = new Set<string>([root]);
	const queue = [root];
	while (queue.length > 0) {
		const current = queue.shift()!;
		for (const child of tree.children.get(current) ?? []) {
			if (seen.has(child)) continue;
			seen.add(child);
			found.push(child);
			queue.push(child);
		}
	}
	return found;
}

/**
 * Visual state for a node, given everything the trace has revealed so far.
 *
 * Deliberately *not* derived from `choices`: every interior node records the best
 * move it found, so keying "chosen" off that would light up the entire tree. The
 * principal variation is a separate question, answered by `isOnVariation`.
 */
export function gameTreeNodeState(
	state: GameTreeTraceState,
	nodeId: string
): GameTreeNodeState {
	if (state.pruned.has(nodeId)) return 'pruned';
	if (state.current === nodeId) return 'visiting';
	if (state.backedUp.has(nodeId)) return 'backed-up';
	if (state.evaluated.has(nodeId)) return 'evaluated';
	if (state.visited.has(nodeId)) return 'visiting';
	return 'pending';
}

/** True when the node is on the principal variation revealed so far. */
export function isOnVariation(state: GameTreeTraceState, nodeId: string): boolean {
	return state.principalVariation.includes(nodeId);
}

/** Nodes on the principal variation revealed so far, for path highlighting. */
export function revealedVariation(state: GameTreeTraceState): Set<string> {
	return new Set(state.principalVariation);
}

export function gameTreeKindsOf(events: readonly GameTreeEvent[]): GameTreeEventKind[] {
	return events.map((event) => gameTreeEventKindsByType[event.type]);
}

export function wrapGameTreeEvents(events: readonly GameTreeEvent[]): TraceEvent<GameTreeEvent>[] {
	return toTraceEvents(events, gameTreeKindsOf(events));
}
