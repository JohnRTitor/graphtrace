import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvironmentState } from '../environment.svelte';
import { ExecutionStore, MAX_COMPARISON_PANES } from '../execution-store.svelte';
import { buildManualGameTree } from '../../generators/game';
import { serializeGameTree } from '../../graph/game-tree';
import { buildTimeline, kindsInOrder } from '../../trace/timeline';
import { getFamily } from '../../families/registry';
import { serializeWorkspace, deserializeWorkspace } from '../../persistence/save-load';
import { executionStore } from '../execution-store.svelte';
import type { GameTreeProblem } from '../../domain/problem';
import { ManualGraph } from '../../graph/manual';

let frames: Map<number, FrameRequestCallback>;
let nextFrameId: number;
let now: number;

beforeEach(() => {
	frames = new Map();
	nextFrameId = 1;
	now = 0;
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
		const id = nextFrameId++;
		frames.set(id, callback);
		return id;
	});
	vi.stubGlobal('cancelAnimationFrame', (id: number) => {
		frames.delete(id);
	});
	vi.spyOn(performance, 'now').mockImplementation(() => now);
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function treeProblem(tree = buildManualGameTree()): GameTreeProblem {
	return { type: 'game-tree', family: 'adversarial', tree, version: 'test' };
}

describe('ExecutionStore with problem families', () => {
	let store: ExecutionStore;

	beforeEach(() => {
		store = new ExecutionStore();
	});

	describe('adversarial execution', () => {
		it('runs a game tree and tags the execution with its family', () => {
			const id = store.run(treeProblem(), 'minimax');
			const execution = store.get(id);

			expect(execution?.familyId).toBe('adversarial');
			expect(execution?.algorithmId).toBe('minimax');
			expect(Array.isArray(execution?.trace)).toBe(true);
			expect((execution?.trace ?? [])[0]).toMatchObject({ type: 'start' });
		});

		it('snapshots the tree so later edits cannot rewrite a finished run', () => {
			const tree = buildManualGameTree();
			const id = store.run(treeProblem(tree), 'minimax');

			// Edit the live tree after the run: the execution must be unaffected.
			const root = tree.root!;
			const originalRootValue = store.get(id)!.metrics.rootValue;
			tree.nodes.get(root)!.utility = 999;
			tree.children.set(root, []);

			const snapshot = store.get(id)!.problemSnapshot as GameTreeProblem;
			expect(snapshot.tree).not.toBe(tree);
			expect(snapshot.tree.nodes.size).toBeGreaterThan(1);
			// The trace still reflects the tree as it was when the run happened.
			expect(store.get(id)!.metrics.rootValue).toBe(originalRootValue);
		});

		it('refuses a pathfinding algorithm over a game tree', () => {
			expect(() => store.run(treeProblem(), 'bfs')).toThrow(/not found/i);
		});

		it('refuses an empty game tree', () => {
			const empty = { nodes: new Map(), children: new Map(), root: null };
			expect(() => store.run(treeProblem(empty as never), 'minimax')).toThrow(/empty/i);
		});

		it('rejects a malformed tree through the loader before running', () => {
			// A tree the loader would refuse must not reach the search.
			const broken = { type: 'game-tree', family: 'adversarial', tree: { nodes: new Map(), children: new Map(), root: 'x' }, version: 'v' } as GameTreeProblem;
			expect(() => store.run(broken, 'minimax')).toThrow();
		});

		it('agrees with minimax on the root value', () => {
			const plain = store.run(treeProblem(), 'minimax');
			const pruned = store.execute(treeProblem(), 'alphabeta');

			expect(pruned.metrics.rootValue).toBe(store.get(plain)?.metrics.rootValue);
			expect(pruned.metrics.nodesPruned).toBeGreaterThan(0);
		});
	});

	describe('pathfinding execution is unchanged', () => {
		it('still tags pathfinding executions with the pathfinding family', () => {
			const graph = new ManualGraph();
			graph.execute({ type: 'add-node', node: { id: 'A', x: 0, y: 0, label: 'A' } });
			graph.execute({ type: 'add-node', node: { id: 'B', x: 10, y: 0, label: 'B' } });
			graph.execute({ type: 'add-edge', edge: { id: 'ab', source: 'A', target: 'B', weight: 1, directed: false } });
			graph.execute({ type: 'set-start', from: null, to: 'A' });
			graph.execute({ type: 'set-goal', from: null, to: 'B' });

			const id = store.run({ type: 'graph', graph, costModel: {}, version: 'v' }, 'bfs');
			const execution = store.get(id);

			expect(execution?.familyId).toBe('pathfinding');
			// The pathfinding trace is still its own native union, not the envelope.
			expect(execution?.trace.some((event) => event.type === 'path')).toBe(true);
		});
	});

	describe('N-pane comparison', () => {
		it('starts with one pane', () => {
			store.run(treeProblem(), 'minimax');

			expect(store.isComparing).toBe(false);
			expect(store.paneCount).toBe(1);
			expect(store.paneExecutions).toHaveLength(1);
		});

		it('fills a new pane on each run while comparing', () => {
			store.run(treeProblem(), 'minimax');
			store.isComparing = true;
			store.run(treeProblem(), 'alphabeta');
			store.run(treeProblem(), 'minimax');

			expect(store.paneCount).toBe(3);
			expect(store.paneExecutions.map((execution) => execution.algorithmId)).toEqual([
				'minimax',
				'alphabeta',
				'minimax'
			]);
		});

		it('caps the pane count and drops the oldest', () => {
			store.run(treeProblem(), 'minimax');
			store.isComparing = true;
			for (let index = 0; index < 6; index++) {
				store.run(treeProblem(), index % 2 === 0 ? 'minimax' : 'alphabeta');
			}

			expect(store.paneCount).toBe(MAX_COMPARISON_PANES);
			expect(store.paneExecutions).toHaveLength(MAX_COMPARISON_PANES);
		});

		it('addresses panes by index, pane 0 being the active one', () => {
			const active = store.run(treeProblem(), 'minimax');
			store.isComparing = true;
			const second = store.run(treeProblem(), 'alphabeta');

			expect(store.executionAt(0)?.id).toBe(active);
			expect(store.executionAt(1)?.id).toBe(second);
			expect(store.executionAt(2)).toBeNull();
		});

		it('leaving comparison clears every pane', () => {
			store.run(treeProblem(), 'minimax');
			store.isComparing = true;
			store.run(treeProblem(), 'alphabeta');
			store.isComparing = false;

			expect(store.compareIds).toEqual([]);
			expect(store.compareExecution).toBeNull();
			expect(store.paneCount).toBe(1);
		});

		it('dropping a pane closes it without disturbing the others', () => {
			store.run(treeProblem(), 'minimax');
			store.isComparing = true;
			const second = store.run(treeProblem(), 'alphabeta');
			store.run(treeProblem(), 'minimax');

			store.discard(second);
			expect(store.paneCount).toBe(2);
			expect(store.compareIds).not.toContain(second);
		});

		it('invalidates every pane, not just the active one', () => {
			store.run(treeProblem(), 'minimax');
			store.isComparing = true;
			store.run(treeProblem(), 'alphabeta');

			store.invalidatePlayback();
			expect(store.isComparing).toBe(false);
			expect(store.activeId).toBeNull();
			expect(store.paneExecutions).toEqual([]);
		});

		it('never evicts an execution that is currently mounted', () => {
			// Mount one pane, then push the store well past its retention limit.
			store.run(treeProblem(), 'minimax');
			const mounted = store.activeId;
			for (let index = 0; index < 30; index++) {
				store.execute(treeProblem(), 'minimax');
			}

			expect(store.get(mounted!)).toBeDefined();
		});
	});
});

describe('adversarial end to end', () => {
	let env: EnvironmentState;

	beforeEach(() => {
		env = new EnvironmentState();
		env.familyId = 'adversarial';
	});

	it('switches family, keeps the tree, and runs with the family default', () => {
		expect(env.selectedAlgorithmId).toBe('minimax');
		const id = env.runAlgorithm('step');

		expect(id).not.toBeNull();
		expect(env.runError).toBeNull();
	});

	it('produces a trace the timeline can bin by event kind', () => {
		env.environmentType = 'random_tree';
		env.environmentSeed = 99;
		env.handleGenerateGameTree();
		env.runAlgorithm('step');





		const execution = executionStore.activeExecution!;
		const family = getFamily(execution.familyId)!;
		const events = family.toTraceEvents(execution.trace);

		expect(kindsInOrder(events)).toContain('visit');
		expect(kindsInOrder(events)).toContain('backup');
		expect(buildTimeline(events).length).toBeGreaterThan(0);
	});

	it('survives a round trip through save and load', () => {


		env.environmentType = 'nim';
		env.environmentSeed = 31337;
		env.handleGenerateGameTree();
		const expected = serializeGameTree(env.gameTree);

		const json = serializeWorkspace(env);
		const reloaded = new EnvironmentState();
		deserializeWorkspace(json, reloaded);

		expect(reloaded.familyId).toBe('adversarial');
		expect(serializeGameTree(reloaded.gameTree)).toEqual(expected);
	});
});
