import { allAlgorithmSummaries, type AlgorithmSummary } from '../../algorithms';
import { families } from '../../families/registry';
import type { ProblemFamily } from '../../families/types';

/**
 * A ranked search result.
 *
 * `score` is built so a subsequence match always beats a scattered one, and
 * earlier matches always beat later ones - a palette that surfaces a scattered
 * match above an exact prefix match is worse than no palette.
 */
export type PaletteHit = {
	summary: AlgorithmSummary;
	score: number;
	/** Indices in the algorithm name that matched, for highlighting. */
	matches: number[];
};

type Match = { score: number; matches: number[] };

/**
 * Normalises a label for matching, keeping a map back to the original
 * characters so highlight indices stay aligned.
 *
 * Without this, "A* Search" is unmatchable by "astar": the asterisk breaks the
 * subsequence and the letter `t` is missing from the visible name entirely.
 *
 * Spaces and hyphens are deliberately kept. They can never be matched - the needle is
 * alphanumeric only - but they are what identifies a word start, which is one of
 * the two signals that make a good match rank above a merely valid one.
 */
function normalize(text: string): { chars: string[]; sourceIndex: number[] } {
	const chars: string[] = [];
	const sourceIndex: number[] = [];
	for (let index = 0; index < text.length; index++) {
		const char = text[index].toLowerCase();
		if (!/[a-z0-9 -]/.test(char)) continue;
		chars.push(char);
		sourceIndex.push(index);
	}
	return { chars, sourceIndex };
}

/**
 * Fuzzy subsequence match: every character of `query` must appear in `text` in
 * order, scoring higher for consecutive runs and for matches at word starts.
 */
export function fuzzyMatch(text: string, query: string): Match | null {
	const needle = normalize(query).chars.join('');
	if (needle === '') return { score: 0, matches: [] };

	const { chars, sourceIndex } = normalize(text);
	if (chars.length === 0) return null;

	const matches: number[] = [];
	let score = 0;
	let cursor = 0;
	let previousIndex = -2;

	for (const char of needle) {
		let index = chars.indexOf(char, cursor);
		if (index === -1) return null;

		matches.push(sourceIndex[index]);
		// Consecutive characters and word starts are the two signals that
		// distinguish "ab" in "Alpha-Beta" from a coincidence.
		if (index === previousIndex + 1) score += 6;
		if (index === 0 || chars[index - 1] === ' ' || chars[index - 1] === '-') score += 8;
		score += 1;
		previousIndex = index;
		cursor = index + 1;
	}

	// Prefer short names: a match inside "BFS" should outrank the same match
	// inside a long description.
	score += Math.max(0, 20 - chars.length);
	return { score, matches };
}

/** An id hit carries a small bonus: ids are what people who know the tool type. */
const ID_MATCH_BONUS = 5;

function scoreCandidate(summary: AlgorithmSummary, query: string): Match | null {
	const byName = fuzzyMatch(summary.name, query);
	const byId = fuzzyMatch(summary.id, query);

	if (!byId) return byName;
	if (!byName) return { score: byId.score + ID_MATCH_BONUS, matches: [] };
	// Ties go to the name match so the visible text is what gets highlighted.
	return byName.score >= byId.score ? byName : { score: byId.score + ID_MATCH_BONUS, matches: [] };
}

/**
 * Searches every algorithm, grouped by family.
 *
 * Ranking is deliberately global first and grouped second: a query that matches
 * an adversarial algorithm must not be buried because the pathfinding group
 * happens to be first in the registry.
 */
export function searchAlgorithms(
	query: string,
	options: { familyId?: string; includePlanned?: boolean } = {}
): { family: ProblemFamily; hits: PaletteHit[] }[] {
	const familiesToShow = families.filter((family) => {
		if (options.familyId && family.id !== options.familyId) return false;
		if (family.status === 'planned' && !options.includePlanned) return false;
		return true;
	});

	const trimmed = query.trim();
	const scored = familiesToShow.map((family) => {
		const hits: PaletteHit[] = [];
		for (const summary of allAlgorithmSummaries()) {
			if (summary.familyId !== family.id) continue;
			const match = scoreCandidate(summary, query);
			if (!match) continue;
			hits.push({ summary, score: match.score, matches: match.matches });
		}
		hits.sort((a, b) => b.score - a.score || a.summary.name.localeCompare(b.summary.name));
		return { family, hits };
	});

	if (trimmed === '') {
		return scored.map((group) => ({ ...group, hits: group.hits.slice(0, 6) }));
	}

	return scored
		.filter((group) => group.hits.length > 0)
		.map((group) => ({ ...group, hits: group.hits.slice(0, 8) }))
		.sort((a, b) => b.hits[0].score - a.hits[0].score);
}

/**
 * Moves the selection by `delta`, clamped to the flattened hit list.
 *
 * Typed structurally against `hits.length` alone, because the palette's keyboard
 * handling genuinely does not care what is inside a hit.
 */
export function moveSelection(
	grouped: readonly { hits: readonly unknown[] }[],
	current: number,
	delta: number
): number {
	const total = grouped.reduce((sum, group) => sum + group.hits.length, 0);
	if (total === 0) return -1;
	return Math.max(0, Math.min(total - 1, current + delta));
}

/** The hits in the order the palette renders and navigates them. */
export function flatten<T extends { summary: { id: string } }>(
	grouped: readonly { hits: readonly T[] }[]
): T[] {
	return grouped.flatMap((group) => [...group.hits]);
}
