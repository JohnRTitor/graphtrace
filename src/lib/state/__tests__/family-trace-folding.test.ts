import { describe, expect, it, beforeEach } from 'vitest';
import { environmentState } from '../environment.svelte';
import { playbackState } from '../playback.svelte';
import { getFamily } from '../../families/registry';
import { asPathfindingState } from '../../families/pathfinding/trace';

/**
 * BFS on a maze advanced the playhead but painted nothing: the slider moved, the
 * status said `running`, and the canvas stayed blank.
 *
 * The cause was in `codecFor`, which hardcoded the *game-tree* reducer as the
 * engine's in-place fast path for every family. A pathfinding trace was therefore
 * folded by a reducer that does not understand its events, so the state came back
 * unchanged, `cellStates` stayed empty, and `MazeRenderer.renderVisualization`
 * took its empty-state early return on every step.
 *
 * The step counter is maintained by the engine and is independent of the state,
 * which is exactly why this looked like working playback: the trace really was
 * running, it was just producing no visualisation.
 *
 * So the assertion that matters is not "the step advances" - it already did - but
 * "the family's own state actually changes as the trace is folded".
 */
describe('each family folds its trace with its own reducer', () => {
	/**
	 * Steps the pane. The opening event of a trace establishes the start and
	 * paints nothing, so asserting on cell states before advancing would fail for
	 * the right reason at the wrong moment.
	 */
	const advance = (steps: number) => {
		for (let i = 0; i < steps; i++) playbackState.step();
	};

	beforeEach(() => {
		environmentState.familyId = 'pathfinding';
		environmentState.environmentType = 'blank';
		environmentState.resizeGrid(12, 14);
		environmentState.handleGenerate();
	});

	it('gives every ready family an in-place fast path or a plain reduce', () => {
		for (const family of [getFamily('pathfinding'), getFamily('adversarial')]) {
			expect(family, 'family missing').toBeDefined();
			// Optional, but a family that supplies one must be able to actually
			// reduce its own events - that is the bug this file is about.
			if (family!.stepInto) {
				const state = family!.createTraceState();
				expect(typeof family!.stepInto(state, family!.toTraceEvents([])[0] ?? {
					step: 0,
					kind: '',
					payload: {}
				})).toBe('object');
			}
		}
	});

	it('accumulates cell states while a pathfinding trace is folded', () => {
		environmentState.selectedAlgorithmId = 'bfs';
		expect(environmentState.runAlgorithm('step'), environmentState.runError ?? '').not.toBeNull();

		// The first event of a BFS trace is the start marker, which paints nothing, so
		// the trace has to be advanced before there is anything to look at.
		advance(8);

		const state = asPathfindingState(playbackState.vizState);
		expect(state, 'pathfinding playback produced a non-pathfinding state').not.toBeNull();
		expect(
			state!.cellStates.size,
			'BFS produced no cell states, so the maze can never paint'
		).toBeGreaterThan(0);
	});

	it('grows the visited set as the trace is stepped, not just the counter', () => {
		environmentState.selectedAlgorithmId = 'bfs';
		environmentState.runAlgorithm('step');

		advance(8);
		const before = asPathfindingState(playbackState.vizState)!.cellStates.size;
		expect(before).toBeGreaterThan(0);

		advance(12);
		const after = asPathfindingState(playbackState.vizState)!.cellStates.size;

		expect(playbackState.currentStep).toBeGreaterThan(1);
		expect(after, 'the counter advanced but the grid state did not').toBeGreaterThan(before);
	});

	it('paints every cell the search reports, with a real fill colour', () => {
		// The renderer needs both a non-empty `cellStates` and a colour it can map
		// to a fill; a state full of unmapped kinds would still draw nothing.
		environmentState.selectedAlgorithmId = 'bfs';
		environmentState.runAlgorithm('step');
		advance(8);

		const state = asPathfindingState(playbackState.vizState)!;
		const mapped = ['current', 'discovered', 'expanded', 'path'];
		for (const [, kind] of state.cellStates) {
			expect(mapped, `unpaintable cell state "${kind}"`).toContain(kind);
		}
	});

	it('still folds a game-tree trace with the game-tree reducer', () => {
		environmentState.familyId = 'adversarial';
		environmentState.environmentType = 'manual_tree';
		environmentState.handleGenerate();
		environmentState.selectedAlgorithmId = 'minimax';
		expect(environmentState.runAlgorithm('step'), environmentState.runError ?? '').not.toBeNull();
		advance(8);

		// The adversarial side worked all along, and must keep working.
		const treeState = playbackState.gameTreeState;
		expect(treeState, 'adversarial playback produced a non-tree state').not.toBeNull();
		expect(treeState!.visited?.size ?? 0, 'the tree state is not accumulating visits').toBeGreaterThan(0);
	});
});
