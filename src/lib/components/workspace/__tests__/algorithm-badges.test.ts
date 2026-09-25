import { describe, expect, it } from 'vitest';
import { allAlgorithmSummaries, getAlgorithmSummary } from '../../../algorithms';
import { algorithmBadges } from '../algorithm-badges';

const badgeFor = (id: string, title: string) =>
	algorithmBadges(getAlgorithmSummary(id)!).find((badge) => badge.title === title);

describe('algorithm badges', () => {
	it('shows both complexities and both properties for every algorithm', () => {
		for (const summary of allAlgorithmSummaries()) {
			const badges = algorithmBadges(summary);
			const titles = badges.map((badge) => badge.title);

			expect(titles, `${summary.id} is missing its time complexity`).toContain('Time complexity');
			expect(titles, `${summary.id} is missing its space complexity`).toContain('Space complexity');
			expect(titles).toContain(
				summary.properties.optimal
					? 'Guaranteed to return an optimal result'
					: 'May return a suboptimal result'
			);
			expect(titles).toContain(
				summary.properties.complete
					? 'Always evaluates the whole search space'
					: 'May skip parts of the search space'
			);
		}
	});

	it('labels alpha-beta as pruning and plain minimax as complete', () => {
		expect(badgeFor('alphabeta', 'May skip parts of the search space')?.label).toBe('prunes');
		expect(badgeFor('minimax', 'Always evaluates the whole search space')?.label).toBe('complete');
	});

	it('labels DFS as suboptimal and the others as optimal', () => {
		expect(badgeFor('dfs', 'May return a suboptimal result')?.label).toBe('suboptimal');
		expect(badgeFor('bfs', 'Guaranteed to return an optimal result')?.label).toBe('optimal');
		expect(badgeFor('astar', 'Guaranteed to return an optimal result')?.label).toBe('optimal');
		expect(badgeFor('minimax', 'Guaranteed to return an optimal result')?.label).toBe('optimal');
	});

	it('carries the complexity strings through verbatim', () => {
		expect(badgeFor('bfs', 'Time complexity')?.label).toBe('O(V + E)');
		expect(badgeFor('minimax', 'Time complexity')?.label).toBe('O(b^d)');
		expect(badgeFor('alphabeta', 'Time complexity')?.label).toBe('O(b^(d/2))');
	});

	it('never repeats a title, so each badge can be keyed uniquely', () => {
		for (const summary of allAlgorithmSummaries()) {
			const titles = algorithmBadges(summary).map((badge) => badge.title);
			expect(new Set(titles).size).toBe(titles.length);
		}
	});

	it('leaves no badge without a label or an explanation', () => {
		for (const summary of allAlgorithmSummaries()) {
			for (const badge of algorithmBadges(summary)) {
				expect(badge.label.length).toBeGreaterThan(0);
				expect(badge.title.length).toBeGreaterThan(0);
			}
		}
	});
});
