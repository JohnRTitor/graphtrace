import { describe, expect, it } from 'vitest';
import { allAlgorithmSummaries } from '../../../algorithms';
import { families } from '../../../families/registry';
import { flatten, fuzzyMatch, moveSelection, searchAlgorithms } from '../palette-search';

const idsOf = (groups: ReturnType<typeof searchAlgorithms>) =>
	flatten(groups).map((hit) => hit.summary.id);

describe('algorithm palette search', () => {
	describe('fuzzyMatch', () => {
		it('matches a name in full', () => {
			expect(fuzzyMatch('Breadth-First Search', 'breadth')?.score).toBeGreaterThan(0);
		});

		it('matches a subsequence', () => {
			expect(fuzzyMatch('Breadth-First Search', 'bfs')).not.toBeNull();
		});

		it('rejects a query whose characters are out of order', () => {
			expect(fuzzyMatch('Breadth-First Search', 'fsb')).toBeNull();
		});

		it('rejects a query with a character the name lacks', () => {
			expect(fuzzyMatch('Breadth-First Search', 'breadthx')).toBeNull();
		});

		it('scores a prefix above a scattered match', () => {
			const prefix = fuzzyMatch('Minimax', 'min')!.score;
			const scattered = fuzzyMatch('Minimise', 'min')!.score;
			expect(prefix).toBeGreaterThanOrEqual(scattered);
		});

		it('scores consecutive runs above separated characters', () => {
			const run = fuzzyMatch('alphabeta', 'alpha')!.score;
			const spread = fuzzyMatch('alphabeta', 'apba')!.score;
			expect(run).toBeGreaterThan(spread);
		});

		it('rewards a match at a word boundary', () => {
			const boundary = fuzzyMatch('Minimax with Alpha-Beta Pruning', 'b')!.score;
			const middle = fuzzyMatch('Minimax with Alpha-Beta Pruning', 'i')!.score;
			expect(boundary).toBeGreaterThan(middle);
		});

		it('skips punctuation, so a bare name still matches', () => {
			expect(fuzzyMatch('A* Search', 'asearch')).not.toBeNull();
		});

		it('keeps highlight indices aligned with the original string', () => {
			// The `*` is skipped by the matcher but present in the source, so the
			// match on "S" must report index 3, not 2.
			expect(fuzzyMatch('A* Search', 'asearch')?.matches.slice(0, 2)).toEqual([0, 3]);
		});

		it('treats an empty query as a match with no highlight', () => {
			expect(fuzzyMatch('BFS', '')).toEqual({ score: 0, matches: [] });
		});
	});

	describe('searchAlgorithms', () => {
		it('lists every algorithm of every built family for an empty query', () => {
			const found = idsOf(searchAlgorithms(''));
			const built = allAlgorithmSummaries().filter((summary) =>
				families.some((family) => family.id === summary.familyId && family.status === 'ready')
			);

			expect(found.sort()).toEqual(built.map((summary) => summary.id).sort());
		});

		it('groups results by family', () => {
			const groups = searchAlgorithms('');

			expect(groups.map((group) => group.family.id).sort()).toEqual(['adversarial', 'pathfinding']);
		});

		it('finds an algorithm in the family that is not first in the registry', () => {
			// "minimax" only exists in the second group; a per-family filter applied
			// before ranking would have hidden it.
			const groups = searchAlgorithms('minimax');

			expect(groups).toHaveLength(1);
			expect(groups[0].family.id).toBe('adversarial');
			expect(idsOf(groups)).toContain('minimax');
		});

		it('finds alpha-beta by a subsequence', () => {
			expect(idsOf(searchAlgorithms('abeta'))).toContain('alphabeta');
		});

		it('ranks the best match first', () => {
			const hits = flatten(searchAlgorithms('astar'));
			expect(hits[0].summary.id).toBe('astar');
		});

		it('finds an algorithm by its id even when the name cannot match', () => {
			// "A* Search" contains no `t`, so "astar" is only reachable through the
			// id. This is the query people who know the tool actually type.
			expect(fuzzyMatch('A* Search', 'astar')).toBeNull();
			expect(idsOf(searchAlgorithms('astar'))[0]).toBe('astar');
		});

		it('does not let a scattered name match outrank an id match', () => {
			// "Breadth-First Search" contains a-s-t-a-r as a subsequence; the id
			// match for astar must still win.
			const hits = flatten(searchAlgorithms('astar'));
			expect(hits.findIndex((hit) => hit.summary.id === 'astar')).toBeLessThan(
				hits.findIndex((hit) => hit.summary.id === 'bfs')
			);
		});

		it('drops groups with no match', () => {
			const groups = searchAlgorithms('zzzznotanalgorithm');

			expect(groups).toEqual([]);
			expect(idsOf(groups)).toEqual([]);
		});

		it('can be restricted to one family', () => {
			const groups = searchAlgorithms('', { familyId: 'pathfinding' });

			expect(groups.map((group) => group.family.id)).toEqual(['pathfinding']);
		});

		it('excludes unbuilt families unless asked for them', () => {
			const withoutPlanned = searchAlgorithms('').map((group) => group.family.id);
			const withPlanned = searchAlgorithms('', { includePlanned: true }).map(
				(group) => group.family.id
			);

			expect(withoutPlanned).not.toContain('optimization');
			expect(withPlanned).toContain('optimization');
		});
	});

	describe('moveSelection', () => {
		// Real summaries: the helpers are structurally typed, but a test that
		// invents half an `AlgorithmSummary` proves nothing about the real shape.
		const [first, second] = allAlgorithmSummaries();
		const groups = [{ hits: [first] }, { hits: [second] }];

		it('moves across group boundaries', () => {
			expect(moveSelection(groups, 0, 1)).toBe(1);
			expect(moveSelection(groups, 1, -1)).toBe(0);
		});

		it('clamps at both ends', () => {
			expect(moveSelection(groups, 0, -1)).toBe(0);
			expect(moveSelection(groups, 1, 1)).toBe(1);
		});

		it('returns -1 when there is nothing to select', () => {
			expect(moveSelection([], 0, 1)).toBe(-1);
		});
	});

	it('flattens groups in render order', () => {
		const [first, second] = allAlgorithmSummaries();
		const flat = flatten([{ hits: [{ summary: first }] }, { hits: [{ summary: second }] }]);

		expect(flat).toHaveLength(2);
		expect(flat[0].summary.id).toBe(first.id);
		expect(flat[1].summary.id).toBe(second.id);
	});
});
