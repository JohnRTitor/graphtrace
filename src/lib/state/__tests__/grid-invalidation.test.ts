import { describe, expect, it, beforeEach } from 'vitest';
import { editorState } from '../editor.svelte';
import { environmentState } from '../environment.svelte';

function walkableCell(): string {
	for (const [id, node] of environmentState.grid.nodes) {
		if (node.walkable && id !== environmentState.gridStart && id !== environmentState.gridGoal) {
			return id;
		}
	}
	throw new Error('no walkable cell');
}

/**
 * The grid canvas repaints only when a component effect decides the grid
 * "changed", and that decision bottoms out in `environmentState.gridVersion`.
 * The grid object is mutated in place for performance, so its identity never
 * changes and cannot be the signal - the version is.
 *
 * These tests assert on the version rather than on rendering because the
 * renderer needs a canvas, and because asserting on the invalidation signal is
 * the more precise claim: it is what the effect subscribes to.
 */
describe('grid repaint invalidation', () => {
	beforeEach(() => {
		environmentState.familyId = 'pathfinding';
		environmentState.environmentType = 'perfect_maze';
		environmentState.handleGenerate();
		editorState.mode = 'wall';
	});

	it('invalidates on every cell of a drag, not only on release', () => {
		const cells = Array.from(environmentState.grid.nodes.entries())
			.filter(([id, n]) => n.walkable && id !== environmentState.gridStart && id !== environmentState.gridGoal)
			.slice(0, 5)
			.map(([id]) => id);

		const versions: number[] = [];
		editorState.onPointerDown(cells[0]);
		versions.push(environmentState.gridVersion);

		for (const id of cells.slice(1)) {
			editorState.onPointerMove(id);
			versions.push(environmentState.gridVersion);
		}
		editorState.onPointerUp(cells[cells.length - 1]);

		// Strictly increasing per cell: a wall has to appear as it is drawn, not
		// in one lump when the mouse comes up.
		for (let i = 1; i < versions.length; i++) {
			expect(versions[i], `cell ${i} of the drag did not invalidate`).toBeGreaterThan(
				versions[i - 1]
			);
		}
		expect(versions.length).toBe(cells.length);
	});

	it('invalidates when a single cell is painted', () => {
		const before = environmentState.gridVersion;
		editorState.onPointerDown(walkableCell());
		expect(environmentState.gridVersion).toBeGreaterThan(before);
		editorState.onPointerUp(null);
	});

	it('invalidates when the erase tool clears a cell', () => {
		const target = walkableCell();
		editorState.mode = 'wall';
		editorState.onPointerDown(target);
		editorState.onPointerUp(null);
		expect(environmentState.grid.nodes.get(target)?.walkable).toBe(false);

		const before = environmentState.gridVersion;
		editorState.mode = 'erase';
		editorState.onPointerDown(target);
		expect(environmentState.gridVersion).toBeGreaterThan(before);
		editorState.onPointerUp(null);
		expect(environmentState.grid.nodes.get(target)?.walkable).toBe(true);
	});

	it('invalidates when the start marker moves', () => {
		const before = environmentState.gridVersion;
		editorState.mode = 'start';
		editorState.onPointerDown(walkableCell());
		expect(environmentState.gridVersion).toBeGreaterThan(before);
		editorState.onPointerUp(null);
	});

	it('invalidates when a cell is given a cost', () => {
		editorState.mode = 'cost';
		editorState.costValue = 7;
		const before = environmentState.gridVersion;
		editorState.onPointerDown(walkableCell());
		expect(environmentState.gridVersion).toBeGreaterThan(before);
		editorState.onPointerUp(null);
	});

	/**
	 * Why the renderer has to watch the version rather than the grid.
	 *
	 * `MazeCanvas` repaints from a `$derived` holding the grid. Cells are edited
	 * in place for performance, so that derived recomputes to the *same object*,
	 * and Svelte drops a derived whose value is equal to its previous one - so an
	 * effect watching the grid alone silently stops re-running. The canvas then
	 * trails the model by one edit and only catches up when something else forces
	 * a repaint, which is what "it shows the previous change" looked like.
	 *
	 * These two assertions together are the regression: identity is stable, the
	 * version is not, so the version is the only usable signal.
	 */
	it('keeps the grid identity stable while the version advances', () => {
		const target = walkableCell();
		const gridBefore = environmentState.grid;
		const versionBefore = environmentState.gridVersion;

		editorState.onPointerDown(target);

		// Identity unchanged: in-place mutation, so the object cannot be a signal.
		expect(environmentState.grid).toBe(gridBefore);
		// The signal that does change.
		expect(environmentState.gridVersion).toBeGreaterThan(versionBefore);
		// And the edit really landed, so this is not a no-op passing vacuously.
		expect(environmentState.grid.nodes.get(target)?.walkable).toBe(false);

		editorState.onPointerUp(null);
	});

	it('advances the version once per painted cell, not once per drag', () => {
		const cells = Array.from(environmentState.grid.nodes.entries())
			.filter(([id, n]) => n.walkable && id !== environmentState.gridStart && id !== environmentState.gridGoal)
			.slice(0, 6)
			.map(([id]) => id);

		const start = environmentState.gridVersion;
		editorState.onPointerDown(cells[0]);
		for (const id of cells.slice(1)) editorState.onPointerMove(id);
		editorState.onPointerUp(cells[cells.length - 1]);

		// One bump per cell, so each wall is painted as it is crossed. A single
		// bump for the whole drag would leave the canvas blank until release.
		expect(environmentState.gridVersion - start).toBeGreaterThanOrEqual(cells.length);
	});
});
