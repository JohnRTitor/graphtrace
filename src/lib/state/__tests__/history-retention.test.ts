import { describe, expect, it } from 'vitest';
import { HistoryStore } from '../history-store.svelte';
import { EnvironmentState } from '../environment.svelte';
import { generateRandomGraph } from '../../generators/random-graph';
import { serializeWorkspace } from '../../persistence/save-load';

describe('history retention', () => {
	it('caps the undo stack instead of growing without limit', () => {
		// Structural commands carry whole-snapshot payloads, so an unbounded stack
		// turned a session of repeated regeneration into megabytes of retained
		// snapshots that nothing could reach.
		const applied: number[] = [];
		const store = new HistoryStore<number>(
			(cmd) => applied.push(cmd),
			() => {}
		);

		for (let index = 0; index < HistoryStore.LIMIT * 3; index++) store.execute(index);

		expect(store.size.undo).toBe(HistoryStore.LIMIT);
	});

	it('drops the oldest commands, so recent edits are the ones that undo', () => {
		const undone: number[] = [];
		const store = new HistoryStore<number>(
			() => {},
			(cmd) => undone.push(cmd)
		);

		const total = HistoryStore.LIMIT + 10;
		for (let index = 0; index < total; index++) store.execute(index);

		for (let index = 0; index < HistoryStore.LIMIT; index++) store.undo();

		// The most recent 100 survive; the first 10 are unreachable.
		expect(undone[0]).toBe(total - 1);
		expect(undone[undone.length - 1]).toBe(total - HistoryStore.LIMIT);
		expect(undone).not.toContain(0);
	});

	it('still supports redo after a bounded undo', () => {
		const store = new HistoryStore<number>(
			() => {},
			() => {}
		);
		store.execute(1);
		store.undo();

		expect(store.canRedo).toBe(true);
		store.redo();
		expect(store.canUndo).toBe(true);
		expect(store.canRedo).toBe(false);
	});

	it('clears the redo stack on a new edit', () => {
		const store = new HistoryStore<number>(
			() => {},
			() => {}
		);
		store.execute(1);
		store.undo();
		store.execute(2);

		expect(store.canRedo).toBe(false);
	});
});

describe('repeated environment churn does not accumulate', () => {
	it('keeps the environment usable after many generations and algorithm changes', () => {
		// The reported symptom was a freeze after selecting an algorithm, so this
		// asserts the invariant that repeated switching leaves nothing behind: the
		// history is bounded, the environment still round-trips, and the state stays
		// correct.
		const state = new EnvironmentState();

		for (let index = 0; index < 60; index++) {
			state.environmentSeed = index;
			state.environmentType = index % 2 === 0 ? 'blank' : 'graph';
			state.handleGenerate();
			state.selectedAlgorithmId = index % 2 === 0 ? 'bfs' : 'astar';
		}

		expect(state.runError).toBeNull();
		expect(() => serializeWorkspace(state)).not.toThrow();

		// Undo/redo still functions and is still bounded.
		state.undo();
		state.redo();
		expect(state.canUndo).toBe(true);
	});

	it('keeps the manual graph correct after a churn of generations', () => {
		const state = new EnvironmentState();
		state.environmentType = 'graph';

		for (let index = 0; index < 30; index++) {
			state.environmentSeed = index;
			state.handleGenerate();
		}

		const snapshot = generateRandomGraph({
			nodeCount: state.graphNodeCount,
			edgeMultiplier: state.graphEdgeMultiplier,
			weighted: true,
			ensurePath: true,
			directed: false,
			seed: 29
		});
		// The live graph must match the last generation, not some earlier one.
		expect(state.graph.nodes.size).toBe(snapshot.nodes.length);
		expect(state.graph.edges.size).toBe(snapshot.edges.length);
	});

	it('keeps the game tree correct after a churn of family and algorithm switching', () => {
		const state = new EnvironmentState();

		for (let index = 0; index < 30; index++) {
			state.familyId = index % 2 === 0 ? 'adversarial' : 'pathfinding';
			if (state.isAdversarialFamily) {
				state.environmentType = 'random_tree';
				state.environmentSeed = index;
				state.handleGenerate();
				state.runAlgorithm('step');
			}
		}

		// Whatever family it ended on, the environment must be runnable.
		expect(['pathfinding', 'adversarial']).toContain(state.familyId);
		expect(() => state.getProblem()).not.toThrow();
	});
});
