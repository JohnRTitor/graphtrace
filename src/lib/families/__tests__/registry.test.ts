import { describe, expect, it } from 'vitest';
import { allAlgorithmSummaries, getAlgorithm, getGameSearchAlgorithm } from '../../algorithms';
import { allEnvironmentTypes } from '../../generators/types';
import type { Problem } from '../../domain/problem';
import { createGrid } from '../../graph/grid';
import { ManualGraph } from '../../graph/manual';
import { buildManualGameTree } from '../../generators/game';
import {
	adversarialFamily,
	defaultAlgorithmId,
	families,
	familyForEnvironment,
	familyForProblem,
	getFamily,
	optimizationFamily,
	pathfindingFamily,
	plannedFamilies,
	readyFamilies,
	sortingFamily
} from '../registry';

describe('family registry', () => {
	it('lists every family exactly once, with unique ids', () => {
		const ids = families.map((family) => family.id);

		expect(new Set(ids).size).toBe(ids.length);
	});

	it('puts ready families before planned ones in the switcher', () => {
		const firstPlanned = families.findIndex((family) => family.status === 'planned');

		expect(families.slice(0, firstPlanned).every((family) => family.status === 'ready')).toBe(true);
	});

	it('includes the two unbuilt families as stubs', () => {
		const planned = plannedFamilies().map((family) => family.id);

		expect(planned).toEqual([optimizationFamily.id, sortingFamily.id]);
	});

	it('builds a family with no algorithms, renderer or metrics wired up', () => {
		for (const family of plannedFamilies()) {
			expect(family.algorithms).toEqual([]);
			expect(family.algorithmSummaries()).toEqual([]);
			expect(family.inspectorSchema()).toEqual([]);
			expect(family.eventKinds.length).toBeGreaterThan(0);
			expect(family.description).toMatch(/coming soon/i);
		}
	});

	it('never claims a problem or an environment a planned family does not own', () => {
		for (const family of plannedFamilies()) {
			expect(family.matchProblem({ type: 'grid', grid: createGrid(2, 2) } as Problem)).toBe(false);
			expect(family.environmentTypes).toEqual([]);
		}
	});

	describe('pathfinding', () => {
		it('is ready and owns the pre-existing environment types', () => {
			expect(pathfindingFamily.status).toBe('ready');
			expect(pathfindingFamily.environmentTypes).toEqual([
				'perfect_maze',
				'braided_maze',
				'random_obstacles',
				'blank',
				'graph'
			]);
		});

		it('registers the three existing algorithms with complexity and property badges', () => {
			const summaries = pathfindingFamily.algorithmSummaries();

			expect(summaries.map((summary) => summary.id)).toEqual(['bfs', 'dfs', 'astar']);
			for (const summary of summaries) {
				expect(summary.complexity.time).toBeTruthy();
				expect(summary.complexity.space).toBeTruthy();
				expect(typeof summary.properties.optimal).toBe('boolean');
				expect(typeof summary.properties.complete).toBe('boolean');
			}
		});

		it('keeps the metrics table labels it had before the registry existed', () => {
			expect(pathfindingFamily.metricsColumns.map((column) => column.label)).toEqual([
				'Nodes Discovered',
				'Nodes Expanded',
				'Max Frontier Size',
				'Path Length',
				'Path Cost',
				'Execution Time'
			]);
		});

		it('matches both pre-existing problem variants', () => {
			const grid: Problem = {
				type: 'grid',
				grid: createGrid(2, 2),
				movementModel: { type: 'fourWay' },
				costModel: {},
				version: 'v'
			};
			const graph: Problem = {
				type: 'graph',
				graph: new ManualGraph(),
				costModel: {},
				version: 'v'
			};

			expect(pathfindingFamily.matchProblem(grid)).toBe(true);
			expect(pathfindingFamily.matchProblem(graph)).toBe(true);
			expect(pathfindingFamily.matchProblem(gameTreeProblem())).toBe(false);
		});
	});

	describe('adversarial', () => {
		it('is ready and registers minimax and alpha-beta', () => {
			expect(adversarialFamily.status).toBe('ready');
			expect(adversarialFamily.algorithms).toEqual(['minimax', 'alphabeta']);
			expect(adversarialFamily.algorithmSummaries().map((summary) => summary.id)).toEqual([
				'minimax',
				'alphabeta'
			]);
		});

		it('declares its own event vocabulary', () => {
			expect(adversarialFamily.eventKinds).toEqual([
				'start',
				'visit',
				'evaluate',
				'prune',
				'backup',
				'choose',
				'finish'
			]);
		});

		it('shares only the lifecycle markers with pathfinding', () => {
			// `start` and `finish` bracket a run in any family, so sharing them is
			// deliberate. Everything that carries meaning must be family-specific,
			// which is what stops a game-tree trace being read as a search.
			const shared = adversarialFamily.eventKinds.filter((kind) =>
				pathfindingFamily.eventKinds.includes(kind)
			);
			expect(shared.sort()).toEqual(['finish', 'start']);

			for (const kind of ['visit', 'evaluate', 'prune', 'backup', 'choose']) {
				expect(pathfindingFamily.eventKinds).not.toContain(kind);
			}
			for (const kind of ['discover', 'expand', 'update', 'skip', 'path', 'no-path']) {
				expect(adversarialFamily.eventKinds).not.toContain(kind);
			}
		});

		it('declares metrics of its own', () => {
			const labels = adversarialFamily.metricsColumns.map((column) => column.label);

			expect(labels).toContain('Nodes Pruned');
			expect(labels).toContain('Prune Rate');
			expect(labels).toContain('Branching Factor');
			expect(labels).not.toContain('Max Frontier Size');
		});

		it('matches only its own problem variant', () => {
			expect(adversarialFamily.matchProblem(gameTreeProblem())).toBe(true);
			expect(
				adversarialFamily.matchProblem({
					type: 'grid',
					grid: createGrid(2, 2),
					movementModel: { type: 'fourWay' },
					costModel: {},
					version: 'v'
				})
			).toBe(false);
		});
	});

	describe('routing', () => {
		it('finds a family by id', () => {
			expect(getFamily('pathfinding')).toBe(pathfindingFamily);
			expect(getFamily('adversarial')).toBe(adversarialFamily);
			expect(getFamily('nope')).toBeUndefined();
		});

		it('routes each problem to exactly one ready family', () => {
			expect(familyForProblem(gameTreeProblem())).toBe(adversarialFamily);
			expect(
				familyForProblem({
					type: 'graph',
					graph: new ManualGraph(),
					costModel: {},
					version: 'v'
				})
			).toBe(pathfindingFamily);
		});

		it('routes every environment type to the family that owns it', () => {
			for (const type of allEnvironmentTypes) {
				const owner = familyForEnvironment(type);
				expect(owner, `no owner for ${type}`).toBeDefined();
				expect(owner!.environmentTypes).toContain(type);
			}
		});

		it('assigns every environment type to exactly one family', () => {
			const claimed = families.flatMap((family) => family.environmentTypes);
			expect(new Set(claimed).size).toBe(claimed.length);
			expect(claimed.sort()).toEqual([...allEnvironmentTypes].sort());
		});
	});

	describe('algorithm summaries', () => {
		it('covers every algorithm in both registries, tagged with its family', () => {
			const summaries = allAlgorithmSummaries();

			expect(summaries.map((summary) => summary.id).sort()).toEqual(
				['alphabeta', 'astar', 'bfs', 'dfs', 'minimax'].sort()
			);
			for (const summary of summaries) {
				expect(readyFamilies().some((family) => family.id === summary.familyId)).toBe(true);
			}
		});

		it('marks only alpha-beta as prunable', () => {
			const prunable = allAlgorithmSummaries()
				.filter((summary) => summary.supportsPruning)
				.map((summary) => summary.id);

			expect(prunable).toEqual(['alphabeta']);
		});

		it('keeps the legacy per-family algorithm lookups working', () => {
			expect(getAlgorithm('bfs')?.name).toBe('Breadth-First Search');
			expect(getGameSearchAlgorithm('minimax')?.name).toBe('Minimax');
		});
	});

	describe('defaultAlgorithmId', () => {
		it('returns the first registered algorithm', () => {
			expect(defaultAlgorithmId(pathfindingFamily)).toBe('bfs');
			expect(defaultAlgorithmId(adversarialFamily)).toBe('minimax');
		});

		it('returns null for a family with no algorithms', () => {
			expect(defaultAlgorithmId(optimizationFamily)).toBeNull();
		});
	});
});

function gameTreeProblem(): Problem {
	return { type: 'game-tree', family: 'adversarial', tree: buildManualGameTree(), version: 'v' };
}
