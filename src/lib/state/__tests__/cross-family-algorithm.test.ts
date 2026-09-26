import { describe, expect, it, beforeEach } from 'vitest';
import { environmentState } from '../environment.svelte';
import { isGraphLikeEnvironment } from '../editor-modes';
import { playbackState } from '../playback.svelte';

/**
 * The algorithm palette lists every family, not just the active one, so picking a
 * game-search algorithm while working on a maze is a normal thing to do. It used
 * to fail with `Algorithm minimax not found`.
 *
 * The cause was that the `selectedAlgorithmId` setter kept the family aligned by
 * writing `_familyId` directly. The `familyId` setter does more than that - it
 * also moves `environmentType` to a type the new family can actually use - so
 * bypassing it left the family saying "adversarial" while the environment was
 * still a grid. `getProblem` then handed back a grid problem, and the run
 * dispatched to the pathfinding runner, which has no `minimax` to find.
 */
describe('selecting an algorithm from another family', () => {
	beforeEach(() => {
		environmentState.familyId = 'pathfinding';
		environmentState.environmentType = 'blank';
		environmentState.handleGenerate();
	});

	it('moves the environment to a type the new family can use', () => {
		environmentState.selectedAlgorithmId = 'minimax';

		expect(environmentState.familyId).toBe('adversarial');
		// The invariant the grid/game-tree dispatch in `getProblem` depends on.
		expect(
			isGraphLikeEnvironment(environmentState.environmentType),
			`environment type ${environmentState.environmentType} is not usable by the adversarial family`
		).toBe(true);
	});

	it('runs the game-search algorithm it was handed', () => {
		environmentState.selectedAlgorithmId = 'minimax';

		const executionId = environmentState.runAlgorithm();

		expect(environmentState.runError, 'run reported an error').toBeNull();
		expect(executionId).not.toBeNull();
		expect(playbackState.hasLoadedTrace).toBe(true);
		expect(playbackState.familyId).toBe('adversarial');
	});

	it.each(['minimax', 'alphabeta'])('runs %s from the pathfinding family', (id) => {
		environmentState.selectedAlgorithmId = id;

		environmentState.runAlgorithm();

		expect(environmentState.runError, `${id} reported an error`).toBeNull();
		expect(playbackState.hasLoadedTrace).toBe(true);
	});

	it('still honours the specific algorithm, not the family default', () => {
		// The family setter picks a default algorithm of its own, so setting the
		// family first and the algorithm second has to be deliberate.
		environmentState.selectedAlgorithmId = 'alphabeta';
		expect(environmentState.selectedAlgorithmId).toBe('alphabeta');

		environmentState.selectedAlgorithmId = 'minimax';
		expect(environmentState.selectedAlgorithmId).toBe('minimax');
	});

	it('goes back to pathfinding when a pathfinding algorithm is picked', () => {
		environmentState.selectedAlgorithmId = 'minimax';
		environmentState.runAlgorithm();

		environmentState.selectedAlgorithmId = 'bfs';
		expect(environmentState.familyId).toBe('pathfinding');

		environmentState.runAlgorithm();
		expect(environmentState.runError, 'bfs reported an error').toBeNull();
		expect(playbackState.familyId).toBe('pathfinding');
	});
});
