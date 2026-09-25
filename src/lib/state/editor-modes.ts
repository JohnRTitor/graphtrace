import type { EnvironmentType } from '../generators/types';

/**
 * Which edit tool is active.
 *
 * Kept here, in a module with no dependency on either store, so that the
 * environment and the editor can both reason about tool compatibility without
 * importing each other.
 */
export type EditMode =
	| 'wall'
	| 'erase'
	| 'start'
	| 'goal'
	| 'cost'
	| 'node'
	| 'edge'
	| 'remove'
	| 'move';

/**
 * Environment types drawn as a node-edge graph rather than a cell grid.
 *
 * Both families use one: a manual graph and a game tree are both "point at a
 * thing and edit it", even though their edits mean different things.
 */
const GRAPH_LIKE_ENVIRONMENTS = new Set<EnvironmentType>([
	'graph',
	'manual_tree',
	'tic_tac_toe',
	'tic_tac_toe_limited',
	'nim',
	'random_tree'
]);

export function isGraphLikeEnvironment(type: EnvironmentType): boolean {
	return GRAPH_LIKE_ENVIRONMENTS.has(type);
}

/** The grid tools, in toolbar order. */
const GRID_MODES: EditMode[] = ['wall', 'erase', 'start', 'goal', 'cost'];

/** The node-edge tools, in toolbar order. A game tree offers a subset. */
const GRAPH_MODES: EditMode[] = ['move', 'node', 'edge', 'remove', 'start', 'goal', 'cost'];

/**
 * Game trees are edited by acting on a selection, not by a paint mode.
 *
 * Only `remove`, and that is a fact about the canvas, not a preference:
 * `GameTreeCanvas.handleNodeClick` implements exactly one tool, so anything else
 * listed here would render a button whose click does nothing. Adding start/goal
 * markers back means implementing them on that canvas first.
 */
const GAME_TREE_MODES: EditMode[] = ['remove'];

/**
 * The tools that actually do something in a given environment.
 *
 * This is the single source of truth for the tool strip. The environment state
 * reconciles the *selected* mode against it, so the strip can never end up
 * showing a set of buttons with none of them active - which is what made a click
 * look like it was doing nothing.
 */
export function availableEditModes(type: EnvironmentType): EditMode[] {
	if (type === 'graph') return GRAPH_MODES;
	if (isGraphLikeEnvironment(type)) return GAME_TREE_MODES;
	return GRID_MODES;
}

/**
 * The tool selected when the active one does not apply to the environment.
 *
 * Explicit rather than "the first tool in the list", because display order and a
 * sensible default are different questions: a manual graph leads with "move" but
 * falls back to "add node", which is what the strip did before any of this was
 * centralised.
 */
const DEFAULT_MODE: Record<'grid' | 'graph' | 'game-tree', EditMode> = {
	grid: 'wall',
	graph: 'node',
	'game-tree': 'remove'
};

function environmentKind(type: EnvironmentType): 'grid' | 'graph' | 'game-tree' {
	if (type === 'graph') return 'graph';
	return isGraphLikeEnvironment(type) ? 'game-tree' : 'grid';
}

/**
 * Reconciles a tool with the environment it would act on.
 *
 * The result is always a tool the strip renders and the environment handles.
 */
export function getCompatibleEditorMode(
	mode: EditMode,
	environmentType: EnvironmentType
): EditMode {
	return availableEditModes(environmentType).includes(mode)
		? mode
		: DEFAULT_MODE[environmentKind(environmentType)];
}
