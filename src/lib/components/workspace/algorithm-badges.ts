import type { AlgorithmSummary } from '../../algorithms/types';

/**
 * The badges shown wherever an algorithm is listed.
 *
 * Defined once and rendered in both the palette and the Algorithm tab, so the
 * two can never drift and the claims are unit-testable without a DOM. The
 * complexity and property badges are the point of the palette existing: the
 * trade-off has to be visible before a user commits to a run, not after.
 */
export type AlgorithmBadge = {
	label: string;
	title: string;
	/** Dimmed badges are informational rather than a positive claim. */
	muted: boolean;
};

export function algorithmBadges(summary: AlgorithmSummary): AlgorithmBadge[] {
	return [
		{
			label: summary.complexity.time,
			title: 'Time complexity',
			muted: true
		},
		{
			label: summary.complexity.space,
			title: 'Space complexity',
			muted: true
		},
		{
			label: summary.properties.optimal ? 'optimal' : 'suboptimal',
			title: summary.properties.optimal
				? 'Guaranteed to return an optimal result'
				: 'May return a suboptimal result',
			// A "suboptimal" badge is a real property, not a defect notice, so it is
			// not dimmed; a claim that cannot be made is.
			muted: false
		},
		{
			label: summary.properties.complete ? 'complete' : 'prunes',
			title: summary.properties.complete
				? 'Always evaluates the whole search space'
				: 'May skip parts of the search space',
			muted: true
		}
	];
}
