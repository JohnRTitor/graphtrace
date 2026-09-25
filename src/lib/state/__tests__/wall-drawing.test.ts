import { describe, expect, it, beforeEach } from 'vitest';
import { availableEditModes, editorState } from '../editor.svelte';
import { environmentState } from '../environment.svelte';
import type { EditMode } from '../editor-modes';
import type { EnvironmentType } from '../../generators/types';

/**
 * Regression cover for wall drawing.
 *
 * The reported symptom was "drawing walls is not working - it shows a start
 * marker instead". Wall drawing itself always worked; what was broken was the
 * *tool selection*. A graph-only tool could be left active on a grid, the tool
 * strip then rendered with none of its buttons highlighted, and a click on the
 * canvas was routed to a handler a grid does not have - so nothing happened, and
 * the only visible thing at that spot was the start marker that had been there
 * all along. It looked exactly like a broken wall brush.
 */

const ALL_ENVIRONMENTS: EnvironmentType[] = [
	'perfect_maze',
	'braided_maze',
	'random_obstacles',
	'blank',
	'graph',
	'manual_tree',
	'tic_tac_toe',
	'tic_tac_toe_limited',
	'nim',
	'random_tree'
];

const ALL_MODES: EditMode[] = [
	'wall',
	'erase',
	'start',
	'goal',
	'cost',
	'node',
	'edge',
	'remove',
	'move'
];

/** A walkable cell that is neither the start nor the goal, so edits are legal. */
function editableCell(): string {
	for (const [id, node] of environmentState.grid.nodes) {
		if (node.walkable && id !== environmentState.gridStart && id !== environmentState.gridGoal) {
			return id;
		}
	}
	throw new Error('no editable cell found');
}

describe('wall drawing on a grid', () => {
	beforeEach(() => {
		environmentState.familyId = 'pathfinding';
		environmentState.environmentType = 'perfect_maze';
		environmentState.handleGenerate();
		editorState.mode = 'wall';
	});

	it('turns a walkable cell into a wall on a click', () => {
		const target = editableCell();
		expect(environmentState.grid.nodes.get(target)?.walkable).toBe(true);

		editorState.onPointerDown(target);
		editorState.onPointerUp(target);

		expect(environmentState.grid.nodes.get(target)?.walkable).toBe(false);
	});

	it('paints every cell of a drag', () => {
		const start = environmentState.gridStart;
		const goal = environmentState.gridGoal;
		// A short run of editable cells, so the drag crosses real cells rather than
		// running into the start/goal cells, which are deliberately protected.
		const path = Array.from(environmentState.grid.nodes.entries())
			.filter(([id, node]) => node.walkable && id !== start && id !== goal)
			.slice(0, 4)
			.map(([id]) => id);
		expect(path.length).toBeGreaterThan(1);

		editorState.onPointerDown(path[0]);
		for (const id of path.slice(1)) editorState.onPointerMove(id);
		editorState.onPointerUp(path[path.length - 1]);

		for (const id of path) {
			expect(environmentState.grid.nodes.get(id)?.walkable, `${id} should be a wall`).toBe(false);
		}
		expect(environmentState.gridStart).toBe(start);
		expect(environmentState.gridGoal).toBe(goal);
	});

	it('never moves the start or goal marker while the wall tool is active', () => {
		// The literal complaint was a start marker appearing where a wall was drawn,
		// so this asserts the routing rather than just the end state.
		const start = environmentState.gridStart;
		const goal = environmentState.gridGoal;
		const target = editableCell();

		editorState.onPointerDown(target);
		editorState.onPointerUp(target);

		expect(environmentState.gridStart).toBe(start);
		expect(environmentState.gridGoal).toBe(goal);
		expect(environmentState.grid.nodes.get(target)?.walkable).toBe(false);
	});

	it('sets the goal with the goal brush and leaves the start alone', () => {
		const target = editableCell();
		const start = environmentState.gridStart;
		const oldGoal = environmentState.gridGoal;

		editorState.mode = 'goal';
		editorState.onPointerDown(target);
		editorState.onPointerUp(target);

		expect(environmentState.gridGoal).toBe(target);
		expect(environmentState.gridStart).toBe(start);
		expect(environmentState.gridStart).not.toBe(environmentState.gridGoal);
		expect(oldGoal).not.toBe(target);
	});

	it('sets the start with the start brush and leaves the goal alone', () => {
		const target = editableCell();
		const oldGoal = environmentState.gridGoal;

		editorState.mode = 'start';
		editorState.onPointerDown(target);
		editorState.onPointerUp(target);

		expect(environmentState.gridStart).toBe(target);
		expect(environmentState.gridGoal).toBe(oldGoal);
	});

	it('clears a wall under the goal brush, since a goal must be reachable', () => {
		const walled = [...environmentState.grid.nodes.entries()].find(
			([id, n]) => !n.walkable && id !== environmentState.gridStart && id !== environmentState.gridGoal
		);
		if (!walled) return; // A blank grid has no walls to clear.
		const [target] = walled;

		editorState.mode = 'goal';
		editorState.onPointerDown(target);
		editorState.onPointerUp(target);

		expect(environmentState.gridGoal).toBe(target);
		expect(environmentState.grid.nodes.get(target)?.walkable).toBe(true);
	});

	it('leaves the start and goal cells alone', () => {
		const start = environmentState.gridStart!;
		editorState.onPointerDown(start);
		editorState.onPointerUp(start);

		expect(environmentState.gridStart).toBe(start);
		expect(environmentState.grid.nodes.get(start)?.walkable).toBe(true);
	});

	it('commits the edit to history so it can be undone', () => {
		const target = editableCell();
		editorState.onPointerDown(target);
		editorState.onPointerUp(target);
		expect(environmentState.grid.nodes.get(target)?.walkable).toBe(false);

		environmentState.undo();
		expect(environmentState.grid.nodes.get(target)?.walkable).toBe(true);
	});

	it('erases back to a walkable cell with the erase tool', () => {
		const target = editableCell();
		editorState.mode = 'erase';
		editorState.onPointerDown(target);
		editorState.onPointerUp(target);

		expect(environmentState.grid.nodes.get(target)?.walkable).toBe(true);
	});

	it('still draws a wall when a graph-only tool was carried over from another family', () => {
		// The exact reported sequence: visit the adversarial family, whose strip only
		// offers "remove", then come back to pathfinding.
		environmentState.familyId = 'adversarial';
		editorState.mode = 'remove';
		environmentState.familyId = 'pathfinding';
		environmentState.environmentType = 'perfect_maze';
		environmentState.handleGenerate();

		const target = editableCell();
		editorState.onPointerDown(target);
		editorState.onPointerUp(target);

		expect(environmentState.grid.nodes.get(target)?.walkable).toBe(false);
	});
});

describe('the active tool is always valid for the active environment', () => {
	/**
	 * Enforced on read rather than reconciled at each change site, because a rule
	 * that some path can forget fails silently. Every environment/tool combination
	 * must resolve to a tool the strip renders and the environment handles.
	 */
	it.each(ALL_ENVIRONMENTS)('resolves to a rendered tool in %s', (environmentType) => {
		for (const mode of ALL_MODES) {
			editorState.mode = mode;
			environmentState.environmentType = environmentType;

			const available = availableEditModes(environmentType);
			expect(available, `${environmentType} offers no tools`).not.toHaveLength(0);
			expect(available, `${environmentType}/${mode}`).toContain(editorState.mode);
		}
	});

	it('gives a grid a paint tool, so a click always does something', () => {
		environmentState.environmentType = 'perfect_maze';
		for (const mode of ALL_MODES) {
			editorState.mode = mode;
			expect(['wall', 'erase', 'start', 'goal', 'cost']).toContain(editorState.mode);
		}
	});

	it('gives a graph a topology tool', () => {
		environmentState.environmentType = 'graph';
		for (const mode of ALL_MODES) {
			editorState.mode = mode;
			expect(['move', 'node', 'edge', 'remove', 'start', 'goal', 'cost']).toContain(editorState.mode);
		}
	});

	it('restores the previous tool when the environment comes back', () => {
		// Reconciling on read means the tool is remembered rather than overwritten,
		// so a round trip through another family is non-destructive.
		editorState.mode = 'node';
		expect(editorState.mode).toBe('node');

		environmentState.environmentType = 'blank';
		expect(editorState.mode).toBe('wall');

		environmentState.environmentType = 'graph';
		expect(editorState.mode).toBe('node');
	});

	it('offers no paint or marker tools on a game tree, where they are not implemented', () => {
		// Exact set, not a subset check: the point of the test is that a tool
		// cannot be added to the game-tree strip without also being implemented on
		// GameTreeCanvas. `remove` is the only tool that canvas handles.
		expect(availableEditModes('manual_tree')).toEqual(['remove']);

		for (const gameTree of ['manual_tree', 'random_tree', 'tic_tac_toe', 'nim'] as const) {
			expect(availableEditModes(gameTree)).toEqual(['remove']);
		}
	});

	it('offers start and goal on a graph, which does implement them', () => {
		// The counterpart to the game-tree rule: a manual graph really can mark a
		// start and a goal node, so those tools belong on its strip.
		const graphModes = availableEditModes('graph');
		expect(graphModes).toContain('start');
		expect(graphModes).toContain('goal');
		expect(graphModes).toContain('cost');
	});
});
